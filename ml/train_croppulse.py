import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, r2_score, mean_absolute_error

def train_croppulse_models():
    print("=" * 60)
    print("🌾 CROPPULSE AI — MULTI-MODEL ML PIPELINE TRAINING")
    print("=" * 60)
    
    csv_path = os.path.join(os.path.dirname(__file__), "..", "data", "croppulse_agricultural_dataset.csv")
    if not os.path.exists(csv_path):
        from database.build_croppulse_dataset import build_croppulse_dataset
        build_croppulse_dataset()

    df = pd.read_csv(csv_path)
    print(f"Dataset Loaded: {len(df)} records across 6 major Indian agricultural districts.")

    # Encoders
    le_soil = LabelEncoder()
    df["soil_code"] = le_soil.fit_transform(df["soil_type"])
    
    le_crop = LabelEncoder()
    df["crop_code"] = le_crop.fit_transform(df["crop"])

    # -------------------------------------------------------------
    # MODEL 1: Crop Suitability & Recommendation Classifier
    # -------------------------------------------------------------
    clf_features = ["nitrogen", "phosphorus", "potassium", "ph_level", "rainfall_mm", "temperature_c", "soil_code"]
    X_clf = df[clf_features]
    y_clf = df["crop_code"]

    X_train_c, X_test_c, y_train_c, y_test_c = train_test_split(X_clf, y_clf, test_size=0.2, random_state=42)
    
    rec_clf = HistGradientBoostingClassifier(max_iter=150, random_state=42)
    rec_clf.fit(X_train_c, y_train_c)
    acc_clf = accuracy_score(y_test_c, rec_clf.predict(X_test_c))
    print(f"🤖 Model 1 (Crop Recommendation Classifier) Accuracy: {acc_clf * 100:.2f}%")

    # -------------------------------------------------------------
    # MODEL 2: Crop Yield Predictor Regressor (q/acre)
    # -------------------------------------------------------------
    reg_features = ["crop_code", "soil_code", "nitrogen", "phosphorus", "potassium", "ph_level", "rainfall_mm", "temperature_c"]
    X_reg = df[reg_features]
    y_yield = df["yield_q_acre"]

    X_train_y, X_test_y, y_train_y, y_test_y = train_test_split(X_reg, y_yield, test_size=0.2, random_state=42)

    yield_reg = HistGradientBoostingRegressor(max_iter=150, random_state=42)
    yield_reg.fit(X_train_y, y_train_y)
    r2_y = r2_score(y_test_y, yield_reg.predict(X_test_y))
    mae_y = mean_absolute_error(y_test_y, yield_reg.predict(X_test_y))
    print(f"🤖 Model 2 (Yield Prediction Regressor) R² Score: {r2_y:.4f} | MAE: {mae_y:.2f} q/acre")

    # -------------------------------------------------------------
    # MODEL 3: Mandi Price Forecast Regressor (₹/q)
    # -------------------------------------------------------------
    y_price = df["mandi_price_per_q"]
    X_train_p, X_test_p, y_train_p, y_test_p = train_test_split(X_reg, y_price, test_size=0.2, random_state=42)

    price_reg = RandomForestRegressor(n_estimators=100, random_state=42)
    price_reg.fit(X_train_p, y_train_p)
    r2_p = r2_score(y_test_p, price_reg.predict(X_test_p))
    mae_p = mean_absolute_error(y_test_p, price_reg.predict(X_test_p))
    print(f"🤖 Model 3 (Mandi Price Forecast Regressor) R² Score: {r2_p:.4f} | MAE: ₹{mae_p:.2f} per quintal")

    # Save Pipeline Dict
    save_dict = {
        "rec_clf": rec_clf,
        "yield_reg": yield_reg,
        "price_reg": price_reg,
        "le_soil": le_soil,
        "le_crop": le_crop,
        "clf_features": clf_features,
        "reg_features": reg_features,
        "metrics": {
            "rec_clf_acc": round(float(acc_clf), 4),
            "yield_r2": round(float(r2_y), 4),
            "yield_mae": round(float(mae_y), 2),
            "price_r2": round(float(r2_p), 4),
            "price_mae": round(float(mae_p), 2)
        }
    }

    model_path = os.path.join(os.path.dirname(__file__), "..", "data", "croppulse_model.pkl")
    joblib.dump(save_dict, model_path)
    print(f"✅ CropPulse Multi-Model Pipeline saved successfully to: {model_path}")
    print("=" * 60)
    return save_dict

if __name__ == "__main__":
    train_croppulse_models()
