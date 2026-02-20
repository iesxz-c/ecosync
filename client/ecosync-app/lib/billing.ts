export type BillingSlab = {
  label: string;
  min: number;
  max: number | null;
  rate: number;
};

export type BillingBreakdownItem = {
  slabLabel: string;
  units: number;
  rate: number;
  amount: number;
};

export type BillEstimate = {
  totalUnits: number;
  lowConsumptionFreeApplied: boolean;
  freeUnits: number;
  taxableUnits: number;
  subtotal: number;
  finalAmount: number;
  breakdown: BillingBreakdownItem[];
};

export const TANGEDCO_BIMONTHLY_SLABS: BillingSlab[] = [
  { label: "0-400", min: 0, max: 400, rate: 4.95 },
  { label: "401-500", min: 400, max: 500, rate: 6.65 },
  { label: "501-600", min: 500, max: 600, rate: 8.8 },
  { label: "601-800", min: 600, max: 800, rate: 9.95 },
  { label: "801-1000", min: 800, max: 1000, rate: 11.05 },
  { label: "1000+", min: 1000, max: null, rate: 12.15 },
];

function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function calculateTangedcoBiMonthlyBill(units: number): BillEstimate {
  const totalUnits = Math.max(0, units);

  if (totalUnits <= 100) {
    return {
      totalUnits: round2(totalUnits),
      lowConsumptionFreeApplied: true,
      freeUnits: round2(totalUnits),
      taxableUnits: 0,
      subtotal: 0,
      finalAmount: 0,
      breakdown: [],
    };
  }

  const breakdown: BillingBreakdownItem[] = [];

  for (const slab of TANGEDCO_BIMONTHLY_SLABS) {
    const slabUpper = slab.max ?? totalUnits;
    const applicableUnits = Math.max(0, Math.min(totalUnits, slabUpper) - slab.min);

    if (applicableUnits > 0) {
      breakdown.push({
        slabLabel: slab.label,
        units: round2(applicableUnits),
        rate: slab.rate,
        amount: round2(applicableUnits * slab.rate),
      });
    }

    if (slab.max !== null && totalUnits <= slab.max) {
      break;
    }
  }

  const subtotal = round2(breakdown.reduce((sum, item) => sum + item.amount, 0));

  return {
    totalUnits: round2(totalUnits),
    lowConsumptionFreeApplied: false,
    freeUnits: 0,
    taxableUnits: round2(totalUnits),
    subtotal,
    finalAmount: subtotal,
    breakdown,
  };
}
