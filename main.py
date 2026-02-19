from fastapi import FastAPI
from pydantic import BaseModel, Field
import joblib
import numpy as np
import os

app = FastAPI(title="FusionSmart Energy API", version="1.0.0")


MODEL_PATH = os.getenv("MODEL_PATH", "Energy_Usage_Prediction_Model.pkl")

try:
    model = joblib.load(MODEL_PATH)
except Exception as e:
    raise RuntimeError(f"Failed to load model at '{MODEL_PATH}': {e}")


class PredictRequest(BaseModel):
    temperature: float = Field(..., ge=0, le=60)
    humidity: float = Field(..., ge=0, le=100)
    occupancy: int = Field(..., ge=0, le=20)

    ac: float = Field(..., ge=0)
    fan: float = Field(..., ge=0)
    fridge: float = Field(..., ge=0)
    plug: float = Field(..., ge=0)
    kitchen: float = Field(..., ge=0)
    pump: float = Field(..., ge=0)
    lighting: float = Field(..., ge=0)
    solar: float = Field(..., ge=0)


@app.get("/")
def root():
    return {"status": "ok", "service": "FusionSmart Energy API"}


@app.post("/predict")
def predict(req: PredictRequest):
    x = np.array([[
        req.temperature, req.humidity, req.occupancy,
        req.ac, req.fan, req.fridge, req.plug,
        req.kitchen, req.pump, req.lighting, req.solar,
        12, 15, 6  
    ]], dtype=float)

    pred = float(model.predict(x)[0])
    emission = pred * 0.82

    appliance_usage = {
        "AC": req.ac,
        "Fan": req.fan,
        "Fridge": req.fridge,
        "Plug": req.plug,
        "Kitchen": req.kitchen,
        "Pump": req.pump,
        "Lighting": req.lighting
    }
    highest_appliance = max(appliance_usage, key=appliance_usage.get)
    green_percent = (req.solar / pred) * 100 if pred > 0 else 0.0

    return {
        "predicted_kwh": round(pred, 4),
        "co2_kg": round(emission, 4),
        "highest_appliance": highest_appliance,
        "green_percent": round(green_percent, 2),
        "appliance_usage": appliance_usage
    }
