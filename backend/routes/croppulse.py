from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.services.croppulse_engine import croppulse_engine

router = APIRouter(prefix="/api/croppulse", tags=["CropPulse AI"])

class RecommendationRequest(BaseModel):
    location: str = "Haryana"
    land_acres: float = 5.0
    soil_type: str = "Loamy"
    water_access: str = "Medium"
    budget_inr: float = 60000.0
    rainfall_override_mm: Optional[float] = None

class WhatIfRequest(BaseModel):
    location: str = "Haryana"
    land_acres: float = 5.0
    soil_type: str = "Loamy"
    water_access: str = "Medium"
    budget_inr: float = 60000.0
    rainfall_mm: float = 600.0

@router.post("/recommend")
def get_crop_recommendation(req: RecommendationRequest):
    return croppulse_engine.recommend_crops(
        location=req.location,
        land_acres=req.land_acres,
        soil_type=req.soil_type,
        water_access=req.water_access,
        budget_inr=req.budget_inr,
        rainfall_override=req.rainfall_override_mm
    )

@router.get("/sell-timing")
def get_sell_timing(crop: str = Query("Mustard", description="Target Crop Name")):
    return croppulse_engine.get_sell_timing(crop)

@router.post("/what-if")
def run_what_if_simulation(req: WhatIfRequest):
    return croppulse_engine.recommend_crops(
        location=req.location,
        land_acres=req.land_acres,
        soil_type=req.soil_type,
        water_access=req.water_access,
        budget_inr=req.budget_inr,
        rainfall_override=req.rainfall_mm
    )
