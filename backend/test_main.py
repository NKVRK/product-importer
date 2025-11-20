import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from main import app, get_db
from database import Base
from models import Product, Webhook
import os
import tempfile

# Create in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    """Create test client with test database"""
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


@pytest.fixture
def sample_product():
    """Sample product data for testing"""
    return {
        "sku": "TEST-001",
        "name": "Test Product",
        "description": "Test Description",
        "is_active": True
    }


class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_check(self, client):
        """Test health endpoint returns ok"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestRootEndpoint:
    """Test root endpoint"""
    
    def test_root(self, client):
        """Test root endpoint returns API info"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Product Importer API"
        assert data["version"] == "1.0.0"
        assert data["docs"] == "/docs"


class TestProductCRUD:
    """Test product CRUD operations"""
    
    def test_create_product(self, client, sample_product):
        """Test creating a new product"""
        response = client.post("/products", json=sample_product)
        assert response.status_code == 200
        data = response.json()
        assert data["sku"] == sample_product["sku"]
        assert data["name"] == sample_product["name"]
        assert data["is_active"] == True
        assert "id" in data
    
    def test_create_duplicate_sku(self, client, sample_product):
        """Test creating product with duplicate SKU fails"""
        client.post("/products", json=sample_product)
        response = client.post("/products", json=sample_product)
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
    
    def test_get_products_empty(self, client):
        """Test getting products when none exist"""
        response = client.get("/products")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["data"] == []
    
    def test_get_products_with_data(self, client, sample_product):
        """Test getting products after creating one"""
        client.post("/products", json=sample_product)
        response = client.get("/products")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["data"]) == 1
        assert data["data"][0]["sku"] == sample_product["sku"]
    
    def test_get_products_pagination(self, client):
        """Test product pagination"""
        # Create multiple products
        for i in range(5):
            client.post("/products", json={
                "sku": f"TEST-{i:03d}",
                "name": f"Product {i}",
                "description": f"Description {i}",
                "is_active": True
            })
        
        # Test first page
        response = client.get("/products?page=1&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert len(data["data"]) == 2
        assert data["page"] == 1
        assert data["limit"] == 2
    
    def test_search_products(self, client):
        """Test product search functionality"""
        # Create test products
        client.post("/products", json={
            "sku": "LAPTOP-001",
            "name": "Gaming Laptop",
            "description": "High performance laptop",
            "is_active": True
        })
        client.post("/products", json={
            "sku": "MOUSE-001",
            "name": "Gaming Mouse",
            "description": "RGB mouse",
            "is_active": True
        })
        
        # Search by name
        response = client.get("/products?search=laptop")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert "Laptop" in data["data"][0]["name"]
    
    def test_update_product(self, client, sample_product):
        """Test updating a product"""
        # Create product
        create_response = client.post("/products", json=sample_product)
        product_id = create_response.json()["id"]
        
        # Update product
        updated_data = {
            "sku": sample_product["sku"],
            "name": "Updated Name",
            "description": "Updated Description",
            "is_active": False
        }
        response = client.put(f"/products/{product_id}", json=updated_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["is_active"] == False
    
    def test_update_nonexistent_product(self, client, sample_product):
        """Test updating product that doesn't exist"""
        response = client.put("/products/99999", json=sample_product)
        assert response.status_code == 404
    
    def test_delete_product(self, client, sample_product):
        """Test deleting a product"""
        # Create product
        create_response = client.post("/products", json=sample_product)
        product_id = create_response.json()["id"]
        
        # Delete product
        response = client.delete(f"/products/{product_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        
        # Verify deletion
        get_response = client.get("/products")
        assert get_response.json()["total"] == 0
    
    def test_delete_nonexistent_product(self, client):
        """Test deleting product that doesn't exist"""
        response = client.delete("/products/99999")
        assert response.status_code == 404
    
    def test_batch_delete_products(self, client):
        """Test batch deleting multiple products"""
        product_ids = []
        for i in range(5):
            response = client.post("/products", json={
                "sku": f"BATCH-{i:03d}",
                "name": f"Batch Product {i}",
                "description": f"Description {i}",
                "is_active": True
            })
            product_ids.append(response.json()["id"])
        
        response = client.post("/products/batch-delete", json=product_ids[:3])
        assert response.status_code == 200
        assert response.json()["deleted_count"] == 3
        
        get_response = client.get("/products")
        assert get_response.json()["total"] == 2
    
    def test_batch_delete_empty_list(self, client):
        """Test batch delete with empty list"""
        response = client.post("/products/batch-delete", json=[])
        assert response.status_code == 400


class TestFileUpload:
    """Test file upload functionality"""
    
    def test_upload_invalid_file_type(self, client):
        """Test uploading non-CSV file fails"""
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
            f.write(b"test content")
            f.flush()
            
            with open(f.name, "rb") as file:
                response = client.post(
                    "/upload",
                    files={"file": ("test.txt", file, "text/plain")}
                )
            
            os.unlink(f.name)
        
        assert response.status_code == 400
        assert "Only CSV files are allowed" in response.json()["detail"]
    
    def test_upload_file_too_large(self, client):
        """Test uploading file larger than 100MB fails"""
        # Create a mock large file (we'll simulate the size check)
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            # Write 101MB of data
            f.write(b"sku,name,description\n" * (101 * 1024 * 1024 // 25))
            f.flush()
            
            with open(f.name, "rb") as file:
                response = client.post(
                    "/upload",
                    files={"file": ("large.csv", file, "text/csv")}
                )
            
            os.unlink(f.name)
        
        assert response.status_code == 413
        assert "File too large" in response.json()["detail"]
    
    def test_upload_valid_csv(self, client):
        """Test uploading valid CSV file"""
        csv_content = b"sku,name,description\nTEST-001,Product 1,Description 1\n"
        
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(csv_content)
            f.flush()
            
            with open(f.name, "rb") as file:
                response = client.post(
                    "/upload",
                    files={"file": ("test.csv", file, "text/csv")}
                )
            
            os.unlink(f.name)
        
        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
        assert data["status"] == "processing"


class TestRateLimiting:
    """Test rate limiting functionality"""
    
    def test_upload_rate_limit(self, client):
        """Test upload endpoint rate limiting (5 per minute)"""
        csv_content = b"sku,name,description\nTEST-001,Product,Desc\n"
        
        # Make 5 requests (should succeed)
        for i in range(5):
            with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
                f.write(csv_content)
                f.flush()
                
                with open(f.name, "rb") as file:
                    response = client.post(
                        "/upload",
                        files={"file": (f"test{i}.csv", file, "text/csv")}
                    )
                
                os.unlink(f.name)
                assert response.status_code == 200
        
        # 6th request should be rate limited
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
            f.write(csv_content)
            f.flush()
            
            with open(f.name, "rb") as file:
                response = client.post(
                    "/upload",
                    files={"file": ("test6.csv", file, "text/csv")}
                )
            
            os.unlink(f.name)
        
        assert response.status_code == 429  # Too Many Requests


class TestWebhooks:
    """Test webhook functionality"""
    
    def test_create_webhook(self, client):
        """Test creating a webhook"""
        webhook_data = {
            "url": "https://example.com/webhook",
            "event_type": "import.completed",
            "is_active": True
        }
        response = client.post("/webhooks", json=webhook_data)
        assert response.status_code == 200
        data = response.json()
        assert data["url"] == webhook_data["url"]
        assert "id" in data
    
    def test_get_webhooks(self, client):
        """Test getting all webhooks"""
        # Create a webhook first
        client.post("/webhooks", json={
            "url": "https://example.com/webhook",
            "event_type": "import.completed",
            "is_active": True
        })
        
        response = client.get("/webhooks")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
    
    def test_delete_webhook(self, client):
        """Test deleting a webhook"""
        # Create webhook
        create_response = client.post("/webhooks", json={
            "url": "https://example.com/webhook",
            "event_type": "import.completed",
            "is_active": True
        })
        webhook_id = create_response.json()["id"]
        
        # Delete webhook
        response = client.delete(f"/webhooks/{webhook_id}")
        assert response.status_code == 200
        
        # Verify deletion
        get_response = client.get("/webhooks")
        assert len(get_response.json()) == 0


class TestValidation:
    """Test input validation"""
    
    def test_create_product_missing_sku(self, client):
        """Test creating product without SKU fails"""
        response = client.post("/products", json={
            "name": "Product",
            "description": "Description"
        })
        assert response.status_code == 422  # Validation error
    
    def test_create_product_empty_name(self, client):
        """Test creating product with empty name fails"""
        response = client.post("/products", json={
            "sku": "TEST-001",
            "name": "",
            "description": "Description"
        })
        assert response.status_code == 422
    
    def test_create_product_sku_too_long(self, client):
        """Test creating product with SKU > 255 chars fails"""
        response = client.post("/products", json={
            "sku": "A" * 256,
            "name": "Product",
            "description": "Description"
        })
        assert response.status_code == 422
