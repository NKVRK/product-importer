import os
import shutil
import time
import httpx
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func, or_, delete, text
from sqlalchemy.ext.asyncio import AsyncSession
from celery.result import AsyncResult
from database import engine, Base, get_db
from models import Product, Webhook
import models  # Import models to ensure they're registered with Base
from schemas import ProductResponse, ProductCreate, WebhookCreate, WebhookResponse
from worker import process_csv_task


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    Creates database tables on startup.
    """
    # Startup: Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    # Shutdown: Clean up resources
    await engine.dispose()


# Initialize FastAPI application
app = FastAPI(
    title="Product Importer API",
    description="API for managing product imports and data",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
async def upload_csv(file: UploadFile = File(...)):
    """
    Upload CSV file for processing.
    Returns task_id for tracking progress.
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    # Create temp directory if it doesn't exist
    temp_dir = "temp"
    os.makedirs(temp_dir, exist_ok=True)
    
    # Save uploaded file to temp directory
    file_path = os.path.join(temp_dir, f"{file.filename}")
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    finally:
        file.file.close()
    
    # Trigger Celery task
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


@app.delete("/products/{product_id}")
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a single product by ID.
    """
    # Get existing product
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Delete the product
    await db.execute(
        delete(Product).where(Product.id == product_id)
    )
    await db.commit()
    
    return {"status": "success", "message": "Product deleted successfully"}


@app.delete("/products/all")
async def delete_all_products(db: AsyncSession = Depends(get_db)):
    """
    Delete ALL products using TRUNCATE for performance.
    CRITICAL: Uses TRUNCATE TABLE for instant deletion of 500k+ rows.
    """
    try:
        # Use TRUNCATE for instant deletion (much faster than DELETE for large datasets)
        await db.execute(text("TRUNCATE TABLE products RESTART IDENTITY CASCADE"))
        await db.commit()
        
        return {
            "status": "success",
            "message": "All products deleted successfully"
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete products: {str(e)}")


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
