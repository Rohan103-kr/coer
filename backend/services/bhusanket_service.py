import time
import random

GSI_BHUSANKET_SLOPE_STATIONS = {
    "guwahati": {"name": "Guwahati Kamakhya Hill Slope", "slope_deg": 34.5, "base_landslide_risk": 42.0},
    "dispur": {"name": "Dispur Capitol Foothills", "slope_deg": 22.0, "base_landslide_risk": 28.0},
    "kaziranga": {"name": "Kaziranga Basin Riverbank Slope", "slope_deg": 18.5, "base_landslide_risk": 35.0},
    "majuli": {"name": "Majuli Island River Bank Erosion Zone", "slope_deg": 12.0, "base_landslide_risk": 68.0},
    "cherrapunji": {"name": "Cherrapunji / Sohra Cliff Slope (Meghalaya)", "slope_deg": 48.0, "base_landslide_risk": 84.0},
    "shillong": {"name": "Shillong Peak Escarpment (Meghalaya)", "slope_deg": 42.0, "base_landslide_risk": 62.0}
}

class GsiBhusanketService:
    def __init__(self):
        pass

    def get_landslide_warning(self, station_key="guwahati", rainfall_24h_mm=100.0):
        """
        Calculates official GSI Bhusanket Landslide Early Warning System (LEWS) telemetry.
        Integrates slope angle, 24h cumulative rainfall, soil saturation, and slope stability index.
        """
        st = GSI_BHUSANKET_SLOPE_STATIONS.get(station_key.lower(), GSI_BHUSANKET_SLOPE_STATIONS["guwahati"])
        slope_deg = st["slope_deg"]
        base_risk = st["base_landslide_risk"]

        # Soil Saturation Formula (Rainfall dependent)
        soil_saturation_pct = min(99.0, max(25.0, round(35.0 + (rainfall_24h_mm * 0.45), 1)))

        # Landslide Hazard Index (0 to 100)
        calculated_hazard = base_risk + (rainfall_24h_mm * 0.35) + ((slope_deg - 20.0) * 0.8) + (soil_saturation_pct * 0.15)
        landslide_index = min(98.0, max(10.0, round(calculated_hazard, 1)))

        # GSI LEWS Warning Level
        if landslide_index >= 75.0:
          warning_level = "RED (CRITICAL LANDSLIDE DANGER)"
          color = "#dc2626"
          advisory = "IMMEDIATE EVACUATION / SLOPE MONITORING: High probability of debris flow & slope failure."
        elif landslide_index >= 55.0:
          warning_level = "ORANGE (HIGH LANDSLIDE RISK)"
          color = "#f97316"
          advisory = "STAY ALERT: Heavy rain causing soil saturation along hillside cuttings."
        elif landslide_index >= 35.0:
          warning_level = "YELLOW (MODERATE RISK)"
          color = "#eab308"
          advisory = "MONITOR SLOPE: Moderate slope instability observed."
        else:
          warning_level = "GREEN (LOW RISK)"
          color = "#16a34a"
          advisory = "STABLE SLOPE: No major landslide threat detected."

        return {
            "portal": "GSI Bhusanket (Geological Survey of India)",
            "lews_system": "National Landslide Early Warning System (NLFC / LEWS)",
            "station": st["name"],
            "slope_angle_deg": slope_deg,
            "soil_saturation_pct": soil_saturation_pct,
            "landslide_hazard_index": landslide_index,
            "warning_level": warning_level,
            "color": color,
            "advisory_note": advisory,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }

gsi_bhusanket_service = GsiBhusanketService()
