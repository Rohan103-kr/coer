from fastapi import APIRouter, Query
from pydantic import BaseModel
from backend.services.gis import gis_service
from backend.services.weather_service import live_weather_service
from backend.models.risk_engine import risk_engine

router = APIRouter(prefix="/api", tags=["Prediction & Real-Time Weather"])

class PredictRequest(BaseModel):
    rainfall_24h_mm: float = 100.0
    elevation: float = 3.5
    slope: float = 0.5
    drainage_density: float = 2.0
    built_up_percentage: float = 85.0
    distance_to_waterbody: float = 0.5
    historical_flood_frequency: float = 12.0

@router.get("/live-weather")
def get_live_weather():
    return live_weather_service.fetch_live_weather()

@router.get("/live-zones")
def get_live_zones():
    weather = live_weather_service.fetch_live_weather()
    rainfall_24h = weather["rainfall_24h_mm"]
    zones_geojson = gis_service.get_evaluated_zones(rainfall_24h)
    return {
        "weather_data": weather,
        "zones": zones_geojson
    }

@router.get("/zones")
def get_zones(rainfall: float = Query(100.0, description="24-hour rainfall level in mm")):
    return gis_service.get_evaluated_zones(rainfall)

@router.get("/model-metrics")
def get_model_metrics():
    risk_engine.load_model()
    return {
        "metrics": risk_engine.metrics,
        "active_model": "XGBoost Classifier (OpenCity Dataset)",
        "baseline_model": "Random Forest Classifier",
        "dataset": risk_engine.model_data.get("dataset_name", "OpenCity Chennai Flooding Dataset"),
        "feature_importances": risk_engine.model_data.get("feature_importances", {})
    }

@router.post("/predict")
def predict_custom_risk(req: PredictRequest):
    feat_dict = {
        "rainfall_1h": req.rainfall_24h_mm * 0.25,
        "rainfall_6h": req.rainfall_24h_mm * 0.60,
        "rainfall_24h": req.rainfall_24h_mm,
        "previous_rainfall": req.rainfall_24h_mm * 0.40,
        "elevation": req.elevation,
        "slope": req.slope,
        "drainage_density": req.drainage_density,
        "built_up_percentage": req.built_up_percentage,
        "distance_to_waterbody": req.distance_to_waterbody,
        "historical_flood_frequency": req.historical_flood_frequency
    }
    return risk_engine.predict_risk(feat_dict)
