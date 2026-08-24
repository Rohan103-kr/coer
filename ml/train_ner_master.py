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

def train_ner_master_pipeline():
    print("=" * 60)
    print("🏔️ MASTER 8-STATE NORTHEAST INDIA LANDSLIDE ML TRAINING")
    print("=" * 60)
    
    csv_path = os.path.join(os.path.dirname(__file__), "..", "data", "ner_landslide_master_dataset.csv")
    if not os.path.exists(csv_path):
        from database.build_ner_master_dataset import build_ner_master_dataset
        build_ner_master_dataset()

    df = pd.read_csv(csv_path)
    print(f"Master Dataset Loaded: {len(df)} records across 8 Northeast Indian States ({df['state'].nunique()} states, {df['district'].nunique()} districts).")

    # Encoders for Categorical Features (Bhuvan LULC, ICAR Soil, GSI Geology, State)
    le_state = LabelEncoder()
    df["state_code"] = le_state.fit_transform(df["state"])

    le_lulc = LabelEncoder()
    df["land_cover_code"] = le_lulc.fit_transform(df["land_cover"])

    le_soil = LabelEncoder()
    df["soil_code"] = le_soil.fit_transform(df["soil_type"])

    le_geology = LabelEncoder()
    df["geology_code"] = le_geology.fit_transform(df["geology"])

    feature_cols = [
        "state_code", "rainfall_24h", "rainfall_3day", "rainfall_7day", "rainfall_30day",
        "elevation", "slope", "aspect", "curvature", "land_cover_code",
        "soil_code", "geology_code", "historical_landslide_density"
    ]

    X = df[feature_cols]
    y = df["landslide"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 1. XGBoost / HistGB Model
    xgb_model = HistGradientBoostingClassifier(max_iter=180, max_depth=7, learning_rate=0.06, random_state=42)
    xgb_model.fit(X_train, y_train)
    xgb_preds = xgb_model.predict(X_test)
    xgb_probs = xgb_model.predict_proba(X_test)[:, 1]

    # 2. Random Forest Model
    rf_model = RandomForestClassifier(n_estimators=150, max_depth=8, random_state=42)
    rf_model.fit(X_train, y_train)
    rf_preds = rf_model.predict(X_test)
    rf_probs = rf_model.predict_proba(X_test)[:, 1]

    # Metrics Evaluation
    acc_x = accuracy_score(y_test, xgb_preds)
    prec_x = precision_score(y_test, xgb_preds)
    rec_x = recall_score(y_test, xgb_preds)
    f1_x = f1_score(y_test, xgb_preds)
    roc_x = roc_auc_score(y_test, xgb_probs)

    acc_r = accuracy_score(y_test, rf_preds)
    prec_r = precision_score(y_test, rf_preds)
    rec_r = recall_score(y_test, rf_preds)
    f1_r = f1_score(y_test, rf_preds)
    roc_r = roc_auc_score(y_test, rf_probs)

    print("\nModel Evaluation Table (Northeast India 8-State Test Set):")
    metrics_data = {
        "Model": ["XGBoost / HistGB", "Random Forest"],
        "Accuracy": [f"{acc_x*100:.2f}%", f"{acc_r*100:.2f}%"],
        "Precision": [f"{prec_x*100:.2f}%", f"{prec_r*100:.2f}%"],
        "Recall": [f"{rec_x*100:.2f}%", f"{rec_r*100:.2f}%"],
        "F1 Score": [f"{f1_x*100:.2f}%", f"{f1_r*100:.2f}%"],
        "ROC-AUC": [f"{roc_x:.4f}", f"{roc_r:.4f}"]
    }
    print(pd.DataFrame(metrics_data).to_string(index=False))
    print("=" * 60)

    feat_imp = dict(zip(feature_cols, rf_model.feature_importances_))

    save_dict = {
        "model": xgb_model,
        "rf_model": rf_model,
        "scaler": scaler,
        "encoders": {
            "state": le_state,
            "lulc": le_lulc,
            "soil": le_soil,
            "geology": le_geology
        },
        "feature_cols": feature_cols,
        "metrics": {
            "XGBoost": {"Accuracy": round(float(acc_x), 4), "ROC-AUC": round(float(roc_x), 4)},
            "RandomForest": {"Accuracy": round(float(acc_r), 4), "ROC-AUC": round(float(roc_r), 4)}
        },
        "feature_importances": feat_imp,
        "dataset_name": "Master 8-State Northeast India Landslide Dataset (GSI + ISRO + NASA SRTM + IMD + Bhuvan)"
    }

    model_path = os.path.join(os.path.dirname(__file__), "..", "data", "ner_master_landslide_model.pkl")
    joblib.dump(save_dict, model_path)
    print(f"✅ Master NER Landslide Model saved successfully to: {model_path}")
    print("=" * 60)
    return save_dict

if __name__ == "__main__":
    train_ner_master_pipeline()
