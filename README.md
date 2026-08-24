# 🌾 CropPulse AI — Crop-to-Market Decision Intelligence Platform

> **Theme: AgriTech — Technology for Food Security**
>
> *"Farmer ko batao kya ugana hai, kab bechna hai, aur kitna profit expect karna hai."*
>
> An end-to-end AgriTech decision-intelligence system connecting soil, weather, yield predictions, Mandi price forecasting, risk-adjusted profit optimization, and what-if simulation.

---

## 🚀 Key Features

1. **🌱 Crop Advisor & Recommendation Engine**:
   - Evaluates candidate crops (Mustard, Wheat, Potato, Rice, Sugarcane, Maize) based on location (Haryana, Uttarakhand, Punjab, UP), soil NPK, pH, water access, and cultivation budget.
   - Calculates **Expected Yield (q/acre)**, **Total Revenue (₹)**, **Cultivation Cost (₹)**, **Expected Net Profit (₹)**, and **Risk-Adjusted Decision Score (0–100)**.

2. **📈 Sell Timing AI (Mandi Price Forecast)**:
   - 12-month Mandi price trajectory forecast powered by Agmarknet historical data.
   - Predicts optimal selling window (e.g. *March 12–25 @ ₹6,200/q vs Jan @ ₹5,100/q*) to maximize farmer revenue gain.

3. **🔥 What-If Climate & Monsoon Simulator**:
   - Interactive rainfall variation slider (300mm to 1200mm).
   - Live recalculation of crop profits and dynamic update of recommended crop choice!

4. **📄 Official PDF Farmer Advisory Exporter**:
   - One-click printable executive report for farmers containing profit metrics, Mandi price trajectories, and risk rankings.

5. **🌧️ DrainMind GIS Integration**:
   - Embedded GIS map view with live weather integration.

---

## 🛠️ Quick Setup Guide for Team Members

```bash
# 1. Clone Repository
git clone https://github.com/Rohan103-kr/coer.git
cd coer

# 2. Virtual Environment Setup
python3 -m venv venv
source venv/bin/activate

# 3. Install Dependencies
pip install -r requirements.txt

# 4. Generate Datasets & Train Models
python database/build_croppulse_dataset.py
export PYTHONPATH=.
python ml/train_croppulse.py

# 5. Start Server & Launch Web App
python backend/main.py
```

Navigate to: 👉 **`http://localhost:8000`**
