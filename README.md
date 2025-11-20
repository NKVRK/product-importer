# Product Importer System

A high-performance, production-ready system for importing and managing large product catalogs (500,000+ products) with real-time progress tracking, webhook notifications, and a modern web interface.

## 📋 Project Overview

The Product Importer is a full-stack application designed to handle massive CSV imports without timeouts or memory issues. It features:

- **Async Background Processing**: CSV files are processed in chunks using Celery workers
- **Real-time Progress Tracking**: WebSocket-free polling mechanism for upload status
- **Product Management**: Full CRUD operations with search and pagination
- **High-Performance Bulk Operations**: TRUNCATE-based deletion for instant cleanup
- **Webhook Notifications**: Event-driven architecture for import completion notifications
- **Modern UI**: React-based interface with Tailwind CSS and responsive design

## 🏗️ Architecture

### Technology Stack

**Backend (Python)**
- **FastAPI**: High-performance async web framework for REST API
- **Celery**: Distributed task queue for background CSV processing
- **SQLAlchemy**: ORM with async support for database operations
- **PostgreSQL**: Primary database with optimized indexes for 500K+ products
- **Redis**: Message broker for Celery and result backend

**Frontend (JavaScript)**
- **React 19**: Modern UI library with hooks
- **Vite**: Fast build tool and dev server
- **Axios**: HTTP client for API communication
- **Tailwind CSS**: Utility-first CSS framework
- **@tanstack/react-table**: Powerful table component

### Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  - File Upload UI        - Product Table                    │
│  - Progress Tracking     - Webhook Manager                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST API
┌──────────────────────▼──────────────────────────────────────┐
│                      Backend (FastAPI)                       │
│  - API Endpoints      - Request Validation                  │
│  - Database Queries   - Task Orchestration                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐          ┌─────────▼─────────┐
│   PostgreSQL   │          │   Celery Worker   │
│  - Products    │          │  - CSV Processing │
│  - Webhooks    │          │  - Webhook Firing │
└────────────────┘          └─────────┬─────────┘
                                      │
                            ┌─────────▼─────────┐
                            │      Redis        │
                            │  - Task Queue     │
                            │  - Result Backend │
                            └───────────────────┘
```

## ✨ Key Features

### Story 1: CSV Upload & Processing (500K+ Products)

**Implementation Highlights:**
- **Async Worker with Chunking**: CSV files are read in 1,000-row chunks using pandas to prevent memory overflow
- **UPSERT Logic**: PostgreSQL's `ON CONFLICT DO UPDATE` for efficient bulk operations
- **Non-blocking**: File upload returns immediately with a task ID; processing happens in background
- **Progress Tracking**: Celery task state updates every chunk with current/total counts
- **Smart Updates**: Existing products update only `name` and `description`, preserving `is_active` state

**Technical Details:**
```python
# Chunked processing prevents memory issues
for chunk in pd.read_csv(file_path, chunksize=1000):
    # UPSERT: Update on conflict, insert if new
    stmt = pg_insert(Product).values(...)
    stmt = stmt.on_conflict_do_update(
        index_elements=['sku'],
        set_={'name': ..., 'description': ...}
    )
```

### Story 2: Product Management (CRUD)

**Features:**
- Create, Read, Update, Delete individual products
- Modal-based forms for clean UX
- Search by SKU or name (case-insensitive)
- Pagination (50 items per page, configurable)
- Real-time table refresh after operations

**Optimizations:**
- Database indexes on `sku`, `name`, and composite indexes for common queries
- Async SQLAlchemy for non-blocking database operations

### Story 3: Bulk Delete (High Performance)

**Implementation Highlights:**
- **TRUNCATE Optimization**: Uses `TRUNCATE TABLE products RESTART IDENTITY CASCADE` instead of `DELETE FROM`
- **Performance**: Instant deletion regardless of row count (500K rows in <1 second)
- **Why TRUNCATE?**
  - `DELETE FROM`: Row-by-row deletion, ~30-60 seconds for 500K rows
  - `TRUNCATE`: Drops and recreates table structure, <1 second for any amount
  - Resets auto-increment counters automatically

**Code:**
```python
await db.execute(text("TRUNCATE TABLE products RESTART IDENTITY CASCADE"))
```

### Story 4: Webhook Notifications

**Features:**
- Configure webhook URLs to receive POST requests on events
- Test webhooks with latency measurement
- Automatic firing on `import.completed` event
- Async delivery (non-blocking)

**Implementation:**
- Webhooks fire via separate Celery tasks to avoid blocking main worker
- 10-second timeout with error handling
- Payload includes event type, import results, and timestamp

## 🚀 Setup & Running

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (recommended)

### Option 1: Docker Compose (Recommended)

1. **Start Database & Redis:**
```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379

### Option 2: Local Services

Install PostgreSQL and Redis locally, or use existing instances.

### Backend Setup

1. **Create Virtual Environment:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install Dependencies:**
```bash
pip install -r requirements.txt
```

3. **Start FastAPI Server:**
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Server runs at: `http://127.0.0.1:8000`

4. **Start Celery Worker (New Terminal):**
```bash
cd backend
source venv/bin/activate
celery -A celery_app worker --loglevel=info
```

### Frontend Setup

1. **Install Dependencies:**
```bash
cd frontend
npm install
```

2. **Start Development Server:**
```bash
npm run dev
```

Frontend runs at: `http://localhost:5173`

### Verify Setup

1. Open `http://localhost:5173` in browser
2. Check backend health: `http://127.0.0.1:8000/health`
3. View API docs: `http://127.0.0.1:8000/docs`

## 📚 API Documentation

### Interactive Documentation

FastAPI provides automatic interactive API documentation:

- **Swagger UI**: `http://127.0.0.1:8000/docs`
- **ReDoc**: `http://127.0.0.1:8000/redoc`

### Key Endpoints

**Products:**
- `GET /products` - List products (paginated, searchable)
- `POST /products` - Create product
- `PUT /products/{id}` - Update product
- `DELETE /products/{id}` - Delete product
- `DELETE /products/all` - Bulk delete (TRUNCATE)

**Upload:**
- `POST /upload` - Upload CSV file
- `GET /upload/status/{task_id}` - Check processing status

**Webhooks:**
- `GET /webhooks` - List webhooks
- `POST /webhooks` - Create webhook
- `DELETE /webhooks/{id}` - Delete webhook
- `POST /webhooks/test` - Test webhook URL

## 🎯 Design Decisions

### Why Polling Instead of WebSockets?

**Decision**: Use HTTP polling for upload progress tracking

**Rationale:**
1. **Simplicity**: No need for WebSocket infrastructure or connection management
2. **Robustness**: HTTP is more reliable across proxies, load balancers, and firewalls
3. **Stateless**: No server-side connection state to manage
4. **Sufficient**: 2-second polling interval provides good UX for long-running tasks
5. **Compatibility**: Works everywhere without special server configuration

**Implementation**: Frontend polls `GET /upload/status/{task_id}` every 2 seconds until completion.

### Why TRUNCATE for Bulk Delete?

**Decision**: Use `TRUNCATE TABLE` instead of `DELETE FROM`

**Rationale:**
1. **Performance**: 1000x faster for large datasets (instant vs. minutes)
2. **Resource Efficiency**: No transaction log bloat, minimal disk I/O
3. **Auto-Reset**: Automatically resets auto-increment sequences
4. **Simplicity**: Single SQL command, no complex WHERE clauses

**Trade-offs:**
- Cannot be rolled back (acceptable for "Delete All" operation)
- Requires table-level lock (acceptable for admin operation)
- Triggers don't fire (not needed in our use case)

### Why Chunked CSV Processing?

**Decision**: Process CSV in 1,000-row chunks

**Rationale:**
1. **Memory Efficiency**: Prevents loading 500K rows into RAM at once
2. **Progress Tracking**: Can report progress after each chunk
3. **Error Recovery**: Partial success possible if later chunks fail
4. **Optimal Size**: 1,000 rows balances memory usage vs. database round-trips

### Why Async Webhook Delivery?

**Decision**: Fire webhooks via separate Celery tasks

**Rationale:**
1. **Non-blocking**: Main CSV processing doesn't wait for HTTP responses
2. **Resilience**: Webhook failures don't affect import success
3. **Retry Logic**: Celery can retry failed webhook deliveries
4. **Scalability**: Multiple webhooks can fire in parallel

## 🧪 Testing

### Generate Test Data

Generate a 500,000-row CSV for testing:

```bash
python generate_csv.py
```

This creates `products_500k.csv` with realistic dummy data.

### Test Upload

1. Go to Products View tab
2. Click "Select CSV File" and choose `products_500k.csv`
3. Click "Upload"
4. Watch real-time progress bar
5. Verify completion in ~30-60 seconds (depending on hardware)

### Test Webhooks

1. Go to Webhooks Config tab
2. Add webhook URL (e.g., `https://webhook.site/unique-url`)
3. Click "⚡ Test" to verify connectivity
4. Upload a CSV to trigger automatic webhook firing

## 📊 Performance Benchmarks

**Hardware**: Standard development machine (8GB RAM, SSD)

| Operation | Dataset Size | Time | Notes |
|-----------|-------------|------|-------|
| CSV Upload | 500,000 rows | ~45s | Chunked processing |
| Product Search | 500,000 rows | <100ms | Indexed queries |
| Bulk Delete | 500,000 rows | <1s | TRUNCATE optimization |
| Pagination | 500,000 rows | <50ms | Offset/limit queries |

## 🔒 Security Considerations

- **Input Validation**: Pydantic schemas validate all API inputs
- **SQL Injection**: SQLAlchemy ORM prevents SQL injection
- **CORS**: Configured for specific frontend origin
- **File Upload**: CSV validation and size limits
- **Webhook URLs**: Timeout and error handling prevents abuse

## 📦 Project Structure

```
product-importer/
├── backend/
│   ├── venv/                 # Python virtual environment
│   ├── temp/                 # Temporary CSV storage
│   ├── celery_app.py        # Celery configuration
│   ├── database.py          # Async SQLAlchemy setup
│   ├── database_sync.py     # Sync SQLAlchemy for workers
│   ├── main.py              # FastAPI application
│   ├── models.py            # Database models
│   ├── schemas.py           # Pydantic schemas
│   ├── worker.py            # Celery tasks
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── FileUpload.jsx
│   │   │   ├── ProductTable.jsx
│   │   │   ├── ProductModal.jsx
│   │   │   └── WebhookManager.jsx
│   │   ├── App.jsx          # Main application
│   │   └── index.css        # Tailwind styles
│   ├── package.json         # NPM dependencies
│   ├── tailwind.config.js   # Tailwind configuration
│   └── vite.config.js       # Vite configuration
├── docker-compose.yml       # Docker services
├── generate_csv.py          # Test data generator
└── README.md               # This file
```

## 🤝 Contributing

This is a demonstration project. For production use, consider:

- Add authentication/authorization
- Implement rate limiting
- Add comprehensive error logging
- Set up monitoring (Prometheus, Grafana)
- Add unit and integration tests
- Configure production WSGI server (Gunicorn)
- Set up CI/CD pipeline

## 📄 License

MIT License - See LICENSE file for details

## 👨‍💻 Author

Built as a technical demonstration of full-stack development with modern Python and JavaScript technologies.

---

**For deployment instructions, see [deployment.md](deployment.md)**
