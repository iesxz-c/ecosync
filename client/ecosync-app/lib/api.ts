export const API_BASE = process.env.EXPO_PUBLIC_API_BASE;

if (!API_BASE) {
  throw new Error("Missing EXPO_PUBLIC_API_BASE in .env");
}

export type PredictPayload = {
  temperature: number;
  humidity: number;
  occupancy: number;
  ac: number;
  fan: number;
  fridge: number;
  plug: number;
  kitchen: number;
  pump: number;
  lighting: number;
  solar: number;
};

export type PredictResponse = {
  predicted_kwh: number;
  co2_kg: number;
  highest_appliance: string;
  green_percent: number;
  appliance_usage: Record<string, number>;
};

export async function predict(payload: PredictPayload): Promise<PredictResponse> {
  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Predict failed (${res.status}): ${text}`);
  }

  return res.json();
}