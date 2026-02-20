import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { calculateTangedcoBiMonthlyBill, TANGEDCO_BIMONTHLY_SLABS } from "@/lib/billing";
import { loadLastPrediction, StoredPrediction } from "@/lib/energy-summary";

const THEME = {
  bg: "#FFFFFF",
  card: "#F9F9F9",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  accent: "#111827",
};

function formatInr(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

export default function Bills() {
  const router = useRouter();
  const [stored, setStored] = useState<StoredPrediction | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<View>(null);

  const refreshFromAnalysis = useCallback(async () => {
    try {
      const latest = await loadLastPrediction();
      setStored(latest);
    } catch {
      setStored(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshFromAnalysis();
    }, [refreshFromAnalysis]),
  );

  const dailyPrediction = stored?.data.predicted_kwh ?? 0;
  const biMonthlyUnits = useMemo(() => dailyPrediction * 60, [dailyPrediction]);
  const bill = useMemo(() => calculateTangedcoBiMonthlyBill(biMonthlyUnits), [biMonthlyUnits]);

  const exportPdf = async () => {
    if (!stored) {
      Alert.alert("No analysis data", "Run prediction in Analysis tab first.");
      return;
    }

    setIsExporting(true);
    try {
      const rowsHtml = bill.breakdown
        .map(
          (item) =>
            `<tr><td>${item.slabLabel}</td><td>${item.units.toFixed(2)}</td><td>${item.rate.toFixed(2)}</td><td>${formatInr(item.amount)}</td></tr>`,
        )
        .join("");

      const html = `
        <html>
          <body style="font-family: Arial; padding: 24px; color: #111827;">
            <h1>Ecosync - Chennai Bill Estimate</h1>
            <p><strong>Estimated Daily Usage:</strong> ${dailyPrediction.toFixed(2)} kWh</p>
            <p><strong>Estimated Bi-Monthly Usage:</strong> ${bill.totalUnits.toFixed(2)} units</p>
            <p><strong>Predicted CO₂:</strong> ${stored.data.co2_kg.toFixed(2)} kg</p>
            <p><strong>Highest Appliance:</strong> ${stored.data.highest_appliance}</p>
            <hr/>
            <h3>Tariff Breakdown (TANGEDCO Domestic)</h3>
            <table style="width:100%; border-collapse: collapse;" border="1" cellpadding="8">
              <thead>
                <tr>
                  <th>Slab</th><th>Units</th><th>Rate (₹/unit)</th><th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || "<tr><td colspan='4'>Free usage slab applied (<=100 units).</td></tr>"}
              </tbody>
            </table>
            <h2 style="margin-top: 18px;">Final Estimated Bill: ${formatInr(bill.finalAmount)}</h2>
            <p style="font-size:12px; color:#6B7280;">Note: Estimate based on latest analysis prediction and provided Chennai bi-monthly slabs.</p>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });

      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Bill PDF",
        });
      } else {
        Alert.alert("PDF generated", `Saved at: ${uri}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create PDF";
      Alert.alert("Export failed", message);
    } finally {
      setIsExporting(false);
    }
  };

  const exportJpeg = async () => {
    if (!stored) {
      Alert.alert("No analysis data", "Run prediction in Analysis tab first.");
      return;
    }
    if (!reportRef.current) {
      Alert.alert("Export failed", "Report view is not ready yet.");
      return;
    }

    setIsExporting(true);
    try {
      const uri = await captureRef(reportRef, {
        format: "jpg",
        quality: 1,
      });

      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/jpeg",
          dialogTitle: "Share Bill JPEG",
        });
      } else {
        Alert.alert("JPEG generated", `Saved at: ${uri}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create JPEG";
      Alert.alert("Export failed", message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Ionicons name="receipt-outline" size={22} color={THEME.text} />
          <Text style={styles.title}>Bill Estimator</Text>
        </View>

        <Text style={styles.subtitle}>
          Uses your latest Analysis prediction to estimate TANGEDCO Chennai bi-monthly domestic bill.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardRowBetween}>
            <View style={styles.cardRow}>
              <Ionicons name="sync-outline" size={18} color={THEME.text} />
              <Text style={styles.cardTitle}>Linked Analysis Data</Text>
            </View>
            <TouchableOpacity style={styles.smallBtn} onPress={refreshFromAnalysis} disabled={isExporting}>
              <Text style={styles.smallBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {stored ? (
            <>
              <Text style={styles.textLine}>Daily Predicted Usage: {stored.data.predicted_kwh.toFixed(2)} kWh</Text>
              <Text style={styles.textLine}>Bi-Monthly Estimated Units: {bill.totalUnits.toFixed(2)} units</Text>
              <Text style={styles.textLine}>Latest High Appliance: {stored.data.highest_appliance}</Text>
              <Text style={styles.mutedText}>Updated: {new Date(stored.updatedAt).toLocaleString()}</Text>
            </>
          ) : (
            <>
              <Text style={styles.mutedText}>No analysis found yet.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/analysis")}>
                <Text style={styles.primaryBtnText}>Go to Analysis</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View ref={reportRef} collapsable={false} style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="calculator-outline" size={18} color={THEME.text} />
            <Text style={styles.cardTitle}>Bill Calculation</Text>
          </View>

          <Text style={styles.billAmount}>Estimated Bill: {formatInr(bill.finalAmount)}</Text>

          <View style={styles.breakdownHeader}>
            <Text style={[styles.breakText, styles.slabCol]}>Slab</Text>
            <Text style={[styles.breakText, styles.unitsCol]}>Units</Text>
            <Text style={[styles.breakText, styles.rateCol]}>Rate</Text>
            <Text style={[styles.breakText, styles.amountCol]}>Amount</Text>
          </View>

          {bill.breakdown.length > 0 ? (
            bill.breakdown.map((item) => (
              <View key={item.slabLabel} style={styles.breakdownRow}>
                <Text style={[styles.breakText, styles.slabCol]}>{item.slabLabel}</Text>
                <Text style={[styles.breakText, styles.unitsCol]}>{item.units.toFixed(2)}</Text>
                <Text style={[styles.breakText, styles.rateCol]}>{item.rate.toFixed(2)}</Text>
                <Text style={[styles.breakText, styles.amountCol]}>{formatInr(item.amount)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.mutedText}>Free usage applied (&lt;=100 units): {bill.freeUnits.toFixed(2)} units.</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="newspaper-outline" size={18} color={THEME.text} />
            <Text style={styles.cardTitle}>Reference Tariff Slabs</Text>
          </View>

          {TANGEDCO_BIMONTHLY_SLABS.map((slab) => (
            <View key={slab.label} style={styles.tariffRow}>
              <Text style={styles.textLine}>{slab.label} units</Text>
              <Text style={styles.textLine}>₹{slab.rate.toFixed(2)}/unit</Text>
            </View>
          ))}
        </View>

        <View style={styles.exportRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={exportPdf} disabled={isExporting || !stored}>
            <View style={styles.cardRow}>
              <Ionicons name="document-outline" size={16} color={THEME.text} />
              <Text style={styles.secondaryBtnText}>Export PDF</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={exportJpeg} disabled={isExporting || !stored}>
            <View style={styles.cardRow}>
              <Ionicons name="image-outline" size={16} color={THEME.text} />
              <Text style={styles.secondaryBtnText}>Export JPEG</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 120,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: THEME.text,
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: THEME.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardRowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    color: THEME.text,
    fontSize: 17,
    fontWeight: "700",
  },
  textLine: {
    color: THEME.text,
    fontSize: 14,
  },
  mutedText: {
    color: THEME.muted,
    fontSize: 13,
  },
  smallBtn: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallBtnText: {
    color: THEME.text,
    fontSize: 12,
    fontWeight: "600",
  },
  primaryBtn: {
    marginTop: 4,
    backgroundColor: THEME.accent,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 10,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  billAmount: {
    color: THEME.text,
    fontSize: 22,
    fontWeight: "800",
    marginVertical: 2,
  },
  breakdownHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    paddingBottom: 6,
  },
  breakdownRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    paddingVertical: 7,
  },
  breakText: {
    color: THEME.text,
    fontSize: 12,
  },
  slabCol: {
    flex: 1.2,
  },
  unitsCol: {
    flex: 0.8,
    textAlign: "right",
  },
  rateCol: {
    flex: 0.8,
    textAlign: "right",
  },
  amountCol: {
    flex: 1,
    textAlign: "right",
    fontWeight: "700",
  },
  tariffRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    paddingVertical: 7,
  },
  exportRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: THEME.text,
    fontWeight: "700",
  },
});
