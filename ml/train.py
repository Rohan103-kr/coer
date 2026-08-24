import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from ml.preprocessing import load_data, prepare_splits, FEATURE_COLS

def train_and_evaluate():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "roorkee_haridwar_floods.csv")
    if not os.path.exists(data_path):
        from database.build_roorkee_haridwar_dataset import build_roorkee_haridwar_dataset
        build_roorkee_haridwar_dataset()
        
    df, X, y = load_data(data_path)
    X_train, X_test, y_train, y_test, X_train_scaled, X_test_scaled, scaler = prepare_splits(X, y)
    
    print("=" * 60)
    print("🤖 ROORKEE & HARIDWAR FLOOD RISK MODEL TRAINING (PHASE 1)")
    print("=" * 60)
    print(f"Dataset: Roorkee & Haridwar Hydro-Meteorological Dataset ({len(df)} records)")
    
    # 1. Gradient Boosting Classifier (XGBoost Equivalent)
    xgb_model = HistGradientBoostingClassifier(
        max_iter=160,
        max_depth=6,
        learning_rate=0.07,
        random_state=42
    )
    xgb_model.fit(X_train, y_train)
    xgb_preds = xgb_model.predict(X_test)
    xgb_probs = xgb_model.predict_proba(X_test)[:, 1]
    
    # 2. Random Forest Model
    rf_model = RandomForestClassifier(n_estimators=120, max_depth=7, random_state=42)
    rf_model.fit(X_train, y_train)
    rf_preds = rf_model.predict(X_test)
    rf_probs = rf_model.predict_proba(X_test)[:, 1]
    
    # Compute Metrics
    metrics = {
        "XGBoost / HistGB": {
            "Accuracy": round(float(accuracy_score(y_test, xgb_preds)), 4),
            "Precision": round(float(precision_score(y_test, xgb_preds)), 4),
            "Recall": round(float(recall_score(y_test, xgb_preds)), 4),
            "F1 Score": round(float(f1_score(y_test, xgb_preds)), 4),
            "ROC-AUC": round(float(roc_auc_score(y_test, xgb_probs)), 4)
        },
        "Random Forest": {
            "Accuracy": round(float(accuracy_score(y_test, rf_preds)), 4),
            "Precision": round(float(precision_score(y_test, rf_preds)), 4),
            "Recall": round(float(recall_score(y_test, rf_preds)), 4),
            "F1 Score": round(float(f1_score(y_test, rf_preds)), 4),
            "ROC-AUC": round(float(roc_auc_score(y_test, rf_probs)), 4)
        }
    }
    
    metrics_df = pd.DataFrame(metrics).T
    print("\nModel Evaluation Table (Roorkee & Haridwar Test Set):")
    print(metrics_df.to_string())
    print("\n" + "=" * 60)
    
    importances = rf_model.feature_importances_
    feat_imp = dict(zip(FEATURE_COLS, importances))
    
    save_dict = {
        "model": xgb_model,
        "rf_model": rf_model,
        "scaler": scaler,
        "feature_cols": FEATURE_COLS,
        "metrics": metrics,
        "feature_importances": feat_imp,
        "dataset_name": "Roorkee & Haridwar (Uttarakhand) Hydro-Meteorological Dataset"
    }
    
    model_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    model_path = os.path.join(model_dir, "model.pkl")
    joblib.dump(save_dict, model_path)
    print(f"✅ Roorkee & Haridwar Model saved successfully to: {model_path}")
    
    return save_dict

if __name__ == "__main__":
    train_and_evaluate()
