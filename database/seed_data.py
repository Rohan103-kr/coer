import json
import os
import random
import pandas as pd
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)

# 1. Roorkee & Haridwar Zones Definition (Geospatial Polygons & Physical Properties)
ROORKEE_HARIDWAR_ZONES = [
    # --- ROORKEE ZONES ---
    {
        "zone_id": "ZONE-RK01",
        "name": "IIT Roorkee Campus",
        "ward": "Ward 04 - University",
        "center": [29.8649, 77.8965],
        "elevation": 268.0, # meters above sea level
        "slope": 0.8,      # degrees
        "built_up_percentage": 75.0,
        "green_cover": 22.0,
        "drainage_density": 2.8,
        "population": 28000,
        "historical_flood_count": 6,
        "distance_to_waterbody": 0.3, # Ganges Canal
        "hospitals": 2,
        "schools": 5,
        "coordinates": [
            [77.8880, 29.8720], [77.9040, 29.8720],
            [77.9040, 29.8580], [77.8880, 29.8580], [77.8880, 29.8720]
        ]
    },
    {
        "zone_id": "ZONE-RK02",
        "name": "Civil Lines Roorkee",
        "ward": "Ward 12 - Civil Lines",
        "center": [29.8580, 77.8880],
        "elevation": 265.0,
        "slope": 0.5,
        "built_up_percentage": 92.0,
        "green_cover": 5.0,
        "drainage_density": 1.6,
        "population": 45000,
        "historical_flood_count": 14,
        "distance_to_waterbody": 0.6,
        "hospitals": 4,
        "schools": 8,
        "coordinates": [
            [77.8800, 29.8640], [77.8940, 29.8640],
            [77.8940, 29.8500], [77.8800, 29.8500], [77.8800, 29.8640]
        ]
    },
    {
        "zone_id": "ZONE-RK03",
        "name": "Solani River Aqueduct Zone",
        "ward": "Ward 18 - Solani Bank",
        "center": [29.8780, 77.9100],
        "elevation": 260.0, # Low-lying river basin
        "slope": 0.3,
        "built_up_percentage": 68.0,
        "green_cover": 25.0,
        "drainage_density": 1.2, # High bottleneck area
        "population": 38000,
        "historical_flood_count": 19,
        "distance_to_waterbody": 0.1, # Solani River & Canal
        "hospitals": 1,
        "schools": 4,
        "coordinates": [
            [77.9000, 29.8860], [77.9200, 29.8860],
            [77.9200, 29.8700], [77.9000, 29.8700], [77.9000, 29.8860]
        ]
    },
    {
        "zone_id": "ZONE-RK04",
        "name": "Ganeshpur / Roorkee Railway Station",
        "ward": "Ward 08 - Ganeshpur",
        "center": [29.8450, 77.8800],
        "elevation": 262.5,
        "slope": 0.4,
        "built_up_percentage": 88.0,
        "green_cover": 8.0,
        "drainage_density": 1.8,
        "population": 52000,
        "historical_flood_count": 15,
        "distance_to_waterbody": 0.8,
        "hospitals": 3,
        "schools": 7,
        "coordinates": [
            [77.8700, 29.8520], [77.8900, 29.8520],
            [77.8900, 29.8380], [77.8700, 29.8380], [77.8700, 29.8520]
        ]
    },

    # --- HARIDWAR ZONES ---
    {
        "zone_id": "ZONE-HW01",
        "name": "Har Ki Pauri / Upper Canal Ghats",
        "ward": "Ward 01 - Har Ki Pauri",
        "center": [29.9560, 78.1700],
        "elevation": 294.0,
        "slope": 0.9,
        "built_up_percentage": 95.0,
        "green_cover": 3.0,
        "drainage_density": 2.2,
        "population": 65000,
        "historical_flood_count": 17,
        "distance_to_waterbody": 0.05, # Ganges River & Upper Canal
        "hospitals": 5,
        "schools": 10,
        "coordinates": [
            [78.1600, 29.9650], [78.1800, 29.9650],
            [78.1800, 29.9480], [78.1600, 29.9480], [78.1600, 29.9650]
        ]
    },
    {
        "zone_id": "ZONE-HW02",
        "name": "Jwalapur / Arya Nagar",
        "ward": "Ward 15 - Jwalapur",
        "center": [29.9280, 78.1150],
        "elevation": 286.0,
        "slope": 0.5,
        "built_up_percentage": 91.0,
        "green_cover": 6.0,
        "drainage_density": 1.5,
        "population": 85000,
        "historical_flood_count": 13,
        "distance_to_waterbody": 1.1,
        "hospitals": 6,
        "schools": 14,
        "coordinates": [
            [78.1050, 29.9360], [78.1250, 29.9360],
            [78.1250, 29.9200], [78.1050, 29.9200], [78.1050, 29.9360]
        ]
    },
    {
        "zone_id": "ZONE-HW03",
        "name": "BHEL Ranipur Township",
        "ward": "Ward 22 - Ranipur",
        "center": [29.9100, 78.0850],
        "elevation": 285.0,
        "slope": 0.7,
        "built_up_percentage": 70.0,
        "green_cover": 24.0,
        "drainage_density": 3.0,
        "population": 72000,
        "historical_flood_count": 7,
        "distance_to_waterbody": 2.2,
        "hospitals": 3,
        "schools": 12,
        "coordinates": [
            [78.0750, 29.9200], [78.0950, 29.9200],
            [78.0950, 29.9000], [78.0750, 29.9000], [78.0750, 29.9200]
        ]
    },
    {
        "zone_id": "ZONE-HW04",
        "name": "Kankhal / Sanyas Road",
        "ward": "Ward 09 - Kankhal Heritage",
        "center": [29.9350, 78.1450],
        "elevation": 288.0,
        "slope": 0.4,
        "built_up_percentage": 89.0,
        "green_cover": 8.0,
        "drainage_density": 1.7,
        "population": 58000,
        "historical_flood_count": 12,
        "distance_to_waterbody": 0.4,
        "hospitals": 4,
        "schools": 9,
        "coordinates": [
            [78.1350, 29.9430], [78.1550, 29.9430],
            [78.1550, 29.9270], [78.1350, 29.9270], [78.1350, 29.9430]
        ]
    },
    {
        "zone_id": "ZONE-HW05",
        "name": "Bahadrabad Canal Outflow",
        "ward": "Ward 28 - Bahadrabad",
        "center": [29.8950, 78.0350],
        "elevation": 275.0,
        "slope": 0.3,
        "built_up_percentage": 65.0,
        "green_cover": 28.0,
        "drainage_density": 1.4,
        "population": 42000,
        "historical_flood_count": 16,
        "distance_to_waterbody": 0.2, # Canal Outflow
        "hospitals": 2,
        "schools": 6,
        "coordinates": [
            [78.0250, 29.9050], [78.0450, 29.9050],
            [78.0450, 29.8850], [78.0250, 29.8850], [78.0250, 29.9050]
        ]
    }
]

def generate_zones_geojson():
    features = []
    for z in ROORKEE_HARIDWAR_ZONES:
        feature = {
            "type": "Feature",
            "properties": {
                "zone_id": z["zone_id"],
                "name": z["name"],
                "ward": z["ward"],
                "elevation": z["elevation"],
                "slope": z["slope"],
                "built_up_percentage": z["built_up_percentage"],
                "green_cover": z["green_cover"],
                "drainage_density": z["drainage_density"],
                "population": z["population"],
                "historical_flood_count": z["historical_flood_count"],
                "distance_to_waterbody": z["distance_to_waterbody"],
                "hospitals": z["hospitals"],
                "schools": z["schools"],
                "center": z["center"]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [z["coordinates"]]
            }
        }
        features.append(feature)
    
    geojson_data = {
        "type": "FeatureCollection",
        "features": features
    }
    
    with open(os.path.join(DATA_DIR, "chennai_zones.geojson"), "w") as f:
        json.dump(geojson_data, f, indent=2)
    print("Generated roorkee_haridwar_zones.geojson")

def generate_roads():
    # Key road segments connecting Roorkee & Haridwar (NH-58 Corridor & City Arterials)
    roads = [
        {"road_id": "R01", "name": "IIT Roorkee Main Gate Road", "start_node": "N_IIT_ROORKEE", "end_node": "N_CIVIL_LINES", "length_km": 1.8, "road_type": "Arterial", "base_time_min": 4.0, "start_coords": [29.8649, 77.8965], "end_coords": [29.8580, 77.8880], "zone_id": "ZONE-RK01"},
        {"road_id": "R02", "name": "NH-58 Highway (Roorkee to Bahadrabad)", "start_node": "N_CIVIL_LINES", "end_node": "N_BAHADRABAD", "length_km": 14.5, "road_type": "National Highway", "base_time_min": 18.0, "start_coords": [29.8580, 77.8880], "end_coords": [29.8950, 78.0350], "zone_id": "ZONE-RK02"},
        {"road_id": "R03", "name": "NH-58 Highway (Bahadrabad to Jwalapur)", "start_node": "N_BAHADRABAD", "end_node": "N_JWALAPUR", "length_km": 9.2, "road_type": "National Highway", "base_time_min": 12.0, "start_coords": [29.8950, 78.0350], "end_coords": [29.9280, 78.1150], "zone_id": "ZONE-HW05"},
        {"road_id": "R04", "name": "Haridwar Bypass (Jwalapur to Har Ki Pauri)", "start_node": "N_JWALAPUR", "end_node": "N_HAR_KI_PAURI", "length_km": 6.8, "road_type": "Expressway", "base_time_min": 9.0, "start_coords": [29.9280, 78.1150], "end_coords": [29.9560, 78.1700], "zone_id": "ZONE-HW01"},
        {"road_id": "R05", "name": "Roorkee Railway Station Link", "start_node": "N_CIVIL_LINES", "end_node": "N_GANESHPUR", "length_km": 2.2, "road_type": "Sub-arterial", "base_time_min": 5.0, "start_coords": [29.8580, 77.8880], "end_coords": [29.8450, 77.8800], "zone_id": "ZONE-RK04"},
        {"road_id": "R06", "name": "Solani River Canal Bank Road", "start_node": "N_IIT_ROORKEE", "end_node": "N_SOLANI_AQUEDUCT", "length_km": 3.2, "road_type": "Canal Road", "base_time_min": 6.5, "start_coords": [29.8649, 77.8965], "end_coords": [29.8780, 77.9100], "zone_id": "ZONE-RK03"},
        {"road_id": "R07", "name": "BHEL Township Sector Road", "start_node": "N_JWALAPUR", "end_node": "N_BHEL_RANIPUR", "length_km": 4.1, "road_type": "Sub-arterial", "base_time_min": 7.0, "start_coords": [29.9280, 78.1150], "end_coords": [29.9100, 78.0850], "zone_id": "ZONE-HW03"},
        {"road_id": "R08", "name": "Kankhal Heritage Ghat Road", "start_node": "N_JWALAPUR", "end_node": "N_KANKHAL", "length_km": 3.5, "road_type": "Heritage Road", "base_time_min": 7.5, "start_coords": [29.9280, 78.1150], "end_coords": [29.9350, 78.1450], "zone_id": "ZONE-HW04"},
        {"road_id": "R09", "name": "Upper Ganges Canal Express Corridor", "start_node": "N_SOLANI_AQUEDUCT", "end_node": "N_HAR_KI_PAURI", "length_km": 28.0, "road_type": "Express Corridor", "base_time_min": 32.0, "start_coords": [29.8780, 77.9100], "end_coords": [29.9560, 78.1700], "zone_id": "ZONE-HW01"},
        {"road_id": "R17", "name": "Solani Aqueduct Floodplain Bypass", "start_node": "N_IIT_ROORKEE", "end_node": "N_BAHADRABAD", "length_km": 15.2, "road_type": "Bypass Highway", "base_time_min": 20.0, "start_coords": [29.8649, 77.8965], "end_coords": [29.8950, 78.0350], "zone_id": "ZONE-RK03"}
    ]
    
    with open(os.path.join(DATA_DIR, "chennai_roads.json"), "w") as f:
        json.dump(roads, f, indent=2)
    print("Generated roorkee_haridwar_roads.json")

def generate_drains():
    # Stormwater Drainage Channels & Ganges Canal Networks for Roorkee & Haridwar
    drains = [
        {"drain_id": "D01", "name": "Solani River Canal Feeder", "ward": "Ward 18 - Solani Bank", "zone_id": "ZONE-RK03", "capacity_m3s": 42.0, "upstream": "Solani Aqueduct", "downstream": "D17", "coords": [[29.8780, 77.9100], [29.8650, 77.9250]]},
        {"drain_id": "D02", "name": "Civil Lines Main Nullah", "ward": "Ward 12 - Civil Lines", "zone_id": "ZONE-RK02", "capacity_m3s": 19.0, "upstream": "IIT Roorkee Boundary", "downstream": "Solani River", "coords": [[29.8580, 77.8880], [29.8700, 77.9000]]},
        {"drain_id": "D17", "name": "Solani Floodplain Outfall Arterial Drain", "ward": "Ward 18 - Solani Bank", "zone_id": "ZONE-RK03", "capacity_m3s": 38.0, "upstream": "D01", "downstream": "Ganges Main Channel", "coords": [[29.8650, 77.9250], [29.8500, 77.9400]]},
        {"drain_id": "D21", "name": "Upper Ganges Canal Spillway Drain", "ward": "Ward 01 - Har Ki Pauri", "zone_id": "ZONE-HW01", "capacity_m3s": 55.0, "upstream": "Bhimgoda Barrage", "downstream": "Ganges River", "coords": [[29.9560, 78.1700], [29.9450, 78.1800]]},
        {"drain_id": "D08", "name": "Jwalapur Old Canal Drain", "ward": "Ward 15 - Jwalapur", "zone_id": "ZONE-HW02", "capacity_m3s": 22.0, "upstream": "Arya Nagar Market", "downstream": "Kankhal Nullah", "coords": [[29.9280, 78.1150], [29.9200, 78.1300]]},
        {"drain_id": "D15", "name": "Bahadrabad Industrial Canal Drain", "ward": "Ward 28 - Bahadrabad", "zone_id": "ZONE-HW05", "capacity_m3s": 28.0, "upstream": "BHEL Industrial Outfall", "downstream": "Ganges Canal", "coords": [[29.8950, 78.0350], [29.8850, 78.0500]]}
    ]
    
    with open(os.path.join(DATA_DIR, "chennai_drains.json"), "w") as f:
        json.dump(drains, f, indent=2)
    print("Generated roorkee_haridwar_drains.json")

def generate_ml_dataset():
    # Build ML dataset adapted for Roorkee-Haridwar terrain and rainfall
    np.random.seed(42)
    random.seed(42)
    
    n_samples = 3000
    records = []
    
    for _ in range(n_samples):
        zone = random.choice(ROORKEE_HARIDWAR_ZONES)
        
        rainfall_1h = round(float(np.random.exponential(scale=15.0)), 1)
        rainfall_6h = round(rainfall_1h + float(np.random.exponential(scale=30.0)), 1)
        rainfall_24h = round(rainfall_6h + float(np.random.exponential(scale=50.0)), 1)
        previous_rainfall_3d = round(float(np.random.exponential(scale=70.0)), 1)
        
        elevation = zone["elevation"] + round(random.uniform(-1.0, 1.0), 2)
        slope = max(0.1, zone["slope"] + round(random.uniform(-0.1, 0.1), 2))
        drainage_density = max(0.5, zone["drainage_density"] + round(random.uniform(-0.2, 0.2), 2))
        built_up_percentage = min(98.0, max(50.0, zone["built_up_percentage"] + round(random.uniform(-3.0, 3.0), 1)))
        distance_to_waterbody = max(0.05, zone["distance_to_waterbody"] + round(random.uniform(-0.05, 0.05), 2))
        historical_flood_frequency = zone["historical_flood_count"]
        
        score = (
            (rainfall_24h * 0.38) +
            (rainfall_6h * 0.18) +
            (previous_rainfall_3d * 0.12) -
            ((elevation - 250.0) * 0.8) -
            (slope * 14.0) -
            (drainage_density * 7.0) +
            (built_up_percentage * 0.35) -
            (distance_to_waterbody * 20.0) +
            (historical_flood_frequency * 2.1)
        )
        
        prob = 1.0 / (1.0 + np.exp(-(score - 42.0) / 11.0))
        flooded = 1 if (prob > 0.48 or (rainfall_24h > 110 and elevation < 265.0)) else 0
        water_depth_cm = round(max(0.0, (prob - 0.2) * 85.0 + random.uniform(0, 8)), 1) if flooded else 0.0
        
        records.append({
            "rainfall_1h": rainfall_1h,
            "rainfall_6h": rainfall_6h,
            "rainfall_24h": rainfall_24h,
            "previous_rainfall": previous_rainfall_3d,
            "elevation": elevation,
            "slope": slope,
            "drainage_density": drainage_density,
            "built_up_percentage": built_up_percentage,
            "distance_to_waterbody": distance_to_waterbody,
            "historical_flood_frequency": historical_flood_frequency,
            "flooded": flooded,
            "water_depth_cm": water_depth_cm,
            "zone_id": zone["zone_id"]
        })
        
    df = pd.DataFrame(records)
    df.to_csv(os.path.join(DATA_DIR, "opencity_chennai_floods.csv"), index=False)
    print(f"Generated opencity_chennai_floods.csv with {n_samples} Roorkee-Haridwar records")

if __name__ == "__main__":
    generate_zones_geojson()
    generate_roads()
    generate_drains()
    generate_ml_dataset()
