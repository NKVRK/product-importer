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

### 1. CSV Upload & Processing
- Process 500,000+ products efficiently with bulk upsert operations
- Real-time progress tracking with visual stepper (Upload → Validated → Importing → Complete)
- Non-blocking background processing using Celery workers
- Smart updates: preserves `is_active` status on existing products
- Automatic error recovery with row-by-row fallback

### 2. Product Management
- Full CRUD operations with intuitive modal forms
- Fast search by SKU or product name
- Paginated table view (50 items per page)
- Instant bulk delete using TRUNCATE optimization

### 3. Webhook Notifications
- Configure webhook URLs for import completion events
- Test webhooks before use
- Async delivery with timeout handling
- Detailed payload with import statistics

## 🚀 Setup & Running

### Prerequisites

Before starting, ensure you have the following installed:

- **Python 3.12+**
- **Node.js 18+** and npm
- **Docker & Docker Compose** (recommended for PostgreSQL/Redis)

---

## Prerequisites Installation

### Install Python 3.12+

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install python3.12 python3.12-venv python3-pip
python3.12 --version
```

**macOS (using Homebrew):**
```bash
brew install python@3.12
python3.12 --version
```

**Windows:**
Download from [python.org](https://www.python.org/downloads/) and run installer.

---

### Install Node.js 18+ and npm

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version && npm --version
```

**macOS (using Homebrew):**
```bash
brew install node@18
node --version && npm --version
```

**Windows:**
Download from [nodejs.org](https://nodejs.org/) and run installer.

---

### Install Docker & Docker Compose

**Ubuntu/Debian:**
```bash
# Install Docker
sudo apt update
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install -y docker-compose

# Verify installation
docker --version
docker-compose --version
```

**macOS:**
Download and install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)

**Windows:**
Download and install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)

**Note**: After installing Docker, you may need to log out and back in for group permissions to take effect.

---

### Alternative: Install PostgreSQL & Redis Locally (Without Docker)

If you prefer not to use Docker:

**PostgreSQL 15+ (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres psql -c "CREATE DATABASE products_db;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

**Redis 7+ (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
redis-cli ping  # Should return "PONG"
```

**macOS:**
```bash
brew install postgresql@15 redis
brew services start postgresql@15
brew services start redis
```

---

### Verify Prerequisites Installation

Run these commands to verify everything is installed correctly:

```bash
# Check Python
python3.12 --version  # Should show: Python 3.12.x

# Check Node.js and npm
node --version  # Should show: v18.x.x or higher
npm --version   # Should show: 9.x.x or higher

# Check Docker (if using)
docker --version         # Should show: Docker version 20.x.x or higher
docker-compose --version # Should show: docker-compose version 1.29.x or higher

# Check PostgreSQL (if installed locally)
psql --version  # Should show: psql (PostgreSQL) 15.x or higher

# Check Redis (if installed locally)
redis-cli --version  # Should show: redis-cli 7.x.x or higher
```

If any command fails, refer to the installation section above for that specific tool.

---

## Quick Start Guide

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd product-importer
```

### Step 2: Start Database & Redis

**Option A: Using Docker (Recommended)**

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on port `5433` (mapped from container's 5432)
- **Redis** on port `6379`

Verify services are running:
```bash
docker-compose ps
# Both postgres and redis should show "Up"
```

**Option B: Local Installation**

If you prefer local services:
- Install PostgreSQL 15+ and create database `products_db`
- Install Redis 7+ and start service
- Update connection strings in Step 3

---

### Step 3: Backend Setup

**3.1 Navigate to backend directory:**
```bash
cd backend
```

**3.2 Create and activate virtual environment:**
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

**3.3 Install Python dependencies:**
```bash
pip install -r requirements.txt
```

**3.4 Configure environment variables (Optional):**

Default connection strings (works with Docker Compose):
- PostgreSQL: `postgresql+asyncpg://postgres:postgres@localhost:5433/products_db`
- Redis: `redis://localhost:6379/0`

To use custom settings, create a `.env` file or export variables:
```bash
export DATABASE_URL="postgresql+asyncpg://user:pass@host:port/db"
export DATABASE_URL_SYNC="postgresql+psycopg2://user:pass@host:port/db"
export CELERY_BROKER_URL="redis://localhost:6379/0"
export CELERY_RESULT_BACKEND="redis://localhost:6379/0"
```

**3.5 Start FastAPI server:**
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

✅ Backend API running at: `http://127.0.0.1:8000`

**3.6 Start Celery worker (Open NEW terminal):**
```bash
cd backend
source venv/bin/activate
celery -A celery_app worker --loglevel=info
```

✅ Celery worker is now processing background tasks

---

### Step 4: Frontend Setup

**4.1 Navigate to frontend directory (New terminal):**
```bash
cd frontend
```

**4.2 Install Node dependencies:**
```bash
npm install
```

**4.3 Start development server:**
```bash
npm run dev
```

✅ Frontend running at: `http://localhost:5173`

---

### Step 5: Verify Installation

**5.1 Open application in browser:**
```
http://localhost:5173
```

**5.2 Check backend health:**
```bash
curl http://127.0.0.1:8000/health
# Expected: {"status":"healthy"}
```

**5.3 View API documentation:**
```
http://127.0.0.1:8000/docs
```

---

## Running Services Summary

You should have **4 processes running**:

1. **PostgreSQL** (Docker or local) - Port 5433
2. **Redis** (Docker or local) - Port 6379
3. **FastAPI Backend** - Port 8000
   ```bash
   cd backend && source venv/bin/activate
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```
4. **Celery Worker** - Background processing
   ```bash
   cd backend && source venv/bin/activate
   celery -A celery_app worker --loglevel=info
   ```
5. **React Frontend** - Port 5173
   ```bash
   cd frontend
   npm run dev
   ```

## 📚 API Documentation

### Interactive Documentation

FastAPI provides automatic interactive API documentation:

- **Swagger UI**: `http://127.0.0.1:8000/docs`
- **ReDoc**: `http://127.0.0.1:8000/redoc`
- **Health Check**: `http://127.0.0.1:8000/health`

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

## 🎯 Technical Highlights

- **HTTP Polling**: Simple, stateless progress tracking (2-second intervals)
- **Bulk Upsert**: 3,000-row chunks for optimal performance and memory usage
- **TRUNCATE Optimization**: Instant deletion of large datasets (<1 second for 500K rows)
- **Async Webhooks**: Non-blocking delivery via separate Celery tasks

## 🧪 Testing

### Generate Test Data

Generate a 500,000-row CSV for testing:

```bash
python generate_csv.py
```

This creates `products_500k.csv` with realistic dummy data.

### Test Upload

1. Go to **Products** tab (default view)
2. In the "Quick Upload" section, click "Upload a file" or drag and drop
3. Select `products_500k.csv` (generated using `generate_csv.py`)
4. Click the green "Upload CSV" button
5. Watch the horizontal progress stepper:
   - Upload → Validated → Importing → Complete
6. Real-time progress bar shows rows processed
7. Import completes in ~2-3 minutes (500,000 rows with bulk upsert)
8. Products automatically appear in the table below
9. **Note**: Do not switch to Webhooks tab during processing (it will be disabled)

### Test Webhooks

1. Go to **Webhooks** tab
2. Enter webhook URL (e.g., `https://webhook.site/unique-url`)
3. Click "Add Webhook"
4. Click "Test" button to verify connectivity
5. Upload a CSV file to trigger automatic webhook firing on completion

## 📊 Performance Benchmarks

**Hardware**: Standard development machine (8GB RAM, SSD)

| Operation | Dataset Size | Time | Notes |
|-----------|-------------|------|-------|
| CSV Upload | 500,000 rows | ~2-3 min | Bulk upsert (3000 rows/chunk) |
| Product Search | 500,000 rows | <100ms | Indexed queries |
| Bulk Delete | 500,000 rows | <1s | TRUNCATE optimization |
| Pagination | 500,000 rows | <50ms | Offset/limit queries |

## 🔒 Security

Built-in protections: Input validation (Pydantic), SQL injection prevention (SQLAlchemy ORM), CORS configuration, CSV validation, and webhook timeouts.

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

## 🐛 Troubleshooting

### Installation Issues

**1. Python 3.12 not found**
```
Error: python3.12: command not found
```
**Solution**: 
- Ubuntu/Debian: `sudo apt install python3.12 python3.12-venv`
- macOS: `brew install python@3.12`
- Or use `python3` if you have 3.12+ installed as default

**2. Docker permission denied**
```
Error: Got permission denied while trying to connect to the Docker daemon
```
**Solution**: 
```bash
sudo usermod -aG docker $USER
# Log out and back in, then verify:
docker ps
```

**3. Node.js version too old**
```
Error: The engine "node" is incompatible with this module
```
**Solution**: Update Node.js to 18+:
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

**4. Port already in use**
```
Error: Address already in use (port 5433/8000/5173)
```
**Solution**: Find and kill the process:
```bash
# Find process using port
sudo lsof -i :5433  # or :8000 or :5173
# Kill process
sudo kill -9 <PID>
```

---

### Runtime Issues

**5. PostgreSQL Connection Error**
```
Error: could not connect to server
```
**Solution**: Ensure PostgreSQL is running on port 5433:
```bash
docker-compose ps
# Should show postgres container running

# If not running:
docker-compose up -d postgres
```

**6. Celery Worker Not Processing**
```
Error: Received unregistered task
```
**Solution**: 
1. Ensure you're in the backend directory
2. Virtual environment is activated
3. Restart Celery worker:
```bash
cd backend
source venv/bin/activate
celery -A celery_app worker --loglevel=info
```

**7. Frontend Can't Connect to Backend**
```
Error: Network Error / ERR_CONNECTION_REFUSED
```
**Solution**: Verify backend is running on port 8000:
```bash
curl http://127.0.0.1:8000/health
# Should return: {"status":"healthy"}

# If not running, start it:
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**8. Redis Connection Error**
```
Error: Error 111 connecting to localhost:6379
```
**Solution**: Start Redis:
```bash
docker-compose up -d redis
# Verify it's running:
redis-cli ping  # Should return "PONG"
```

**9. CSV Upload Fails or Hangs**
```
Error: Failed to process CSV
```
**Solution**: 
1. Check Celery worker is running and processing tasks
2. Check Celery worker logs for detailed error messages
3. Verify CSV file format (should have: sku, name, description columns)
4. Ensure database connection is working

**10. Module Not Found Errors**
```
Error: ModuleNotFoundError: No module named 'fastapi'
```
**Solution**: Reinstall dependencies:
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

**11. Database Migration Issues**
```
Error: relation "products" does not exist
```
**Solution**: Database tables are auto-created on first run. Restart FastAPI:
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## 📝 Notes

This is a demonstration project showcasing full-stack development with FastAPI, React, and Celery. For production deployment, consider adding authentication, rate limiting, monitoring, and comprehensive testing.

## 📄 License

MIT License

---

**Need help?** Check the [Troubleshooting](#-troubleshooting) section above.
