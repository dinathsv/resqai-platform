# ResQAI: Sri Lanka Disaster & Flood Prediction ML Service 🇱🇰 🤖

This service provides district-based flood risk estimates and project rainfall-threshold landslide screening. It does not fetch or issue official NBRO/DMC warnings.

---

## 🌟 Overview & Sri Lankan Context

Sri Lanka experiences distinct monsoon seasons that drive severe localized disasters:
1. **Southwest Monsoon (SWM / Yala)**: May to September — heavy precipitation impacting the Western, Sabaragamuwa, Central, and Southern wet zones.
2. **Northeast Monsoon (NEM / Maha)**: December to February — precipitation across Eastern, Northern, and North-Central dry zones.
3. **Intermonsoon Depressions**: March–April & October–November — intense convective downpours triggering flash floods and hill country slope failures.

The models use daily weather, 24/48/72-hour rainfall totals, and district profiles. Their reported test metrics describe a random split of a modeled dataset, not validated real-event forecast accuracy. Automatic weather integration does not change that limitation.

## Automatic district/GPS assessment

Ordinary users select a district, optionally use GPS for the weather location,
and request an assessment without entering rainfall:

```http
POST /predict/automatic
Content-Type: application/json

{"district":"Colombo"}
```

Optional coordinates must be supplied together:

```json
{"district":"Colombo","latitude":6.9271,"longitude":79.8612}
```

The user explicitly confirms the district used by the model. Coordinates select
weather inputs; this endpoint does not infer administrative boundaries from GPS.
Without GPS, it uses a representative district point, not a district-wide average.

The server fetches [Open-Meteo ECMWF weather](https://open-meteo.com/en/docs/ecmwf-api)
using the pinned `ecmwf_ifs025` model, millimetres, Celsius, km/h, and the exact
0–7cm/7–28cm soil layers required by the existing model. Provider grid coordinates
are returned separately from requested coordinates; the model grid is approximately
25km, so this is not a measurement at the user's precise location.

The assessment uses the **latest complete calendar day in Asia/Colombo**. It is
a recent-weather estimate, not today's live conditions or a future forecast.
`weather.period_start`/`period_end` identify this 24-hour window; 48/72-hour totals
extend backwards from the same ending midnight. Precipitation and rain are
preceding-hour amounts, summed over interval endings `(start,end]`; instantaneous
temperature, wind and soil moisture use samples `[start,end)`. Temperature/wind
use maxima, soil moisture uses daily means, and soil saturation uses the training
dataset's formula `0.6 * top + 0.4 * deep`. The dataset does not document its
original timezone or source; these aggregation choices are explicit deployment
conventions and require separate event/date-based validation for real forecasting.

Responses include `mode`, `assessment`, requested `location`, and weather source,
grid coordinates, date, time window, fetched/expiry timestamps, cache flag, and
the numeric model inputs. Cache lifetime is15minutes, capped at local midnight;
expired data is not reused after provider failures. Outbound requests and the
in-process cache are bounded. Each worker has its own cache.

Missing hours, null/non-finite fields, wrong units, invalid responses, timeouts,
and provider errors return `503` with `detail.code = "weather_unavailable"`.
They never fall back to zero rainfall or default soil values. Genuine zero rain
is valid when all required data is present. No database migration or API key is
needed for the student prototype. Open-Meteo's public endpoint is for
[non-commercial use and has limits](https://open-meteo.com/en/pricing); commercial
deployment requires the appropriate provider licence and endpoint configuration.

`POST /predict` remains a manual demonstration endpoint with defaults for omitted
inputs. Legacy monthly/annual rainfall inputs are accepted for compatibility but
ignored. No annual rainfall figure is fabricated from a daily total.

---

## 📂 Repository Structure

```
ml-models/
├── datasets/
│   ├── sri_lanka_districts.csv            # Master profile: 25 districts, provinces, river basins & hazard zones
│   └── sri_lanka_flood_risk_modeled.csv   # 91,325 daily weather & flood risk records (2015–2024)
├── notebooks/
│   └── sri_lanka_disaster_prediction.ipynb # Interactive EDA, training, and evaluation notebook
├── models/
│   ├── sri_lanka_district_encoder.joblib  # LabelEncoder for all 25 Sri Lankan districts
│   ├── sri_lanka_climatic_zone_encoder.joblib # LabelEncoder for climatic zones (Wet, Dry, Intermediate)
│   ├── sri_lanka_flood_model.joblib       # Random Forest Flood Category Classifier (99.46% accuracy)
│   ├── sri_lanka_flood_risk_model.joblib  # Random Forest Flood Risk Score Regressor (R²: 0.9981, MAE: 0.10)
│   └── model_metadata.json                # Feature and accuracy metadata
├── train.py                               # Automated training & export pipeline
├── predict.py                             # Flood estimate and project rainfall thresholds
├── weather.py                             # Automatic weather collection, validation and cache
├── api.py                                 # FastAPI REST microservice
├── requirements.txt                       # Python dependencies
└── README.md                              # Documentation
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

## ⛰️ Project Landslide Rainfall Thresholds

For hill-slope districts (*Ratnapura, Kegalle, Nuwara Eliya, Badulla, Kandy, Matale, Kalutara, Galle, Matara*):

- 🟡 **Level1**: assessment-day rainfall at least75mm.
- 🟠 **Level2**: assessment-day rainfall at least100mm.
- 🔴 **Level3**: assessment-day rainfall at least150mm.

These are project rule estimates. They do not represent an issued NBRO warning;
follow current official instructions and local conditions. The legacy response
key `nbro_landslide_alert` is retained for client compatibility and contains
`is_official_warning: false` and `source: "project_rainfall_thresholds"`.

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
    precipitation_sum=140.0,
    rain_sum=140.0,
    soil_moisture_0_to_7cm=0.52,
    soil_moisture_7_to_28cm=0.50,
    temperature_2m_max=26.0,
    wind_speed_10m_max=18.5,
    rain_24h=140.0,
    rain_48h=250.0,
    rain_72h=350.0
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
- `POST /predict/automatic` — Recent complete-day assessment with automatic weather.
- `POST /predict` — Manual demonstration of flood/rainfall-threshold estimates:
  ```json
  {
    "district": "Colombo",
    "precipitation_sum": 185.0,
    "rain_sum": 185.0,
    "soil_moisture_0_to_7cm": 0.48,
    "soil_moisture_7_to_28cm": 0.45,
    "temperature_2m_max": 27.5,
    "wind_speed_10m_max": 22.0,
    "rain_24h": 185.0,
    "rain_48h": 310.0,
    "rain_72h": 420.0
  }
  ```

Run isolated regression tests from the repository root (pytest and
pytest-asyncio are development dependencies):

```bash
.venv/bin/python -m pytest -q ml-models/tests
```

---

## 📞 Sri Lanka Emergency Hotlines

- **Disaster Management Centre (DMC) 24/7 Hotline**: `117`
- **Suwa Seriya Pre-Hospital Ambulance**: `1990`
- **Sri Lanka Police Emergency**: `119`
- **NBRO Landslide Early Warning Centre**: `011-2588946` / `011-2588949`
- **Department of Meteorology**: `011-2676493`
