import os
import pandas as pd
import requests
from celery import Task
from sqlalchemy import insert, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from celery_app import celery_app
from database_sync import SessionLocal
from models import Product, Webhook


@celery_app.task(bind=True, name="worker.process_csv_task")
def process_csv_task(self: Task, file_path: str):
    """
    Process CSV file in chunks and upsert products into database.
    
    Args:
        file_path: Path to the CSV file to process
        
    Returns:
        dict: Summary of processing results
        
    CRITICAL LOGIC:
    - If product exists (SKU match): Update ONLY 'name' and 'description'
    - DO NOT reset 'is_active' on existing products
    - New products get 'is_active' = True by default
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"CSV file not found: {file_path}")
    
    chunk_size = 1000
    total_processed = 0
    total_inserted = 0
    total_updated = 0
    total_rows = 0
    
    try:
        # First, count total rows for progress tracking
        try:
            total_rows = sum(1 for _ in open(file_path)) - 1  # Subtract header
        except Exception as e:
            self.update_state(
                state='PROGRESS',
                meta={'current': 0, 'total': 0, 'status': 'Counting rows...'}
            )
        
        # Process CSV in chunks
        db = SessionLocal()
        
        try:
            for chunk_num, chunk in enumerate(pd.read_csv(file_path, chunksize=chunk_size)):
                # Convert chunk to list of dictionaries
                records = chunk.to_dict('records')
                
                # Prepare data for upsert
                for record in records:
                    try:
                        # Create upsert statement using PostgreSQL's ON CONFLICT
                        stmt = pg_insert(Product).values(
                            sku=record.get('sku'),
                            name=record.get('name'),
                            description=record.get('description', None),
                            is_active=True  # Default for new products
                        )
                        
                        # On conflict (SKU exists), update ONLY name and description
                        # DO NOT update is_active - keep existing value
                        stmt = stmt.on_conflict_do_update(
                            index_elements=['sku'],
                            set_={
                                'name': stmt.excluded.name,
                                'description': stmt.excluded.description,
                            }
                        )
                        
                        # Execute the upsert
                        result = db.execute(stmt)
                        db.commit()
                        
                        total_processed += 1
                        
                    except Exception as record_error:
                        db.rollback()
                        print(f"Error processing record {record}: {record_error}")
                        continue
                
                # Update progress
                current_progress = (chunk_num + 1) * chunk_size
                self.update_state(
                    state='PROGRESS',
                    meta={
                        'current': min(current_progress, total_rows),
                        'total': total_rows,
                        'processed': total_processed,
                        'status': f'Processing chunk {chunk_num + 1}...'
                    }
                )
        
        finally:
            db.close()
        
        # Clean up the temporary file
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Warning: Could not delete temp file {file_path}: {e}")
        
        # Fire webhooks for import.completed event
        result_data = {
            'status': 'completed',
            'total_processed': total_processed,
            'total_rows': total_rows,
            'message': f'Successfully processed {total_processed} products'
        }
        
        try:
            # Query all active webhooks for this event
            db_webhook = SessionLocal()
            try:
                webhooks = db_webhook.execute(
                    select(Webhook).where(
                        Webhook.event_type == "import.completed",
                        Webhook.is_active == True
                    )
                ).scalars().all()
                
                # Fire webhooks asynchronously
                webhook_payload = {
                    'event': 'import.completed',
                    'data': result_data,
                    'timestamp': pd.Timestamp.now().isoformat()
                }
                
                for webhook in webhooks:
                    fire_webhook_task.delay(webhook.url, webhook_payload)
                    print(f"Queued webhook to {webhook.url}")
            finally:
                db_webhook.close()
        except Exception as webhook_error:
            print(f"Warning: Failed to fire webhooks: {webhook_error}")
        
        return result_data
    
    except Exception as e:
        # Update state to FAILURE with error details
        self.update_state(
            state='FAILURE',
            meta={
                'error': str(e),
                'total_processed': total_processed,
                'status': 'Failed'
            }
        )
        raise


@celery_app.task(name="worker.fire_webhook_task")
def fire_webhook_task(url: str, payload: dict):
    """
    Fire a webhook by sending a POST request to the specified URL.
    This task runs asynchronously to avoid blocking the main worker.
    
    Args:
        url: Webhook URL to send the request to
        payload: JSON payload to send
    """
    try:
        response = requests.post(
            url,
            json=payload,
            timeout=10,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"Webhook fired to {url}: Status {response.status_code}")
        
        return {
            'status': 'success',
            'url': url,
            'status_code': response.status_code,
            'message': f'Webhook delivered successfully'
        }
    except requests.exceptions.Timeout:
        print(f"Webhook timeout for {url}")
        return {
            'status': 'error',
            'url': url,
            'message': 'Request timed out'
        }
    except Exception as e:
        print(f"Webhook error for {url}: {str(e)}")
        return {
            'status': 'error',
            'url': url,
            'message': str(e)
        }
