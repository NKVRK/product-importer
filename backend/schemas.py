from pydantic import BaseModel, Field, ConfigDict, HttpUrl
from typing import Optional
from datetime import datetime


class ProductBase(BaseModel):
    """Base schema for Product with common fields"""
    sku: str = Field(..., min_length=1, max_length=255, description="Unique product SKU")
    name: str = Field(..., min_length=1, max_length=500, description="Product name")
    description: Optional[str] = Field(None, description="Product description")


class ProductCreate(ProductBase):
    """Schema for creating/updating a product"""
    is_active: bool = Field(default=True, description="Whether the product is active")


class ProductResponse(ProductBase):
    """Schema for product response with additional fields"""
    id: int = Field(..., description="Product ID")
    is_active: bool = Field(default=True, description="Whether the product is active")

    model_config = ConfigDict(from_attributes=True)


# Webhook Schemas
class WebhookCreate(BaseModel):
    """Schema for creating a webhook"""
    url: str = Field(..., min_length=1, max_length=2048, description="Webhook URL")
    event_type: str = Field(default="import.completed", description="Event type that triggers webhook")
    is_active: bool = Field(default=True, description="Whether webhook is active")


class WebhookUpdate(BaseModel):
    """Schema for updating a webhook"""
    url: Optional[str] = Field(None, min_length=1, max_length=2048, description="Webhook URL")
    event_type: Optional[str] = Field(None, description="Event type")
    is_active: Optional[bool] = Field(None, description="Whether webhook is active")


class WebhookResponse(BaseModel):
    """Schema for webhook response"""
    id: int = Field(..., description="Webhook ID")
    url: str = Field(..., description="Webhook URL")
    event_type: str = Field(..., description="Event type")
    is_active: bool = Field(..., description="Whether webhook is active")
    created_at: datetime = Field(..., description="Creation timestamp")

    model_config = ConfigDict(from_attributes=True)
