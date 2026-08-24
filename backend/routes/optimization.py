from fastapi import APIRouter, Query
from pydantic import BaseModel
from backend.services.bottleneck import bottleneck_analyzer
from backend.services.optimizer import optimizer_service

router = APIRouter(prefix="/api", tags=["Municipal Decision Support"])

class OptimizeRequest(BaseModel):
    budget_lakhs: float = 10.0
    rainfall_24h_mm: float = 100.0

@router.get("/bottlenecks")
def get_bottlenecks(rainfall: float = Query(100.0)):
    return bottleneck_analyzer.analyze_bottlenecks(rainfall)

@router.post("/optimize")
def run_budget_optimizer(req: OptimizeRequest):
    return optimizer_service.optimize_plan(req.budget_lakhs, req.rainfall_24h_mm)
