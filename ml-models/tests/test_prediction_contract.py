"""Keep inference compatible with the stored training data and public claims."""

import csv
import importlib.util
from pathlib import Path

import pytest


ML_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def engine():
    spec = importlib.util.spec_from_file_location("prediction_contract_engine", ML_DIR / "predict.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def training_examples():
    """Expected categories/engineered values come from data, not duplicated code."""
    districts = {"Ampara", "Badulla", "Matale", "Monaragala"}
    examples = {}
    with (ML_DIR / "datasets" / "sri_lanka_flood_risk_modeled.csv").open() as dataset:
        for row in csv.DictReader(dataset):
            if row["district"] in districts and row["district"] not in examples:
                examples[row["district"]] = row
                if len(examples) == len(districts):
                    break
    assert set(examples) == districts
    return examples


def weather_inputs(row):
    values = {
        name: float(row[name])
        for name in (
            "precipitation_sum", "rain_sum", "temperature_2m_max",
            "wind_speed_10m_max", "rain_24h", "rain_48h", "rain_72h",
        )
    }
    values["soil_moisture_0_to_7cm"] = float(row["soil_moisture_0_to_7cm_mean"])
    values["soil_moisture_7_to_28cm"] = float(row["soil_moisture_7_to_28cm_mean"])
    return values


def test_derived_soil_index_matches_training_example(engine, training_examples):
    row = training_examples["Ampara"]
    result = engine.predict_disaster_risk(district=row["district"], **weather_inputs(row))

    assert result["status"] == "success"
    assert result["prediction"]["soil_saturation_index"] == pytest.approx(
        float(row["soil_saturation_index"]), abs=0.00005,
    )


@pytest.mark.parametrize("district", ["Badulla", "Matale", "Monaragala"])
def test_inferred_zone_matches_training_category(engine, training_examples, district):
    row = training_examples[district]
    result = engine.predict_disaster_risk(district=district, **weather_inputs(row))

    assert result["status"] == "success"
    assert result["climatic_zone"] == row["climatic_zone"]


def test_unknown_zone_is_rejected_instead_of_using_another_zone(engine):
    result = engine.predict_disaster_risk(district="Colombo", climatic_zone="Unknown coastal zone")

    assert "error" in result
    assert "prediction" not in result
    assert set(result["supported_climatic_zones"]) == {"Dry", "Intermediate", "Wet"}


@pytest.mark.parametrize("rainfall", [0.0, 75.0, 100.0, 150.0])
def test_predictions_do_not_fabricate_annual_rain_or_official_warnings(engine, rainfall):
    result = engine.predict_disaster_risk(
        district="Ratnapura", precipitation_sum=rainfall, rain_sum=rainfall,
        rain_24h=rainfall, rain_48h=rainfall * 2, rain_72h=rainfall * 3,
    )

    assert result["status"] == "success"
    assert "annual_rainfall_mm" not in result["prediction"]
    indicator = result["nbro_landslide_alert"]
    assert indicator["is_official_warning"] is False
    assert indicator["source"] == "project_rainfall_thresholds"
    public_text = " ".join([
        indicator["status"], indicator["message"], *result["actionable_guidance"],
    ]).lower()
    assert "nbro warning:" not in public_text
    assert "safe /" not in public_text
    assert "no widespread riverine flooding anticipated" not in public_text
