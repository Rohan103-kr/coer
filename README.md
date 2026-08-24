# 🌧️ DrainMind AI - Roorkee & Haridwar Flood Resilience Platform

> **Predict → Explain → Route → Optimize**
>
> A ClimateTech AI/ML & GIS Decision Support System built for urban waterlogging prediction, SHAP explainable AI, flood-aware navigation, SWD bottleneck detection, and municipal budget intervention optimization.

---

## 🛠️ Quick Setup Guide for Team Members

Follow these 4 simple steps to run **DrainMind AI** on your local machine:

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/Rohan103-kr/coer.git
cd coer
```

### 2️⃣ Create Virtual Environment & Install Dependencies
```bash
# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
# On Mac/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install required packages
pip install -r requirements.txt
```

### 3️⃣ Generate Datasets & Train the ML Model
```bash
# Generate Roorkee & Haridwar GIS datasets & telemetry CSV
python database/seed_data.py
python database/build_roorkee_haridwar_dataset.py

# Train XGBoost / HistGB & Random Forest Flood Risk Models
export PYTHONPATH=.
python ml/train.py
```

### 4️⃣ Start the Server & Launch Web App
```bash
# Start FastAPI backend server with Uvicorn
python backend/main.py
```

Open your browser and navigate to:
👉 **`http://localhost:8000`**

---

## 🌟 Key Features

- **📡 Real-Time Open-Meteo Weather Integration**: Fetches live rainfall, temperature, and moisture telemetry for Roorkee & Haridwar.
- **🌧️ Monsoon Rainfall Simulator**: Interactive slider (0–250 mm) for live risk map re-evaluation.
- **🔍 Explainable AI (SHAP)**: Breakdown modal explaining exact percentage risk drivers per ward.
- **👤 Citizen Navigation Mode**: Multi-objective Dijkstra routing (Fastest, Safest, Balanced) with dynamic risk penalties and live citizen incident reporting.
- **🏛️ Municipal Decision Support Mode**: SWD bottleneck inference (Solani River & Canal Outfalls) and **Google OR-Tools Integer Programming budget optimizer**.

---

## 📁 Repository Folder Structure

```
coer/
├── frontend/             # Minimalist Web Interface (HTML, CSS, Leaflet JS)
│   ├── index.html
│   ├── css/style.css
│   └── js/ (map, citizen, municipal, simulator, app)
├── backend/              # FastAPI Backend Architecture
│   ├── main.py           # Entrypoint & WebSockets
│   ├── routes/           # REST Endpoints (prediction, routing, reports, optimization)
│   ├── models/           # XGBoost RiskEngine & SHAP attribution
│   └── services/         # GIS, Dijkstra Routing, Bottleneck & OR-Tools Optimizer
├── ml/                   # Machine Learning Pipeline
│   ├── train.py          # Model training & metrics evaluation
│   └── preprocessing.py  # Scalers & feature engineering
├── database/             # Hydro-Meteorological Dataset Generators
├── data/                 # GeoJSON Wards, Road Network & Training CSVs
├── requirements.txt      # Python dependencies
└── README.md
```
