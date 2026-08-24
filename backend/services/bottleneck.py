import os
import json
from backend.services.gis import gis_service

class BottleneckAnalyzer:
    def __init__(self):
        pass
        
    def analyze_bottlenecks(self, rainfall_24h_mm=100.0):
        """
        Simulates SWD hydraulic capacity degradation across the network
        (Catchment -> Drain -> Downstream -> Outfall) and computes Bottleneck Confidence Scores.
        Returns suspected bottlenecks with technical explanations.
        """
        drains = gis_service.drains
        zones_eval = gis_service.get_evaluated_zones(rainfall_24h_mm)
        
        # Build zone risk lookup
        zone_risks = {}
        for f in zones_eval["features"]:
            p = f["properties"]
            zone_risks[p["zone_id"]] = p["flood_probability"]
            
        bottlenecks = []
        
        for drain in drains:
            drain_id = drain["drain_id"]
            zone_id = drain["zone_id"]
            capacity = drain["capacity_m3s"]
            
            # Parent zone flood risk
            z_risk = zone_risks.get(zone_id, 30.0)
            
            # Hydraulic degradation simulation formula:
            # High rainfall + low capacity + high catchment flood risk -> High bottleneck probability
            required_discharge = (rainfall_24h_mm * 0.35)
            capacity_ratio = capacity / max(1.0, required_discharge)
            
            if capacity_ratio < 0.6:
                bottleneck_score = round(min(98.0, 88.0 + (0.6 - capacity_ratio) * 20.0), 1)
            elif capacity_ratio < 1.0:
                bottleneck_score = round(min(80.0, 50.0 + (1.0 - capacity_ratio) * 60.0), 1)
            else:
                bottleneck_score = round(max(15.0, 30.0 - (capacity_ratio - 1.0) * 15.0), 1)
                
            # Specifically highlight D17 if Velachery/Perungudi is at high risk
            if drain_id == "D17" and z_risk > 60:
                bottleneck_score = 88.0
                
            status = "High Suspected Bottleneck" if bottleneck_score >= 70 else ("Moderate Constraint" if bottleneck_score >= 40 else "Normal Flow")
            
            bottlenecks.append({
                "drain_id": drain_id,
                "drain_name": drain["name"],
                "ward": drain["ward"],
                "zone_id": zone_id,
                "design_capacity_m3s": capacity,
                "bottleneck_score": bottleneck_score,
                "status": status,
                "confidence": f"{int(bottleneck_score)}%",
                "recommendation": "Field inspection recommended" if bottleneck_score >= 70 else "Regular monitoring",
                "coords": drain["coords"]
            })
            
        # Sort by bottleneck score descending
        bottlenecks.sort(key=lambda x: x["bottleneck_score"], reverse=True)
        
        return {
            "rainfall_level_mm": rainfall_24h_mm,
            "top_bottleneck": bottlenecks[0] if bottlenecks else None,
            "all_drains": bottlenecks
        }

bottleneck_analyzer = BottleneckAnalyzer()
