from celery import Celery

# Initialize Celery app
celery_app = Celery(
    "product_importer",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0",
    include=["worker"]  # Include worker tasks
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max per task
    task_soft_time_limit=3300,  # 55 minutes soft limit
    worker_prefetch_multiplier=1,  # Process one task at a time
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks to prevent memory leaks
)
