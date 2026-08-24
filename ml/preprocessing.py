import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

FEATURE_COLS = [
    "rainfall_1h",
    "rainfall_6h",
    "rainfall_24h",
    "previous_rainfall",
    "elevation",
    "slope",
    "drainage_density",
    "built_up_percentage",
    "distance_to_waterbody",
    "historical_flood_frequency"
]

TARGET_COL = "flooded"

def load_data(filepath):
    df = pd.read_csv(filepath)
    X = df[FEATURE_COLS]
    y = df[TARGET_COL]
    return df, X, y

def prepare_splits(X, y, test_size=0.2, random_state=42):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    return X_train, X_test, y_train, y_test, X_train_scaled, X_test_scaled, scaler
