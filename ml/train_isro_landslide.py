import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

def train_isro_landslide_models():
    print("=" * 60)
    print("🛰️ ISRO ATLAS (2023) + NASA SRTM 30m DEM ML MODEL TRAINING PIPELINE")
    print("=" * 60)
    
    csv_path = os.path.join(os.path.dirname(__file__), "..", "data", "isro_landslide_atlas_2023.csv")
    if not os.path.exists(csv_path):
        from database.build_isro_landslide_dataset import build_isro_landslide_dataset
        build_isro_landslide_dataset()

    df = pd.read_csv(csv_path)
    print(f"Dataset Loaded: {len(df)} ground-truth ISRO NRSC + NASA SRTM records across {df['district'].nunique()} high-density districts.")

    # Encoders
    le_region = LabelEncoder()
    df["region_code"] = le_region.fit_transform(df["geographic_region"])

    feature_cols = [
        "isro_atlas_rank", "region_code", "srtm_elevation_m", "srtm_slope_deg",
        "srtm_aspect_deg", "srtm_roughness_index", "srtm_topographic_wetness_index",
        "soil_thickness_m", "soil_saturation_pct", "vegetation_ndvi",
        "rainfall_1h_mm", "rainfall_24h_mm", "previous_7d_rainfall_mm"
    ]

    X = df[feature_cols]
    y = df["landslide_occurred"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 1. XGBoost / HistGB Model
    xgb_model = HistGradientBoostingClassifier(max_iter=160, random_state=42)
    xgb_model.fit(X_train, y_train)
    xgb_preds = xgb_model.predict(X_test)
    xgb_probs = xgb_model.predict_proba(X_test)[:, 1]

    # 2. Random Forest Model
    rf_model = RandomForestClassifier(n_estimators=120, random_state=42)
    rf_model.fit(X_train, y_train)
    rf_preds = rf_model.predict(X_test)
    rf_probs = rf_model.predict_proba(X_test)[:, 1]

    acc_x = accuracy_score(y_test, xgb_preds)
    roc_x = roc_auc_score(y_test, xgb_probs)

    acc_r = accuracy_score(y_test, rf_preds)
    roc_r = roc_auc_score(y_test, rf_probs)

    print(f"🤖 XGBoost / HistGB Classifier Accuracy: {acc_x * 100:.2f}% | ROC-AUC: {roc_x:.4f}")
    print(f"🤖 Random Forest Classifier Accuracy: {acc_r * 100:.2f}% | ROC-AUC: {roc_r:.4f}")

    feat_imp = dict(zip(feature_cols, rf_model.feature_importances_))

    save_dict = {
        "model": xgb_model,
        "rf_model": rf_model,
        "scaler": scaler,
        "le_region": le_region,
        "feature_cols": feature_cols,
        "metrics": {
            "XGBoost": {"Accuracy": round(float(acc_x), 4), "ROC-AUC": round(float(roc_x), 4)},
            "RandomForest": {"Accuracy": round(float(acc_r), 4), "ROC-AUC": round(float(roc_r), 4)}
        },
        "feature_importances": feat_imp,
        "dataset_name": "ISRO NRSC Landslide Atlas 2023 & NASA SRTM 30m DEM"
    }

    model_path = os.path.join(os.path.dirname(__file__), "..", "data", "isro_landslide_model.pkl")
    joblib.dump(save_dict, model_path)
    print(f"✅ ISRO + NASA SRTM Landslide Model saved successfully to: {model_path}")
    print("=" * 60)
    return save_dict

if __name__ == "__main__":
    train_isro_landslide_models()
