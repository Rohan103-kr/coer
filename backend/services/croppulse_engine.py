import os
import joblib
import numpy as np

CROP_DETAILS = {
    "Mustard": {
        "cost_per_acre": 4200.0, "base_price_q": 5600.0, "risk_level": "Medium", "risk_penalty": 14,
        "peak_month": "March", "peak_window": "March 12–25", "peak_price_multiplier": 1.107,
        "price_trajectory": [5100, 5600, 6200, 5400, 5200, 5150, 5200, 5300, 5400, 5500, 5450, 5350],
        "opt_rain": (300, 600)
    },
    "Wheat": {
        "cost_per_acre": 5000.0, "base_price_q": 2275.0, "risk_level": "Low", "risk_penalty": 6,
        "peak_month": "April", "peak_window": "April 10–28", "peak_price_multiplier": 1.076,
        "price_trajectory": [2150, 2200, 2250, 2450, 2380, 2300, 2280, 2290, 2310, 2330, 2320, 2260],
        "opt_rain": (400, 750)
    },
    "Potato": {
        "cost_per_acre": 9200.0, "base_price_q": 1380.0, "risk_level": "High", "risk_penalty": 26,
        "peak_month": "February", "peak_window": "Feb 15–March 05", "peak_price_multiplier": 1.123,
        "price_trajectory": [1200, 1550, 1420, 1300, 1250, 1220, 1240, 1280, 1310, 1350, 1320, 1260],
        "opt_rain": (350, 600)
    },
    "Paddy (Rice)": {
        "cost_per_acre": 7800.0, "base_price_q": 2300.0, "risk_level": "Medium", "risk_penalty": 12,
        "peak_month": "November", "peak_window": "Nov 05–Nov 22", "peak_price_multiplier": 1.078,
        "price_trajectory": [2180, 2200, 2220, 2240, 2250, 2260, 2270, 2280, 2310, 2350, 2480, 2380],
        "opt_rain": (900, 1500)
    },
    "Sugarcane": {
        "cost_per_acre": 18500.0, "base_price_q": 355.0, "risk_level": "Low", "risk_penalty": 8,
        "peak_month": "January", "peak_window": "Jan 10–Feb 15", "peak_price_multiplier": 1.028,
        "price_trajectory": [365, 360, 355, 350, 350, 350, 350, 352, 355, 358, 360, 362],
        "opt_rain": (1000, 1600)
    },
    "Maize": {
        "cost_per_acre": 5200.0, "base_price_q": 2090.0, "risk_level": "Medium", "risk_penalty": 13,
        "peak_month": "October", "peak_window": "Oct 15–Nov 05", "peak_price_multiplier": 1.090,
        "price_trajectory": [1950, 1980, 2000, 2020, 2040, 2060, 2080, 2100, 2150, 2280, 2210, 2050],
        "opt_rain": (500, 900)
    }
}

class CropPulseEngine:
    def __init__(self):
        self.model_data = None
        self.load_models()

    def load_models(self):
        model_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "croppulse_model.pkl")
        if os.path.exists(model_path):
            try:
                self.model_data = joblib.load(model_path)
                print("🌾 CropPulse ML Models loaded successfully!")
            except Exception as e:
                print(f"Error loading CropPulse model: {e}")
        else:
            print(f"Warning: CropPulse model not found at {model_path}. Run ml/train_croppulse.py first.")

    def recommend_crops(self, location="Haryana", land_acres=5.0, soil_type="Loamy", water_access="Medium", budget_inr=60000.0, rainfall_override=None):
        """
        Executes Crop-to-Market Intelligence Evaluation across all candidate crops.
        """
        # Baseline rainfall & temperature by location
        location_defaults = {
            "Uttarakhand": {"rain": 950.0, "temp": 24.5, "npk": (80, 40, 40, 6.8)},
            "Haryana": {"rain": 700.0, "temp": 25.5, "npk": (90, 45, 45, 6.7)},
            "Punjab": {"rain": 650.0, "temp": 24.8, "npk": (100, 50, 40, 6.6)},
            "Uttar Pradesh": {"rain": 850.0, "temp": 25.2, "npk": (85, 40, 45, 6.9)}
        }
        
        loc_meta = location_defaults.get(location, location_defaults["Haryana"])
        rainfall = rainfall_override if rainfall_override is not None else loc_meta["rain"]
        temp = loc_meta["temp"]
        n, p, k, ph = loc_meta["npk"]

        # Water Access Adjustment
        if water_access == "High":
            rainfall *= 1.25
        elif water_access == "Rainfed":
            rainfall *= 0.75

        soil_code_map = {"Loamy": 0, "Clay": 1, "Sandy Loam": 2, "Alluvial": 3}
        s_code = soil_code_map.get(soil_type, 0)

        results = []

        for crop_name, info in CROP_DETAILS.items():
            cost_per_acre = info["cost_per_acre"]
            total_cost = round(cost_per_acre * land_acres, 0)

            # ML Predict Yield (or Physics Fallback)
            if self.model_data and "le_crop" in self.model_data and crop_name in self.model_data["le_crop"].classes_:
                c_code = int(self.model_data["le_crop"].transform([crop_name])[0])
                feat_vec = np.array([[c_code, s_code, n, p, k, ph, rainfall, temp]])
                predicted_yield_acre = float(self.model_data["yield_reg"].predict(feat_vec)[0])
                predicted_price_q = float(self.model_data["price_reg"].predict(feat_vec)[0])
            else:
                # Physics fallback
                r_min, r_max = info["opt_rain"]
                rain_mult = 1.1 if r_min <= rainfall <= r_max else (0.8 if rainfall < r_min else 0.85)
                predicted_yield_acre = (8.5 if crop_name == "Mustard" else 19.0) * rain_mult
                predicted_price_q = info["base_price_q"]

            predicted_yield_acre = round(max(2.0, predicted_yield_acre), 1)
            predicted_price_q = round(max(300.0, predicted_price_q), 0)
            
            # Peak Mandi price forecast during best selling window
            peak_price_q = round(predicted_price_q * info["peak_price_multiplier"], 0)
            
            total_yield_quintals = round(predicted_yield_acre * land_acres, 1)
            total_revenue = round(total_yield_quintals * peak_price_q, 0)
            net_profit = round(total_revenue - total_cost, 0)

            # Budget Feasibility Check
            within_budget = total_cost <= budget_inr

            # Risk-Adjusted Decision Score (0 - 100)
            # Profitability Score (70% weight) + Risk Score (30% weight)
            profit_per_acre = net_profit / max(1.0, land_acres)
            norm_profit_score = min(100.0, max(10.0, (profit_per_acre / 8000.0) * 80.0))
            
            risk_penalty = info["risk_penalty"]
            final_decision_score = round(max(20.0, norm_profit_score - risk_penalty + (10 if within_budget else -15)), 1)

            results.append({
                "crop": crop_name,
                "yield_per_acre": predicted_yield_acre,
                "total_yield_quintals": total_yield_quintals,
                "base_mandi_price": predicted_price_q,
                "peak_mandi_price": peak_price_q,
                "total_cost": total_cost,
                "total_revenue": total_revenue,
                "expected_profit": net_profit,
                "weather_risk": info["risk_level"],
                "decision_score": final_decision_score,
                "peak_month": info["peak_month"],
                "peak_window": info["peak_window"],
                "within_budget": within_budget,
                "price_trajectory": info["price_trajectory"]
            })

        # Sort crops by Risk-Adjusted Decision Score descending
        results.sort(key=lambda x: x["decision_score"], reverse=True)

        top_crop = results[0]
        top_crop["is_recommended"] = True

        return {
            "farmer_inputs": {
                "location": location,
                "land_acres": land_acres,
                "soil_type": soil_type,
                "water_access": water_access,
                "budget_inr": budget_inr,
                "simulated_rainfall_mm": round(rainfall, 1)
            },
            "recommended_crop": top_crop,
            "crop_comparison": results,
            "summary_text": f"Recommended Crop: {top_crop['crop']} ⭐ (Expected Net Profit: ₹{top_crop['expected_profit']:,.0f}, Decision Score: {top_crop['decision_score']}/100, Peak Selling Window: {top_crop['peak_window']})"
        }

    def get_sell_timing(self, crop_name="Mustard"):
        info = CROP_DETAILS.get(crop_name, CROP_DETAILS["Mustard"])
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        
        return {
            "crop": crop_name,
            "peak_month": info["peak_month"],
            "peak_window": info["peak_window"],
            "base_price": info["base_price_q"],
            "peak_expected_price": max(info["price_trajectory"]),
            "price_trajectory": [
                {"month": m, "price": p} for m, p in zip(months, info["price_trajectory"])
            ],
            "recommendation_note": f"Harvest crop in early {info['peak_month']}, store in warehouse for 2-3 weeks, and sell during {info['peak_window']} for maximum market profit!"
        }

croppulse_engine = CropPulseEngine()
