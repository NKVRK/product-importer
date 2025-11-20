# Deployment Guide

This guide explains how to deploy the Product Importer system to production environments.

## 🚀 Deployment to Render

[Render](https://render.com) is a modern cloud platform that simplifies deployment with built-in support for Docker, PostgreSQL, and Redis.

### Prerequisites

- Render account (free tier available)
- GitHub repository with this code
- `render.yaml` and `build.sh` files (included in this project)

### Deployment Steps

#### 1. Prepare Repository

Ensure your repository includes:
- `render.yaml` - Infrastructure as code configuration
- `build.sh` - Build script for backend
- All source code committed and pushed to GitHub

#### 2. Connect to Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Blueprint"
3. Connect your GitHub repository
4. Select the repository containing this project
5. Render will automatically detect `render.yaml`

#### 3. Review Configuration

The `render.yaml` file defines:

**Services:**
- **PostgreSQL Database**: Managed PostgreSQL instance
- **Redis**: Managed Redis instance for Celery
- **Backend Web Service**: FastAPI application
- **Celery Worker**: Background task processor
- **Frontend Static Site**: React application

**Environment Variables:**
- Automatically configured database connections
- Redis connection strings
- CORS origins for frontend

#### 4. Deploy

1. Click "Apply" to create all services
2. Render will:
   - Provision PostgreSQL and Redis
   - Build and deploy backend
   - Build and deploy frontend
   - Start Celery worker
3. Wait for all services to show "Live" status (~5-10 minutes)

#### 5. Verify Deployment

**Backend API:**
- URL: `https://your-app-name.onrender.com`
- Health check: `https://your-app-name.onrender.com/health`
- API docs: `https://your-app-name.onrender.com/docs`

**Frontend:**
- URL: `https://your-frontend-name.onrender.com`
- Should load the Product Importer UI

**Database:**
- Automatically connected via environment variables
- Tables created on first backend startup

### Configuration Files

#### render.yaml

```yaml
services:
  # PostgreSQL Database
  - type: pserv
    name: product-importer-db
    plan: free
    env: postgres
    
  # Redis for Celery
  - type: redis
    name: product-importer-redis
    plan: free
    
  # Backend API
  - type: web
    name: product-importer-api
    env: python
    buildCommand: "./build.sh"
    startCommand: "uvicorn main:app --host 0.0.0.0 --port $PORT"
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: product-importer-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: product-importer-redis
          type: redis
          property: connectionString
          
  # Celery Worker
  - type: worker
    name: product-importer-worker
    env: python
    buildCommand: "./build.sh"
    startCommand: "celery -A celery_app worker --loglevel=info"
    envVars:
      - key: DATABASE_URL_SYNC
        fromDatabase:
          name: product-importer-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: product-importer-redis
          type: redis
          property: connectionString
          
  # Frontend
  - type: static
    name: product-importer-frontend
    buildCommand: "cd frontend && npm install && npm run build"
    staticPublishPath: frontend/dist
    envVars:
      - key: VITE_API_URL
        value: https://product-importer-api.onrender.com
```

#### build.sh

```bash
#!/bin/bash
# Backend build script for Render

cd backend
pip install -r requirements.txt
```

Make sure `build.sh` is executable:
```bash
chmod +x build.sh
```

### Environment Variables

**Backend:**
- `DATABASE_URL`: PostgreSQL connection string (auto-configured)
- `DATABASE_URL_SYNC`: Sync version for Celery workers
- `REDIS_URL`: Redis connection string (auto-configured)
- `PORT`: Server port (auto-configured by Render)

**Frontend:**
- `VITE_API_URL`: Backend API URL (update in frontend code)

### Post-Deployment Configuration

#### Update Frontend API URL

In `frontend/src/components/FileUpload.jsx`, `ProductTable.jsx`, `WebhookManager.jsx`, and `App.jsx`:

```javascript
// Change from:
const API_URL = 'http://localhost:8000';

// To:
const API_URL = import.meta.env.VITE_API_URL || 'https://your-api.onrender.com';
```

#### Configure CORS

In `backend/main.py`, update CORS origins:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Development
        "https://your-frontend.onrender.com"  # Production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Monitoring

**Render Dashboard:**
- View logs for each service
- Monitor resource usage
- Check deployment status
- View metrics and alerts

**Health Checks:**
- Backend: `/health` endpoint
- Database: Connection status in logs
- Celery: Worker ready messages in logs

### Scaling

**Free Tier Limitations:**
- Services sleep after 15 minutes of inactivity
- Limited CPU and memory
- Shared database resources

**Upgrade Options:**
- Starter plan: Always-on services
- Standard plan: More resources, autoscaling
- Pro plan: Dedicated resources, priority support

### Troubleshooting

**Service Won't Start:**
- Check logs in Render dashboard
- Verify environment variables are set
- Ensure `build.sh` is executable
- Check database connection string

**Database Connection Errors:**
- Verify `DATABASE_URL` environment variable
- Check PostgreSQL service is running
- Review connection string format

**Celery Worker Not Processing:**
- Check Redis connection
- Verify worker logs show "ready" message
- Ensure task names match between main.py and worker.py

**Frontend Can't Connect to Backend:**
- Verify `VITE_API_URL` is set correctly
- Check CORS configuration in backend
- Ensure backend service is running

## 🐳 Docker Deployment

### Build Images

```bash
# Backend
docker build -t product-importer-backend ./backend

# Frontend
docker build -t product-importer-frontend ./frontend
```

### Run with Docker Compose

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables

Create `.env` file:

```env
DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/products_db
DATABASE_URL_SYNC=postgresql://user:pass@db:5432/products_db
REDIS_URL=redis://redis:6379/0
```

## ☁️ AWS Deployment

### Services Required

- **RDS PostgreSQL**: Managed database
- **ElastiCache Redis**: Managed Redis
- **ECS/Fargate**: Container orchestration
- **ALB**: Load balancer
- **S3 + CloudFront**: Frontend hosting

### Architecture

```
CloudFront → S3 (Frontend)
     ↓
    ALB → ECS Tasks (Backend + Celery)
     ↓         ↓
    RDS    ElastiCache
```

## 🔐 Security Checklist

- [ ] Enable HTTPS/TLS
- [ ] Set strong database passwords
- [ ] Configure firewall rules
- [ ] Enable database backups
- [ ] Set up monitoring and alerts
- [ ] Configure rate limiting
- [ ] Enable CORS only for trusted origins
- [ ] Use environment variables for secrets
- [ ] Enable database encryption at rest
- [ ] Set up log aggregation

## 📊 Performance Optimization

**Database:**
- Enable connection pooling
- Add database indexes (already configured)
- Configure query caching
- Set appropriate pool sizes

**Celery:**
- Adjust worker concurrency based on CPU
- Configure task time limits
- Enable result backend cleanup
- Monitor queue lengths

**Frontend:**
- Enable gzip compression
- Configure CDN caching
- Optimize bundle size
- Enable lazy loading

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy to Render

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Trigger Render Deploy
        run: curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}
```

## 📝 Maintenance

**Regular Tasks:**
- Monitor disk usage
- Review application logs
- Check error rates
- Update dependencies
- Backup database
- Test disaster recovery

**Database Maintenance:**
```sql
-- Vacuum and analyze
VACUUM ANALYZE products;

-- Reindex
REINDEX TABLE products;

-- Check table size
SELECT pg_size_pretty(pg_total_relation_size('products'));
```

## 🆘 Support

For deployment issues:
1. Check service logs
2. Verify environment variables
3. Test database connectivity
4. Review CORS configuration
5. Check firewall rules

---

**Back to [README.md](README.md)**
