import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { predict, PredictPayload, PredictResponse } from "@/lib/api";
import { loadLastPrediction, saveLastPrediction } from "@/lib/energy-summary";

const THEME = {
  bg: "#FFFFFF",
  card: "#F9F9F9",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
};

export default function Index() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<PredictResponse | null>(null);

  const defaultInput = useMemo<PredictPayload>(() => ({
    temperature: 32,
    humidity: 70,
    occupancy: 4,
    ac: 2,
    fan: 0.3,
    fridge: 0.1,
    plug: 0.5,
    kitchen: 0.7,
    pump: 0.2,
    lighting: 0.3,
    solar: 0.5,
  }), []);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await predict(defaultInput);
      setSummary(data);
      await saveLastPrediction(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load summary";
      Alert.alert("Home summary error", message);
    } finally {
      setIsLoading(false);
    }
  }, [defaultInput]);

  const syncSummaryFromStorage = useCallback(async () => {
    try {
      const stored = await loadLastPrediction();
      if (stored?.data) {
        setSummary(stored.data);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const hasStored = await syncSummaryFromStorage();
      if (!hasStored) {
        await loadSummary();
      }
    })();
  }, [loadSummary, syncSummaryFromStorage]);

  useFocusEffect(
    useCallback(() => {
      syncSummaryFromStorage();
    }, [syncSummaryFromStorage]),
  );

  const topThree = useMemo(() => {
    if (!summary) return [] as [string, number][];
    return Object.entries(summary.appliance_usage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [summary]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Ionicons name="home-outline" size={24} color={THEME.text} />
          <Text style={styles.title}>Home</Text>
        </View>

        <Text style={styles.subtitle}>
          Quick snapshot of your energy profile. Open Analysis for full controls and charts.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardRowBetween}>
            <View style={styles.cardRow}>
              <Ionicons name="analytics-outline" size={18} color={THEME.text} />
              <Text style={styles.cardTitle}>Today Summary</Text>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadSummary} disabled={isLoading}>
              <Ionicons name="refresh-outline" size={14} color={THEME.text} />
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {isLoading && !summary ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator size="small" color={THEME.text} />
              <Text style={styles.cardText}>Loading summary...</Text>
            </View>
          ) : null}

          {summary ? (
            <View style={styles.kpiGrid}>
              <KpiCard icon="flash-outline" label="Predicted Energy" value={`${summary.predicted_kwh.toFixed(2)} kWh`} />
              <KpiCard icon="leaf-outline" label="CO₂ Emission" value={`${summary.co2_kg.toFixed(2)} kg`} />
              <KpiCard icon="trophy-outline" label="Top Appliance" value={summary.highest_appliance} />
              <KpiCard icon="sunny-outline" label="Solar Offset" value={`${summary.green_percent.toFixed(1)}%`} />
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="list-outline" size={18} color={THEME.text} />
            <Text style={styles.cardTitle}>Top Usage Highlights</Text>
          </View>
          {topThree.length > 0 ? (
            topThree.map(([name, value], idx) => (
              <View key={name} style={styles.highlightRow}>
                <Text style={styles.highlightRank}>{idx + 1}</Text>
                <Text style={styles.highlightName}>{name}</Text>
                <Text style={styles.highlightValue}>{value.toFixed(2)} kWh</Text>
              </View>
            ))
          ) : (
            <Text style={styles.cardText}>Run refresh to load appliance highlights.</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="flash-outline" size={18} color={THEME.text} />
            <Text style={styles.cardTitle}>Energy Analysis</Text>
          </View>
          <Text style={styles.cardText}>
            Open the Analysis tab to run prediction, charts, room heatmap, emission insights, and CSV export.
          </Text>

          <TouchableOpacity style={styles.button} onPress={() => router.push("/analysis")}>
            <View style={styles.buttonRow}>
              <Ionicons name="arrow-forward-outline" size={16} color="#FFFFFF" />
              <Text style={styles.buttonText}>Go to Analysis</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.cardRow}>
        <Ionicons name={icon} size={14} color={THEME.muted} />
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  content: {
    padding: 24,
    gap: 12,
    paddingBottom: 120,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: THEME.text,
  },
  subtitle: {
    fontSize: 14,
    color: THEME.muted,
    lineHeight: 20,
  },
  card: {
    marginTop: 8,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardRowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: THEME.text,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: "600",
  },
  loaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardText: {
    fontSize: 14,
    color: THEME.muted,
    lineHeight: 21,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCard: {
    minWidth: "47%",
    flexGrow: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    padding: 10,
    gap: 5,
  },
  kpiLabel: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  kpiValue: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: "700",
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    paddingVertical: 9,
  },
  highlightRank: {
    width: 22,
    color: THEME.muted,
    fontWeight: "700",
  },
  highlightName: {
    flex: 1,
    color: THEME.text,
    fontWeight: "600",
  },
  highlightValue: {
    color: THEME.text,
    fontWeight: "600",
  },
  button: {
    marginTop: 6,
    backgroundColor: THEME.text,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
});
