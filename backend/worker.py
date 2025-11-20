import os
import time
import pandas as pd
import numpy as np
import requests
from celery import Task
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from celery_app import celery_app
from database_sync import SessionLocal
from models import Product, Webhook


@celery_app.task(bind=True, name="worker.process_csv_task")
def process_csv_task(self: Task, file_path: str):
    """
    Process CSV file in chunks using bulk upsert for performance.
    Updates existing products by SKU, preserving is_active status.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"CSV file not found: {file_path}")
    
    chunk_size = 3000
    total_processed = 0
    total_rows = 0
    start_time = time.time()
    
    try:
        try:
            total_rows = sum(1 for _ in open(file_path)) - 1
        except Exception:
            self.update_state(
                state='PROGRESS',
                meta={'current': 0, 'total': 0, 'status': 'Counting rows...'}
            )
        
        db = SessionLocal()
        
        try:
            for chunk_num, chunk in enumerate(pd.read_csv(file_path, chunksize=chunk_size)):
                chunk_start = time.time()
                
                chunk = chunk.replace({np.nan: None})
                
                records = chunk.to_dict('records')
                
                if not records:
                    continue
                
                for record in records:
                    record['is_active'] = True
                
                try:
                    stmt = pg_insert(Product).values(records)
                    
                    stmt = stmt.on_conflict_do_update(
                        index_elements=['sku'],
                        set_={
                            'name': stmt.excluded.name,
                            'description': stmt.excluded.description,
                        }
                    )
                    
                    db.execute(stmt)
                    db.commit()
                    
                    total_processed += len(records)
                    
                    chunk_time = time.time() - chunk_start
                    rows_per_sec = len(records) / chunk_time if chunk_time > 0 else 0
                    
                except Exception:
                    db.rollback()
                    
                    for record in records:
                        try:
                            stmt = pg_insert(Product).values(
                                sku=record.get('sku'),
                                name=record.get('name'),
                                description=record.get('description'),
                                is_active=True
                            )
                            
                            stmt = stmt.on_conflict_do_update(
                                index_elements=['sku'],
                                set_={
                                    'name': stmt.excluded.name,
                                    'description': stmt.excluded.description,
                                }
                            )
                            
                            db.execute(stmt)
                            db.commit()
                            total_processed += 1
                            
                        except Exception:
                            db.rollback()
                            continue
                
                self.update_state(
                    state='PROGRESS',
                    meta={
                        'current': total_processed,
                        'total': total_rows,
                        'processed': total_processed,
                        'status': f'Processed {total_processed}/{total_rows} products...'
                    }
                )
        
        finally:
            db.close()
        
        try:
            os.remove(file_path)
        except Exception:
            pass
        
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
            finally:
                db_webhook.close()
        except Exception:
            pass
        
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
    """
    try:
        response = requests.post(
            url,
            json=payload,
            timeout=10,
            headers={'Content-Type': 'application/json'}
        )
        
        return {
            'status': 'success',
            'url': url,
            'status_code': response.status_code,
            'message': 'Webhook delivered successfully'
        }
    except requests.exceptions.Timeout:
        return {
            'status': 'error',
            'url': url,
            'message': 'Request timed out'
        }
    except Exception as e:
        return {
            'status': 'error',
            'url': url,
            'message': str(e)
        }
