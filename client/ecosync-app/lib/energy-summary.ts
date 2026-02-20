import AsyncStorage from "@react-native-async-storage/async-storage";
import { PredictResponse } from "@/lib/api";

const LAST_PREDICTION_KEY = "ecosync:lastPrediction";

export type StoredPrediction = {
  data: PredictResponse;
  updatedAt: number;
};

export async function saveLastPrediction(data: PredictResponse): Promise<void> {
  const payload: StoredPrediction = {
    data,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(LAST_PREDICTION_KEY, JSON.stringify(payload));
}

export async function loadLastPrediction(): Promise<StoredPrediction | null> {
  const raw = await AsyncStorage.getItem(LAST_PREDICTION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredPrediction;
    if (!parsed?.data) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
