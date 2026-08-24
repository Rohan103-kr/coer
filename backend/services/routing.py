import networkx as nx
import math
from backend.services.gis import gis_service

class RoutingService:
    def __init__(self):
        pass

    def find_nearest_node(self, lat, lon):
        """Finds the closest road graph node for a given GPS latitude and longitude."""
        evaluated_roads = gis_service.get_evaluated_roads(100.0)
        best_node = "N_IIT_ROORKEE"
        min_dist = float("inf")

        for r in evaluated_roads:
            for node_key, coords in [("start_node", r["start_coords"]), ("end_node", r["end_coords"])]:
                node_id = r[node_key]
                d_lat = coords[0] - lat
                d_lon = coords[1] - lon
                dist = math.sqrt(d_lat * d_lat + d_lon * d_lon)
                if dist < min_dist:
                    min_dist = dist
                    best_node = node_id
        return best_node

    def calculate_routes(self, origin_node, destination_node, rainfall_24h_mm=100.0, user_lat=None, user_lon=None):
        """
        Calculates 3 flood-aware routes:
        1. ⚡ Fastest: Minimizes travel time
        2. 💧 Safest: Avoids waterlogged roads at all costs
        3. ⚖️ Balanced: Optimal trade-off between time and safety
        """
        # Resolve live GPS coordinates to closest road network node if needed
        if origin_node == "USER_LIVE_GPS" and user_lat is not None and user_lon is not None:
            origin_node = self.find_nearest_node(user_lat, user_lon)
        if destination_node == "USER_LIVE_GPS" and user_lat is not None and user_lon is not None:
            destination_node = self.find_nearest_node(user_lat, user_lon)

        evaluated_roads = gis_service.get_evaluated_roads(rainfall_24h_mm)
        
        # Build base graph
        G = nx.Graph()
        road_dict = {}
        
        for r in evaluated_roads:
            u = r["start_node"]
            v = r["end_node"]
            road_dict[r["road_id"]] = r
            
            # Base parameters
            t_base = r["base_time_min"]
            risk = r["flood_probability"]
            
            # Edge addition with dynamic cost multipliers
            G.add_edge(
                u, v,
                road_id=r["road_id"],
                road_name=r["name"],
                length=r["length_km"],
                t_base=t_base,
                risk=risk,
                start_coords=r["start_coords"],
                end_coords=r["end_coords"]
            )

        routes_output = {}
        
        mode_configs = {
            "fastest": {"penalty": 0.8, "label": "⚡ Fastest", "description": "Minimizes travel time"},
            "balanced": {"penalty": 4.5, "label": "⚖️ Balanced", "description": "Optimal trade-off between time & safety"},
            "safest": {"penalty": 18.0, "label": "💧 Safest", "description": "Prioritizes flood-free roads"}
        }

        for mode_key, cfg in mode_configs.items():
            penalty = cfg["penalty"]
            
            def weight_fn(u, v, d):
                time = d["t_base"]
                risk = d["risk"]
                return time * (1.0 + ((risk / 100.0) ** 1.8) * penalty)
                
            try:
                path_nodes = nx.dijkstra_path(G, origin_node, destination_node, weight=weight_fn)
                
                path_edges = []
                total_time = 0.0
                total_length = 0.0
                risks = []
                coords_line = []
                
                for i in range(len(path_nodes) - 1):
                    u = path_nodes[i]
                    v = path_nodes[i + 1]
                    edge_data = G[u][v]
                    
                    total_time += edge_data["t_base"]
                    total_length += edge_data["length"]
                    risks.append(edge_data["risk"])
                    
                    if i == 0:
                        coords_line.append(edge_data["start_coords"])
                    coords_line.append(edge_data["end_coords"])
                    
                    path_edges.append({
                        "road_id": edge_data["road_id"],
                        "name": edge_data["road_name"],
                        "flood_probability": edge_data["risk"]
                    })
                    
                avg_risk = round(sum(risks) / len(risks), 1) if risks else 0.0
                max_risk = round(max(risks), 1) if risks else 0.0
                
                routes_output[mode_key] = {
                    "mode": mode_key,
                    "label": cfg["label"],
                    "description": cfg["description"],
                    "nodes": path_nodes,
                    "edges": path_edges,
                    "coordinates": coords_line,
                    "travel_time_min": round(total_time, 1),
                    "length_km": round(total_length, 1),
                    "avg_flood_risk": avg_risk,
                    "max_flood_risk": max_risk,
                    "is_recommended": (mode_key == "safest" if avg_risk > 30 else mode_key == "balanced")
                }
            except (nx.NetworkXNoPath, KeyError):
                routes_output[mode_key] = None

        return routes_output

routing_service = RoutingService()
