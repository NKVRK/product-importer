import os
import shutil
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from celery.result import AsyncResult
from database import engine, Base
import models  # Import models to ensure they're registered with Base
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
