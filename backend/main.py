import os
import time
import httpx
import aiofiles
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import select, func, or_, delete, text
from sqlalchemy.ext.asyncio import AsyncSession
from celery.result import AsyncResult
from database import engine, Base, get_db
from models import Product, Webhook
from schemas import ProductResponse, ProductCreate, WebhookCreate, WebhookResponse
from worker import process_csv_task


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    await engine.dispose()


# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Product Importer API",
    description="API for managing product imports and data",
    version="1.0.0",
    lifespan=lifespan
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Product Importer API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.post("/upload")
@limiter.limit("5/minute")
async def upload_csv(request: Request, file: UploadFile = File(...)):
    """
    Upload CSV file for processing.
    Returns task_id for tracking progress.
    Maximum file size: 100MB
    Rate limit: 5 uploads per minute
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    MAX_FILE_SIZE = 100 * 1024 * 1024
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is 100MB. Your file is {file_size / (1024 * 1024):.2f}MB"
        )
    
    temp_dir = "temp"
    os.makedirs(temp_dir, exist_ok=True)
    
    file_path = os.path.join(temp_dir, f"{file.filename}")
    
    try:
        async with aiofiles.open(file_path, 'wb') as out_file:
            while content := await file.read(1024 * 1024):
                await out_file.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    finally:
        await file.close()
    
    task = process_csv_task.delay(file_path)
    
    return {
        "task_id": task.id,
        "status": "processing",
        "message": "File uploaded successfully. Processing started."
    }


@app.get("/upload/status/{task_id}")
async def get_upload_status(task_id: str):
    """
    Get the status of a CSV processing task.
    """
    task = AsyncResult(task_id)
    
    if task.state == 'PENDING':
        response = {
            "task_id": task_id,
            "status": "pending",
            "progress": None,
            "message": "Task is waiting to be processed"
        }
    elif task.state == 'PROGRESS':
        response = {
            "task_id": task_id,
            "status": "processing",
            "progress": task.info,
            "message": "Task is being processed"
        }
    elif task.state == 'SUCCESS':
        response = {
            "task_id": task_id,
            "status": "completed",
            "progress": task.info,
            "result": task.result,
            "message": "Task completed successfully"
        }
    elif task.state == 'FAILURE':
        response = {
            "task_id": task_id,
            "status": "failed",
            "progress": task.info,
            "error": str(task.info) if task.info else "Unknown error",
            "message": "Task failed"
        }
    else:
        response = {
            "task_id": task_id,
            "status": task.state.lower(),
            "progress": task.info,
            "message": f"Task state: {task.state}"
        }
    
    return response


@app.get("/products")
async def get_products(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by SKU or name"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get paginated list of products with optional search.
    """
    # Calculate offset
    offset = (page - 1) * limit
    
    # Build base query
    query = select(Product)
    count_query = select(func.count(Product.id))
    
    # Add search filter if provided
    if search:
        search_filter = or_(
            Product.sku.ilike(f"%{search}%"),
            Product.name.ilike(f"%{search}%")
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Get paginated products
    query = query.offset(offset).limit(limit).order_by(Product.id.desc())
    result = await db.execute(query)
    products = result.scalars().all()
    
    # Convert to response schema
    products_data = [ProductResponse.model_validate(product) for product in products]
    
    return {
        "data": products_data,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }


@app.post("/products", response_model=ProductResponse)
async def create_product(
    product: ProductCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new product.
    """
    # Check if SKU already exists
    existing = await db.execute(
        select(Product).where(Product.sku == product.sku)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Product with this SKU already exists")
    
    # Create new product
    new_product = Product(
        sku=product.sku,
        name=product.name,
        description=product.description,
        is_active=product.is_active
    )
    
    db.add(new_product)
    await db.commit()
    await db.refresh(new_product)
    
    return ProductResponse.model_validate(new_product)


@app.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    product: ProductCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing product.
    """
    # Get existing product
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    existing_product = result.scalar_one_or_none()
    
    if not existing_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Update fields
    existing_product.name = product.name
    existing_product.description = product.description
    existing_product.is_active = product.is_active
    # Note: SKU is not updated (it's the unique identifier)
    
    await db.commit()
    await db.refresh(existing_product)
    
    return ProductResponse.model_validate(existing_product)


@app.post("/products/batch-delete")
async def batch_delete_products(
    product_ids: list[int],
    db: AsyncSession = Depends(get_db)
):
    """
    Delete multiple products by IDs in a single query.
    """
    if not product_ids:
        raise HTTPException(status_code=400, detail="No product IDs provided")
    
    try:
        result = await db.execute(
            delete(Product).where(Product.id.in_(product_ids))
        )
        await db.commit()
        
        return {
            "status": "success",
            "deleted_count": result.rowcount,
            "message": f"Successfully deleted {result.rowcount} products"
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete products: {str(e)}")


@app.delete("/products/all")
@limiter.limit("3/hour")
async def delete_all_products(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Delete ALL products using TRUNCATE for performance.
    CRITICAL: Uses TRUNCATE TABLE for instant deletion of 500k+ rows.
    Rate limit: 3 deletions per hour
    """
    try:
        await db.execute(text("TRUNCATE TABLE products RESTART IDENTITY CASCADE"))
        await db.commit()
        
        return {
            "status": "success",
            "message": "All products deleted successfully"
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete products: {str(e)}")


@app.delete("/products/{product_id}")
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a single product by ID."""
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await db.execute(
        delete(Product).where(Product.id == product_id)
    )
    await db.commit()
    
    return {"status": "success", "message": "Product deleted successfully"}


# ==================== WEBHOOK ENDPOINTS ====================

@app.get("/webhooks", response_model=list[WebhookResponse])
async def get_webhooks(db: AsyncSession = Depends(get_db)):
    """
    Get all configured webhooks.
    """
    result = await db.execute(select(Webhook).order_by(Webhook.created_at.desc()))
    webhooks = result.scalars().all()
    return [WebhookResponse.model_validate(webhook) for webhook in webhooks]


@app.post("/webhooks", response_model=WebhookResponse)
async def create_webhook(
    webhook: WebhookCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new webhook configuration.
    """
    new_webhook = Webhook(
        url=webhook.url,
        event_type=webhook.event_type,
        is_active=webhook.is_active
    )
    
    db.add(new_webhook)
    await db.commit()
    await db.refresh(new_webhook)
    
    return WebhookResponse.model_validate(new_webhook)


@app.delete("/webhooks/{webhook_id}")
async def delete_webhook(
    webhook_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a webhook configuration.
    """
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id)
    )
    webhook = result.scalar_one_or_none()
    
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    await db.execute(delete(Webhook).where(Webhook.id == webhook_id))
    await db.commit()
    
    return {"status": "success", "message": "Webhook deleted successfully"}


@app.post("/webhooks/test")
async def test_webhook(data: dict):
    """
    Test a webhook URL by sending a dummy POST request.
    Measures latency and returns status code.
    """
    url = data.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    
    # Prepare test payload
    test_payload = {
        "event": "test",
        "message": "This is a test webhook",
        "timestamp": time.time()
    }
    
    start_time = time.time()
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(url, json=test_payload)
            latency_ms = int((time.time() - start_time) * 1000)
            
            return {
                "status": "success",
                "status_code": response.status_code,
                "latency_ms": latency_ms,
                "message": f"Webhook responded with status {response.status_code}"
            }
    except httpx.TimeoutException:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "status": "error",
            "status_code": 0,
            "latency_ms": latency_ms,
            "message": "Request timed out after 5 seconds"
        }
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "status": "error",
            "status_code": 0,
            "latency_ms": latency_ms,
            "message": f"Error: {str(e)}"
        }
