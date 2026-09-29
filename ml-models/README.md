# ResQAI: Sri Lanka Disaster & Flood Prediction ML Service 🇱🇰 🤖

This repository provides dedicated Machine Learning models, curated datasets, and prediction pipelines tailored for **Sri Lankan disaster risk management**, with a focus on **monsoonal river floods** and **NBRO landslide hazard early warnings**.

---

## 🌟 Overview & Sri Lankan Context

Sri Lanka experiences distinct monsoon seasons that drive severe localized disasters:
1. **Southwest Monsoon (SWM / Yala)**: May to September — heavy precipitation impacting the Western, Sabaragamuwa, Central, and Southern wet zones.
2. **Northeast Monsoon (NEM / Maha)**: December to February — precipitation across Eastern, Northern, and North-Central dry zones.
3. **Intermonsoon Depressions**: March–April & October–November — intense convective downpours triggering flash floods and hill country slope failures.

This ML service analyzes cumulative and peak 24-hour rainfall against geographic river basins and official **NBRO (National Building Research Organisation)** early warning thresholds.

---

## 📂 Repository Structure

```
ml-models/
├── datasets/
│   ├── sri_lanka_districts.csv                # Master profile: 25 districts, provinces, river basins & hazard zones
│   └── sri_lanka_flood_landslide_history.csv  # 1995–2024 Sri Lankan rainfall and disaster occurrence records
├── notebooks/
│   └── sri_lanka_disaster_prediction.ipynb    # Interactive EDA, training, and evaluation notebook
├── models/
│   ├── sri_lanka_district_encoder.joblib      # LabelEncoder for all 25 Sri Lankan districts
│   ├── sri_lanka_flood_model.joblib           # Trained Random Forest classifier (93.3% accuracy)
│   ├── sri_lanka_hazard_model.joblib          # Multi-hazard index classifier (97.3% accuracy)
│   └── model_metadata.json                    # Feature and accuracy metadata
├── train.py                                   # Automated training & export pipeline
├── predict.py                                 # Core prediction engine (Flood risk + NBRO alerts)
├── api.py                                     # FastAPI REST microservice
├── requirements.txt                           # Python dependencies
└── README.md                                  # Documentation
```

---

## 🌊 Major River Basins Covered

| River Basin | Key Affected Districts | Major Gauge Stations |
| :--- | :--- | :--- |
| **Kelani Ganga** | Colombo, Gampaha, Kegalle | Nagalagam Street, Hanwella, Glencorse |
| **Kalu Ganga** | Ratnapura, Kalutara | Putupaula, Ellagawa, Ratnapura, Millakanda |
| **Gin Ganga** | Galle | Baddegama, Tawalama |
| **Nilwala Ganga** | Matara | Thalgahagoda, Panadugama |
| **Mahaweli Ganga** | Kandy, Matale, Polonnaruwa, Trincomalee | Peradeniya, Nawalapitiya, Manampitiya |
| **Deduru Oya** | Kurunegala, Puttalam | Chilaw, Ridi Bendi Ela |

---

## ⛰️ Official NBRO Landslide Alert Thresholds

For hill-slope districts (*Ratnapura, Kegalle, Nuwara Eliya, Badulla, Kandy, Matale, Kalutara, Galle, Matara*):

- 🟡 **Level 1 (Yellow - Watch / Alert)**: 24-hour rainfall exceeds **75 mm**. Stay vigilant for mud puddles, tilting trees, or surface cracks.
- 🟠 **Level 2 (Amber - Warning)**: 24-hour rainfall exceeds **100 mm**. Be ready to evacuate immediately if heavy rains continue.
- 🔴 **Level 3 (Red - Evacuation)**: 24-hour rainfall exceeds **150 mm** (or continuous >75mm with slope cracks). Immediately evacuate designated slope zones to safe relief shelters.

---

## 🚀 Quickstart & Usage

### 1. Installation
```bash
cd ml-models
pip install -r requirements.txt
```

### 2. Retrain the Models
```bash
python train.py
```

### 3. Run Predictions from Python
```python
from predict import predict_disaster_risk

result = predict_disaster_risk(
    district="Ratnapura",
    monthly_rainfall={"MAY": 480.0, "JUN": 390.0, "NOV": 350.0},
    peak_24h_rain=135.0
)
print(result)
```

### 4. Run the REST API Microservice
```bash
python api.py
# Server runs on http://0.0.0.0:5005
```

#### API Endpoints:
- `GET /health` — Service health and district count
- `GET /districts` — Returns list of all 25 supported Sri Lankan districts
- `POST /predict` — Evaluates flood and landslide hazard:
  ```json
  {
    "district": "Colombo",
    "monthly_rainfall": {
      "MAY": 450.0,
      "JUN": 420.0
    },
    "peak_24h_rain_mm": 175.0
  }
  ```

---

## 📞 Sri Lanka Emergency Hotlines

- **Disaster Management Centre (DMC) 24/7 Hotline**: `117`
- **Suwa Seriya Pre-Hospital Ambulance**: `1990`
- **Sri Lanka Police Emergency**: `119`
- **NBRO Landslide Early Warning Centre**: `011-2588946` / `011-2588949`
- **Department of Meteorology**: `011-2676493`
