from sqlalchemy import Column, Integer, String, Text, Boolean, Index, DateTime
from sqlalchemy.sql import func
from database import Base


class Product(Base):
    """
    Product model for storing product information.
    Designed to handle 500,000+ products efficiently with proper indexing.
    """
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sku = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(500), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False, server_default="true")

    __table_args__ = (
        Index('idx_name_active', 'name', 'is_active'),
    )

    def __repr__(self):
        return f"<Product(id={self.id}, sku='{self.sku}', name='{self.name}', is_active={self.is_active})>"


class Webhook(Base):
    """
    Webhook model for storing webhook configurations.
    Webhooks are triggered on specific events (e.g., import.completed).
    """
    __tablename__ = "webhooks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    url = Column(String(2048), nullable=False)
    event_type = Column(String(100), nullable=False, default="import.completed", server_default="import.completed")
    is_active = Column(Boolean, default=True, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<Webhook(id={self.id}, url='{self.url}', event='{self.event_type}', active={self.is_active})>"
