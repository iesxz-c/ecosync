import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { predict, PredictPayload, PredictResponse } from "@/lib/api";
import { saveLastPrediction } from "@/lib/energy-summary";

type SectionKey = "overview" | "appliances" | "rooms" | "emission";
type ViewMode = "Today" | "Month" | "Year";

const THEME = {
  bg: "#FFFFFF",
  panel: "#F9F9F9",
  panel2: "#F3F4F6",
  text: "#111827",
  muted: "#6B7280",
  accent: "#111827",
  good: "#22C55E",
};

const sections: { key: SectionKey; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "overview", label: "Dashboard Overview", icon: "home-outline" },
  { key: "appliances", label: "Appliance Analytics", icon: "flash-outline" },
  { key: "rooms", label: "Usage by Rooms", icon: "business-outline" },
  { key: "emission", label: "Emission Insights", icon: "leaf-outline" },
];

const viewModes: ViewMode[] = ["Today", "Month", "Year"];
const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const roomNames = [
  "Master Bedroom",
  "Bedroom 1",
  "Drawing Room",
  "Living Room",
  "Kitchen",
  "Garage",
  "Others",
];

const applianceColors = [
  "#111827",
  "#374151",
  "#6B7280",
  "#9CA3AF",
  "#D1D5DB",
  "#4B5563",
  "#1F2937",
];

function viewFactor(mode: ViewMode) {
  if (mode === "Today") return 1;
  if (mode === "Month") return 30;
  return 365;
}

export default function Index() {
  const [section, setSection] = useState<SectionKey>("overview");
  const [viewMode, setViewMode] = useState<ViewMode>("Today");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PredictResponse | null>(null);

  const [inputs, setInputs] = useState<PredictPayload>({
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
  });

  const setField = <K extends keyof PredictPayload>(key: K, value: PredictPayload[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const runPrediction = async () => {
    setIsLoading(true);
    try {
      const data = await predict(inputs);
      setResult(data);
      await saveLastPrediction(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prediction request failed";
      Alert.alert("Prediction failed", message);
    } finally {
      setIsLoading(false);
    }
  };

  const usageScale = viewFactor(viewMode);

  const applianceRows = useMemo(() => {
    if (!result) return [] as { name: string; value: number }[];
    return Object.entries(result.appliance_usage).map(([name, value]) => ({
      name,
      value: value * usageScale,
    }));
  }, [result, usageScale]);

  const scaledPrediction = useMemo(() => {
    if (!result) return 0;
    return result.predicted_kwh * usageScale;
  }, [result, usageScale]);

  const trendValues = useMemo(() => {
    if (!result) return [] as number[];
    const base = result.predicted_kwh;
    const multiplier = viewMode === "Today" ? 1 : viewMode === "Month" ? 0.95 : 0.9;
    return weekLabels.map((_, i) => {
      const wave = Math.sin(i * 0.8) * 0.55;
      const slope = i * 0.06;
      return Number(((base + wave + slope) * multiplier).toFixed(2));
    });
  }, [result, viewMode]);

  const heatmap = useMemo(() => {
    if (!result) return [] as number[][];
    const base = result.predicted_kwh;
    return roomNames.map((_, rowIdx) =>
      Array.from({ length: 12 }, (_, colIdx) => {
        const value = base * (0.4 + ((rowIdx + 1) * (colIdx + 2)) / 35);
        return Number(value.toFixed(2));
      }),
    );
  }, [result]);

  const cardWidth = Math.max(Dimensions.get("window").width - 32, 320);

  const exportCsv = async () => {
    if (!result) {
      Alert.alert("No report", "Run analysis first.");
      return;
    }

    const header = "Appliance,Usage (kWh),Predicted_Total (kWh)\n";
    const rows = Object.entries(result.appliance_usage)
      .map(([name, value]) => `${name},${value.toFixed(4)},${result.predicted_kwh.toFixed(4)}`)
      .join("\n");
    const csv = `${header}${rows}\n`;

    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Energy_Report.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    const fileUri = `${FileSystem.cacheDirectory}Energy_Report.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Export Energy Report",
      });
    } else {
      Alert.alert("Saved", `CSV saved to ${fileUri}`);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Ionicons name="flash-outline" size={22} color={THEME.accent} />
          <Text style={styles.title}>Smart Home Energy Dashboard</Text>
        </View>

        <View style={styles.rowWrap}>
          {sections.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.chip, section === item.key && styles.chipActive]}
              onPress={() => setSection(item.key)}
            >
              <View style={styles.inlineRow}>
                <Ionicons
                  name={item.icon}
                  size={14}
                  color={section === item.key ? THEME.accent : THEME.muted}
                />
                <Text style={[styles.chipText, section === item.key && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.rowWrap}>
          {viewModes.map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.modeBtn, viewMode === mode && styles.modeBtnActive]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[styles.modeText, viewMode === mode && styles.modeTextActive]}>{mode}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.panel}>
          <PanelTitle icon="build-outline" title="Appliance Inputs" />

          <SliderField
            label={`Temperature (°C): ${inputs.temperature}`}
            icon="thermometer-outline"
            value={inputs.temperature}
            min={20}
            max={45}
            step={1}
            onChange={(val) => setField("temperature", Math.round(val))}
          />

          <SliderField
            label={`Humidity (%): ${inputs.humidity}`}
            icon="water-outline"
            value={inputs.humidity}
            min={30}
            max={100}
            step={1}
            onChange={(val) => setField("humidity", Math.round(val))}
          />

          <SliderField
            label={`Occupancy: ${inputs.occupancy}`}
            icon="people-outline"
            value={inputs.occupancy}
            min={1}
            max={10}
            step={1}
            onChange={(val) => setField("occupancy", Math.round(val))}
          />

          <View style={styles.inlineRow}>
            <Ionicons name="settings-outline" size={16} color={THEME.text} />
            <Text style={styles.sectionSubTitle}>Appliance Loads (kWh)</Text>
          </View>

          <SliderField label={`AC: ${inputs.ac.toFixed(2)}`} icon="snow-outline" value={inputs.ac} min={0} max={5} step={0.1} onChange={(val) => setField("ac", Number(val.toFixed(2)))} />
          <SliderField label={`Fan: ${inputs.fan.toFixed(2)}`} icon="sync-outline" value={inputs.fan} min={0} max={1} step={0.05} onChange={(val) => setField("fan", Number(val.toFixed(2)))} />
          <SliderField label={`Refrigerator: ${inputs.fridge.toFixed(2)}`} icon="cube-outline" value={inputs.fridge} min={0.05} max={0.2} step={0.01} onChange={(val) => setField("fridge", Number(val.toFixed(2)))} />
          <SliderField label={`Plug Loads: ${inputs.plug.toFixed(2)}`} icon="power-outline" value={inputs.plug} min={0} max={1} step={0.05} onChange={(val) => setField("plug", Number(val.toFixed(2)))} />
          <SliderField label={`Kitchen: ${inputs.kitchen.toFixed(2)}`} icon="restaurant-outline" value={inputs.kitchen} min={0} max={2} step={0.05} onChange={(val) => setField("kitchen", Number(val.toFixed(2)))} />
          <SliderField label={`Water Pump: ${inputs.pump.toFixed(2)}`} icon="water-outline" value={inputs.pump} min={0} max={1} step={0.05} onChange={(val) => setField("pump", Number(val.toFixed(2)))} />
          <SliderField label={`Lighting: ${inputs.lighting.toFixed(2)}`} icon="bulb-outline" value={inputs.lighting} min={0} max={1} step={0.05} onChange={(val) => setField("lighting", Number(val.toFixed(2)))} />
          <SliderField label={`Solar: ${inputs.solar.toFixed(2)}`} icon="sunny-outline" value={inputs.solar} min={0} max={2} step={0.05} onChange={(val) => setField("solar", Number(val.toFixed(2)))} />

          <TouchableOpacity style={styles.primaryBtn} onPress={runPrediction} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#001823" /> : <Text style={styles.primaryBtnText}>Run Analysis</Text>}
          </TouchableOpacity>
        </View>

        {!result ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Run analysis to view prediction charts and insights.</Text>
          </View>
        ) : null}

        {result && section === "overview" ? (
          <View>
            <View style={styles.kpiGrid}>
              <MetricCard title="Predicted Energy" value={`${scaledPrediction.toFixed(2)} kWh`} />
              <MetricCard title="Occupancy Level" value={`${inputs.occupancy} People`} />
              <MetricCard title="Highest Appliance" value={result.highest_appliance} />
              <MetricCard title="CO₂ Emission" value={`${(result.co2_kg * usageScale).toFixed(2)} kg`} />
            </View>

            <View style={styles.panel}>
              <PanelTitle icon="bar-chart-outline" title="Appliance Load Distribution" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <BarChart
                  data={{
                    labels: applianceRows.map((a) => a.name),
                    datasets: [{ data: applianceRows.map((a) => Number(a.value.toFixed(2))) }],
                  }}
                  width={Math.max(cardWidth, applianceRows.length * 90)}
                  height={230}
                  fromZero
                  yAxisLabel=""
                  yAxisSuffix=""
                  withInnerLines
                  chartConfig={chartConfig}
                  style={styles.chart}
                />
              </ScrollView>
            </View>

            <View style={styles.panel}>
              <PanelTitle icon="pie-chart-outline" title="Appliance Contribution Donut" />
              <PieChart
                data={applianceRows.map((item, i) => ({
                  name: item.name,
                  population: item.value,
                  color: applianceColors[i % applianceColors.length],
                  legendFontColor: THEME.text,
                  legendFontSize: 12,
                }))}
                width={cardWidth}
                height={220}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="8"
                hasLegend
                center={[0, 0]}
                absolute
              />
            </View>

            <View style={styles.panel}>
              <PanelTitle icon="trending-up-outline" title="Energy Forecast Trend (Next 7 Days)" />
              <LineChart
                data={{ labels: weekLabels, datasets: [{ data: trendValues }] }}
                width={cardWidth}
                height={230}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={chartConfig}
                style={styles.chart}
              />
            </View>

            <View style={styles.panel}>
              <PanelTitle icon="checkmark-done-outline" title="Smart Insights & Recommendations" />
              <InsightRow icon="flame-outline" text={`Predicted electricity usage: ${scaledPrediction.toFixed(2)} kWh`} />
              <InsightRow icon="checkmark-circle-outline" text={`Highest consuming appliance: ${result.highest_appliance}`} />
              <InsightRow icon="bulb-outline" text="Reduce AC usage during afternoon peak hours" />
              <InsightRow icon="bulb-outline" text="Use energy-efficient LED lighting" />
              <InsightRow icon="sunny-outline" text="Solar generation offsets part of consumption" />

              <TouchableOpacity style={styles.secondaryBtn} onPress={exportCsv}>
                <View style={styles.inlineRowCenter}>
                  <Ionicons name="download-outline" size={16} color={THEME.accent} />
                  <Text style={styles.secondaryBtnText}>Export Usage Report CSV</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {result && section === "appliances" ? (
          <View>
            <View style={styles.titleRow}>
              <Ionicons name="flash-outline" size={20} color={THEME.accent} />
              <Text style={styles.sectionTitle}>Appliance Analytics Dashboard</Text>
            </View>
            <Text style={styles.muted}>Detailed appliance-level monitoring</Text>

            <View style={styles.kpiGrid}>
              {applianceRows.map((item) => (
                <View key={item.name} style={styles.applianceCard}>
                  <Text style={styles.applianceName}>{item.name}</Text>
                  <Text style={styles.applianceValue}>{item.value.toFixed(2)} kWh</Text>
                  <Text style={styles.applianceSub}>Live appliance consumption</Text>
                </View>
              ))}
            </View>

            <View style={styles.panel}>
              <PanelTitle icon="trophy-outline" title="Appliance Ranking Table" />
              {applianceRows
                .slice()
                .sort((a, b) => b.value - a.value)
                .map((item, index) => (
                  <View key={item.name} style={styles.tableRow}>
                    <Text style={styles.tableText}>{index + 1}. {item.name}</Text>
                    <Text style={styles.tableText}>{item.value.toFixed(2)} kWh</Text>
                  </View>
                ))}
            </View>
          </View>
        ) : null}

        {result && section === "rooms" ? (
          <View>
            <View style={styles.titleRow}>
              <Ionicons name="business-outline" size={20} color={THEME.accent} />
              <Text style={styles.sectionTitle}>Usage by Rooms (Fusion Heatmap View)</Text>
            </View>
            <View style={styles.panel}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.heatHeaderRow}>
                    <Text style={[styles.heatHeaderText, styles.roomCol]}>Room</Text>
                    {Array.from({ length: 12 }, (_, i) => (
                      <Text key={i} style={styles.heatHeaderText}>{`W${i + 1}`}</Text>
                    ))}
                  </View>
                  {roomNames.map((room, roomIdx) => (
                    <View key={room} style={styles.heatRow}>
                      <Text style={[styles.heatCellText, styles.roomCol]} numberOfLines={1}>{room}</Text>
                      {heatmap[roomIdx].map((value, colIdx) => {
                        const intensity = Math.min(1, value / (result.predicted_kwh * 1.7));
                        const alpha = 0.08 + intensity * 0.22;
                        return (
                          <View
                            key={`${room}-${colIdx}`}
                            style={[styles.heatCell, { backgroundColor: `rgba(17, 24, 39, ${alpha})` }]}
                          >
                            <Text style={styles.heatCellText}>{value.toFixed(1)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        ) : null}

        {result && section === "emission" ? (
          <View>
            <View style={styles.titleRow}>
              <Ionicons name="leaf-outline" size={20} color={THEME.accent} />
              <Text style={styles.sectionTitle}>Carbon Footprint & Green Energy Insights</Text>
            </View>

            <View style={styles.kpiGrid}>
              <MetricCard title="Predicted CO₂ Emission" value={`${(result.co2_kg * usageScale).toFixed(2)} kg CO₂`} />
              <MetricCard title="Solar Offset" value={`${result.green_percent.toFixed(1)}%`} />
            </View>

            <View style={styles.panel}>
              <PanelTitle icon="sunny-outline" title="Solar Offset Contribution" />
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(result.green_percent, 100)}%` }]} />
              </View>
              <Text style={styles.insightText}>Solar offsets around {result.green_percent.toFixed(1)}% of total usage.</Text>
              <InsightRow icon="checkmark-circle-outline" text="Chennai homes can reduce emissions significantly with rooftop solar." />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type SliderFieldProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
};

function SliderField({ icon, label, value, min, max, step, onChange }: SliderFieldProps) {
  return (
    <View style={styles.sliderWrap}>
      <View style={styles.inlineRow}>
        <Ionicons name={icon} size={14} color={THEME.text} />
        <Text style={styles.sliderLabel}>{label}</Text>
      </View>
      <Slider
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={onChange}
        minimumTrackTintColor={THEME.accent}
        maximumTrackTintColor="#D1D5DB"
        thumbTintColor={THEME.accent}
      />
    </View>
  );
}

function PanelTitle({ title, icon }: { title: string; icon: React.ComponentProps<typeof Ionicons>["name"] }) {
  return (
    <View style={styles.inlineRow}>
      <Ionicons name={icon} size={18} color={THEME.accent} />
      <Text style={styles.panelTitle}>{title}</Text>
    </View>
  );
}

function InsightRow({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string }) {
  return (
    <View style={styles.inlineRow}>
      <Ionicons name={icon} size={15} color={THEME.text} />
      <Text style={styles.insightText}>{text}</Text>
    </View>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const chartConfig = {
  backgroundGradientFrom: THEME.panel,
  backgroundGradientTo: THEME.panel,
  decimalPlaces: 2,
  color: (opacity = 1) => `rgba(17, 24, 39, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
  propsForDots: {
    r: "4",
    strokeWidth: "2",
    stroke: THEME.accent,
  },
  propsForBackgroundLines: {
    stroke: "#E5E7EB",
    strokeDasharray: "4",
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  title: {
    color: THEME.accent,
    fontSize: 24,
    fontWeight: "800",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineRowCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: THEME.panel2,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
  },
  chipActive: {
    borderColor: THEME.accent,
    backgroundColor: THEME.panel,
  },
  chipText: {
    color: THEME.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: THEME.accent,
  },
  modeBtn: {
    backgroundColor: THEME.panel2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeBtnActive: {
    backgroundColor: THEME.accent,
  },
  modeText: {
    color: THEME.text,
    fontWeight: "600",
  },
  modeTextActive: {
    color: "#FFFFFF",
  },
  panel: {
    backgroundColor: THEME.panel,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
  },
  panelTitle: {
    color: THEME.accent,
    fontSize: 18,
    fontWeight: "700",
  },
  sectionSubTitle: {
    color: THEME.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  sliderWrap: {
    gap: 2,
  },
  sliderLabel: {
    color: THEME.text,
    fontSize: 14,
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: THEME.accent,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
  secondaryBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: THEME.accent,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: THEME.accent,
    fontWeight: "700",
  },
  placeholder: {
    backgroundColor: THEME.panel2,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  placeholderText: {
    color: THEME.muted,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    minWidth: "47%",
    flexGrow: 1,
    backgroundColor: THEME.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  metricTitle: {
    color: THEME.muted,
    fontSize: 13,
    marginBottom: 6,
  },
  metricValue: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: "700",
  },
  chart: {
    borderRadius: 16,
  },
  insightText: {
    color: THEME.text,
    fontSize: 14,
    lineHeight: 22,
  },
  sectionTitle: {
    color: THEME.accent,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 2,
  },
  muted: {
    color: THEME.muted,
    marginBottom: 10,
  },
  applianceCard: {
    backgroundColor: THEME.panel,
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    minWidth: "47%",
    flexGrow: 1,
  },
  applianceName: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: "700",
  },
  applianceValue: {
    color: THEME.accent,
    fontSize: 20,
    fontWeight: "800",
    marginVertical: 4,
  },
  applianceSub: {
    color: THEME.muted,
    fontSize: 12,
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 10,
  },
  tableText: {
    color: THEME.text,
    fontWeight: "600",
  },
  heatHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  heatHeaderText: {
    color: THEME.muted,
    width: 52,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
  },
  roomCol: {
    width: 120,
    textAlign: "left",
  },
  heatRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  heatCell: {
    width: 52,
    height: 34,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  heatCellText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 11,
  },
  progressTrack: {
    width: "100%",
    height: 16,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: THEME.good,
  },
});
