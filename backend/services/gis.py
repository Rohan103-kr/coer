import json
import os
from backend.models.risk_engine import risk_engine

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")

class GISService:
    def __init__(self):
        self.zones_geojson = None
        self.roads = []
        self.drains = []
        self.citizen_reports = []
        self.road_override_risks = {}  # Dynamic risk overrides from citizen reports
        self.load_data()
        
    def load_data(self):
        zones_path = os.path.join(DATA_DIR, "chennai_zones.geojson")
        roads_path = os.path.join(DATA_DIR, "chennai_roads.json")
        drains_path = os.path.join(DATA_DIR, "chennai_drains.json")
        
        if not os.path.exists(zones_path) or not os.path.exists(roads_path):
            from database.seed_data import generate_zones_geojson, generate_roads, generate_drains, generate_ml_dataset
            generate_zones_geojson()
            generate_roads()
            generate_drains()
            generate_ml_dataset()
            
        with open(zones_path, "r") as f:
            self.zones_geojson = json.load(f)
            
        with open(roads_path, "r") as f:
            self.roads = json.load(f)
            
        with open(drains_path, "r") as f:
            self.drains = json.load(f)

    def get_evaluated_zones(self, rainfall_24h_mm=100.0):
        """
        Evaluates risk engine for all zones under the given rainfall level.
        Returns GeoJSON with computed properties (flood_probability, risk_level, explanations).
        """
        evaluated_features = []
        for feature in self.zones_geojson["features"]:
            props = feature["properties"].copy()
            
            # Map input parameters to feature dictionary
            feat_dict = {
                "rainfall_1h": round(rainfall_24h_mm * 0.25, 1),
                "rainfall_6h": round(rainfall_24h_mm * 0.60, 1),
                "rainfall_24h": rainfall_24h_mm,
                "previous_rainfall": round(rainfall_24h_mm * 0.40, 1),
                "elevation": props["elevation"],
                "slope": props["slope"],
                "drainage_density": props["drainage_density"],
                "built_up_percentage": props["built_up_percentage"],
                "distance_to_waterbody": props["distance_to_waterbody"],
                "historical_flood_frequency": props["historical_flood_count"]
            }
            
            risk_res = risk_engine.predict_risk(feat_dict)
            
            props["flood_probability"] = risk_res["flood_probability"]
            props["risk_level"] = risk_res["risk_level"]
            props["risk_color"] = risk_res["risk_color"]
            props["explanations"] = risk_res["explanations"]
            props["current_rainfall_mm"] = rainfall_24h_mm
            
            evaluated_features.append({
                "type": "Feature",
                "properties": props,
                "geometry": feature["geometry"]
            })
            
        return {
            "type": "FeatureCollection",
            "features": evaluated_features
        }

    def get_evaluated_roads(self, rainfall_24h_mm=100.0):
        """
        Evaluates flood risk for each road segment based on parent zone risk & citizen reports.
        """
        zones_map = {}
        eval_zones = self.get_evaluated_zones(rainfall_24h_mm)
        for f in eval_zones["features"]:
            p = f["properties"]
            zones_map[p["zone_id"]] = p["flood_probability"]
            
        eval_roads = []
        for road in self.roads:
            r = road.copy()
            parent_zone = r["zone_id"]
            base_risk = zones_map.get(parent_zone, 20.0)
            
            # Apply real-time citizen report override if available
            road_id = r["road_id"]
            if road_id in self.road_override_risks:
                effective_risk = self.road_override_risks[road_id]
                is_overridden = True
            else:
                effective_risk = base_risk
                is_overridden = False
                
            r["flood_probability"] = effective_risk
            r["is_overridden"] = is_overridden
            
            if effective_risk <= 30.0:
                r["status_color"] = "#16a34a"  # Green
            elif effective_risk <= 60.0:
                r["status_color"] = "#eab308"  # Yellow
            elif effective_risk <= 80.0:
                r["status_color"] = "#f97316"  # Orange
            else:
                r["status_color"] = "#dc2626"  # Red
                
            eval_roads.append(r)
            
        return eval_roads

    def add_citizen_report(self, report):
        """
        Appends citizen incident report and updates road segment risk.
        """
        self.citizen_reports.append(report)
        road_id = report.get("road_id")
        water_depth = report.get("water_depth", "Medium")
        passable = report.get("passable", True)
        
        if road_id:
            if not passable or water_depth == "High":
                new_risk = 95.0
            elif water_depth == "Medium":
                new_risk = 70.0
            else:
                new_risk = 45.0
            self.road_override_risks[road_id] = new_risk
            print(f"🚨 Dynamic Risk Update: Road {road_id} set to {new_risk}% risk via citizen report")
            
        return report

gis_service = GISService()
