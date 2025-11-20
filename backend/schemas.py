from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


class ProductBase(BaseModel):
    """Base schema for Product with common fields"""
    sku: str = Field(..., min_length=1, max_length=255, description="Unique product SKU")
    name: str = Field(..., min_length=1, max_length=500, description="Product name")
    description: Optional[str] = Field(None, description="Product description")


class ProductCreate(ProductBase):
    """Schema for creating a new product"""
    pass


class ProductResponse(ProductBase):
    """Schema for product response with additional fields"""
    id: int = Field(..., description="Product ID")
    is_active: bool = Field(default=True, description="Whether the product is active")

    model_config = ConfigDict(from_attributes=True)
