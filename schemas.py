from pydantic import BaseModel, Field
from typing import List

class UserInfo(BaseModel):
    """Defines the schema and validation for user physical data."""
    weight_kg: float = Field(..., gt=0, description="Weight in kilograms, must be positive")
    height_cm: float = Field(..., gt=0, description="Height in centimeters, must be positive")
    age: int = Field(..., gt=17, description="Age in years, must be 18 or greater")
    gender: str

class Drink(BaseModel):
    """Defines the schema for a single drink event."""
    drinkType: str | None = None # Making it optional for now
    alcohol_grams: float = Field(..., gt=0, description="Alcohol content in grams, must be positive")
    timestamp: str # ISO 8601 format string
    size: str | None = None # Add size field

class CalculationPayload(BaseModel):
    """Defines the schema for the main API request body."""
    userInfo: UserInfo
    drinks: List[Drink]
