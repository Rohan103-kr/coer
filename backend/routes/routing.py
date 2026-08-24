from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from backend.services.routing import routing_service
from backend.services.gis import gis_service

router = APIRouter(prefix="/api", tags=["Routing"])

@router.get("/roads")
def get_roads(rainfall: float = Query(100.0)):
    return gis_service.get_evaluated_roads(rainfall)

@router.get("/route")
def calculate_route(
    origin: str = Query("N_IIT_ROORKEE", description="Start node ID"),
    destination: str = Query("N_HAR_KI_PAURI", description="Destination node ID"),
    rainfall: float = Query(100.0, description="24-hour rainfall level in mm"),
    lat: Optional[float] = Query(None, description="User live GPS latitude"),
    lon: Optional[float] = Query(None, description="User live GPS longitude")
):
    routes = routing_service.calculate_routes(origin, destination, rainfall, user_lat=lat, user_lon=lon)
    if not routes or not routes.get("fastest"):
        raise HTTPException(status_code=404, detail="No route path found between specified locations.")
    return {
        "origin": origin,
        "destination": destination,
        "rainfall_mm": rainfall,
        "routes": routes
    }
