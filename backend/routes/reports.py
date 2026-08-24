import time
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from backend.services.gis import gis_service

router = APIRouter(prefix="/api", tags=["Citizen Incident Reports"])

class CitizenReportModel(BaseModel):
    user_name: Optional[str] = "Anonymous Citizen"
    latitude: float
    longitude: float
    road_id: Optional[str] = "R01"
    water_depth: str = "Medium"  # Low, Medium, High
    passable: bool = False
    comment: Optional[str] = ""

@router.get("/reports")
def get_all_reports():
    return gis_service.citizen_reports

@router.post("/report")
def create_report(report: CitizenReportModel):
    rep_dict = report.dict()
    rep_dict["timestamp"] = int(time.time())
    rep_dict["report_id"] = f"REP-{len(gis_service.citizen_reports) + 1:04d}"
    
    saved_report = gis_service.add_citizen_report(rep_dict)
    return {
        "status": "success",
        "message": "Waterlogging incident report submitted successfully. Road risk metrics updated.",
        "report": saved_report
    }
