from sqlalchemy import Column, Integer, String, Text, Boolean, Index
from database import Base


class Product(Base):
    """
    Product model for storing product information.
    Designed to handle 500,000+ products efficiently with proper indexing.
    """
    __tablename__ = "products"

    # Primary key with index
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # SKU must be unique and indexed for fast lookups
    sku = Column(String(255), unique=True, nullable=False, index=True)
    
    # Name indexed for search operations
    name = Column(String(500), nullable=False, index=True)
    
    # Description can be long text
    description = Column(Text, nullable=True)
    
    # is_active defaults to True (not in CSV, set automatically)
    is_active = Column(Boolean, default=True, nullable=False, server_default="true")

    # Additional composite index for common queries
    __table_args__ = (
        Index('idx_sku_active', 'sku', 'is_active'),
        Index('idx_name_active', 'name', 'is_active'),
    )

    def __repr__(self):
        return f"<Product(id={self.id}, sku='{self.sku}', name='{self.name}', is_active={self.is_active})>"
