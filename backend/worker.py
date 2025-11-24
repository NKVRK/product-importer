import os
import csv
import time
from datetime import datetime
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
    start_time = time.time()
    total_rows = 0

    def parse_active(value):
        if value is None:
            return True
        normalized = str(value).strip().lower()
        if normalized in {'false', '0', 'no', 'inactive'}:
            return False
        if normalized in {'true', '1', 'yes', 'active'}:
            return True
        return True

    # Pre-calculate total valid rows (with required fields) for accurate progress reporting
    try:
        with open(file_path, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                sku = row.get('sku', '').strip()
                name = row.get('name', '').strip()
                if sku and name:
                    total_rows += 1
    except Exception:
        total_rows = 0
    
    try:
        db = SessionLocal()
        
        try:
            with open(file_path, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                records = []
                
                for row in reader:
                    sku = row.get('sku', '').strip()
                    name = row.get('name', '').strip()
                    if not sku or not name:
                        continue

                    record = {
                        'sku': sku.lower(),
                        'name': name,
                        'description': row.get('description', '').strip() or None,
                        'is_active': parse_active(row.get('is_active'))
                    }
                    records.append(record)
                    
                    if len(records) >= chunk_size:
                        chunk_start = time.time()
                
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
                                        is_active=record.get('is_active', True)
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
                                'status': f'Processed {total_processed} products...'
                            }
                        )
                        
                        records = []
                
                if records:
                    chunk_start = time.time()
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
                    except Exception:
                        db.rollback()
                        for record in records:
                            try:
                                stmt = pg_insert(Product).values(
                                    sku=record.get('sku'),
                                    name=record.get('name'),
                                    description=record.get('description'),
                                    is_active=record.get('is_active', True)
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
        
        finally:
            db.close()
        
        try:
            os.remove(file_path)
        except Exception:
            pass
        
        # Fail fast when the CSV provided no usable sku/name data.
        if total_rows == 0:
            raise ValueError("CSV contained no valid rows. Ensure the file has sku and name values.")
        if total_processed == 0:
            raise ValueError("No products were imported. Verify rows include sku and name values.")

        result_data = {
            'status': 'completed',
            'total_processed': total_processed,
            'total_rows': total_rows,
            'message': f'Successfully processed {total_processed} products'
        }
        
        try:
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
                    'timestamp': datetime.now().isoformat()
                }
                
                for webhook in webhooks:
                    fire_webhook_task.delay(webhook.url, webhook_payload)
            finally:
                db_webhook.close()
        except Exception:
            pass
        
        return result_data
    
    except Exception:
        raise


@celery_app.task(
    name="worker.fire_webhook_task",
    bind=True,
    autoretry_for=(requests.exceptions.RequestException,),
    retry_backoff=True,
    retry_kwargs={'max_retries': 5}
)
def fire_webhook_task(self, url: str, payload: dict):
    """
    Fire a webhook by sending a POST request to the specified URL.
    Automatically retries on failure with exponential backoff.
    """
    try:
        response = requests.post(
            url,
            json=payload,
            timeout=10,
            headers={'Content-Type': 'application/json'}
        )
        response.raise_for_status()
        
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
