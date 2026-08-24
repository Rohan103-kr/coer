from fastapi import APIRouter, Query, HTTPException
from backend.services.routing import routing_service
from backend.services.gis import gis_service

router = APIRouter(prefix="/api", tags=["Routing"])

@router.get("/roads")
def get_roads(rainfall: float = Query(100.0)):
    return gis_service.get_evaluated_roads(rainfall)

@router.get("/route")
def calculate_route(
    origin: str = Query("N_VELACHERY", description="Start node ID"),
    destination: str = Query("N_CENTRAL", description="Destination node ID"),
    rainfall: float = Query(100.0, description="24-hour rainfall level in mm")
):
    routes = routing_service.calculate_routes(origin, destination, rainfall)
    if not routes or not routes.get("fastest"):
        raise HTTPException(status_code=404, detail="No route path found between specified locations.")
    return {
        "origin": origin,
        "destination": destination,
        "rainfall_mm": rainfall,
        "routes": routes
    }
