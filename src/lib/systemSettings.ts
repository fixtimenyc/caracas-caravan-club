// Shared helpers for reading system settings (Admin → Configuración)
// stored in localStorage and reused by finance + contract rendering,
// so the numbers actually reflect the configured commissions and deposits.
import { inferCategory } from "@/lib/vehicleCategory";

export const SYSTEM_SETTINGS_KEY = "ruedave_system_settings_v1";

export type CommissionRule = {
  // "pct" = porcentaje del subtotal (días × tarifa/día).
  // "fixed" = monto fijo por reserva (USD).
  mode: "pct" | "fixed";
  value: number;
};

export type SystemSettings = {
  business: { website: string; name: string };
  policies: {
    // Legacy: aún se lee para compatibilidad hacia atrás.
    commission_pct: number;
    // Nuevas fuentes únicas de comisiones.
    renter_commission: CommissionRule;
    owner_commission: CommissionRule;
    security_deposits: Record<string, number>;
    deposit_pct_of_value: number;
  };
  contract: {
    enabled: boolean;
    version: string;
    company_legal_name: string;
    company_rif: string;
    company_address: string;
    jurisdiction: string;
    body: string;
  };
};

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  business: { website: "https://ruedave.com", name: "RUEDAVE" },
  policies: {
    commission_pct: 20,
    renter_commission: { mode: "pct", value: 20 },
    owner_commission: { mode: "pct", value: 15 },
    security_deposits: {
      economy: 100, sedan: 150, suv: 250, pickup: 250,
      luxury: 500, sports: 600, van: 300,
    },
    deposit_pct_of_value: 5,
  },
  contract: {
    enabled: true,
    version: "1.0",
    company_legal_name: "RUEDAVE C.A.",
    company_rif: "J-XXXXXXXX-X",
    company_address: "Caracas, Venezuela",
    jurisdiction:
      "Tribunales de la República Bolivariana de Venezuela, con sede en Caracas",
    body: "",
  },
};

const normalizeCommission = (
  raw: any,
  fallback: CommissionRule,
): CommissionRule => {
  if (raw && typeof raw === "object" && (raw.mode === "pct" || raw.mode === "fixed")) {
    const v = Number(raw.value);
    return { mode: raw.mode, value: Number.isFinite(v) ? v : fallback.value };
  }
  return { ...fallback };
};

export const loadSystemSettings = (): SystemSettings => {
  try {
    const raw = localStorage.getItem(SYSTEM_SETTINGS_KEY);
    if (!raw) return DEFAULT_SYSTEM_SETTINGS;
    const parsed = JSON.parse(raw);
    const policiesIn = parsed.policies ?? {};
    const legacyPct = Number(policiesIn.commission_pct);
    const renterFallback: CommissionRule = Number.isFinite(legacyPct)
      ? { mode: "pct", value: legacyPct }
      : DEFAULT_SYSTEM_SETTINGS.policies.renter_commission;
    return {
      business: { ...DEFAULT_SYSTEM_SETTINGS.business, ...(parsed.business ?? {}) },
      policies: {
        ...DEFAULT_SYSTEM_SETTINGS.policies,
        ...policiesIn,
        renter_commission: normalizeCommission(
          policiesIn.renter_commission,
          renterFallback,
        ),
        owner_commission: normalizeCommission(
          policiesIn.owner_commission,
          DEFAULT_SYSTEM_SETTINGS.policies.owner_commission,
        ),
        security_deposits: {
          ...DEFAULT_SYSTEM_SETTINGS.policies.security_deposits,
          ...(policiesIn.security_deposits ?? {}),
        },
      },
      contract: { ...DEFAULT_SYSTEM_SETTINGS.contract, ...(parsed.contract ?? {}) },
    };
  } catch {
    return DEFAULT_SYSTEM_SETTINGS;
  }
};

// Fixed insurance rate ($8/day) matches the DB trigger `enforce_reservation_price`.
export const INSURANCE_PER_DAY = 8;

const CATEGORY_TO_DEPOSIT_KEY: Record<string, string> = {
  economico: "economy",
  sedan: "sedan",
  suv: "suv",
  pickup: "pickup",
  camioneta: "van",
  lujo: "luxury",
};

export const getSecurityDeposit = (
  settings: SystemSettings,
  vehicle: { brand?: string | null; model?: string | null; house_rules?: any } | null | undefined,
): number => {
  // House rule override wins if the owner set one explicitly.
  const override = Number(vehicle?.house_rules?.securityDeposit);
  if (Number.isFinite(override) && override > 0) return override;
  const cat = inferCategory(vehicle?.brand ?? "", vehicle?.model ?? "");
  const key = CATEGORY_TO_DEPOSIT_KEY[cat] ?? "sedan";
  return Number(settings.policies.security_deposits[key] ?? 150);
};

export const applyCommission = (rule: CommissionRule, subtotal: number): number => {
  if (rule.mode === "fixed") return Math.max(0, Math.round(Number(rule.value) * 100) / 100);
  const pct = Number(rule.value) / 100;
  return Math.round(subtotal * pct * 100) / 100;
};

export const describeCommission = (rule: CommissionRule): string =>
  rule.mode === "fixed"
    ? `$${Number(rule.value).toFixed(2)} fijo`
    : `${Number(rule.value)}%`;

const daysBetween = (start: string, end: string) => {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
};

export type PriceBreakdown = {
  days: number;
  pricePerDay: number;
  subtotal: number;
  commissionPct: number;         // legacy — porcentaje efectivo aplicado
  commission: number;
  commissionLabel: string;
  insurance: number;
  deposit: number;
  totalWithDeposit: number;
};

// Cargos al arrendatario (lo que ve y paga el que alquila).
export const computeRenterCharges = (
  settings: SystemSettings,
  vehicle: any,
  startDate: string,
  endDate: string,
): PriceBreakdown => {
  const days = daysBetween(startDate, endDate);
  const pricePerDay = Number(vehicle?.price_per_day ?? 0);
  const subtotal = pricePerDay * days;
  const rule = settings.policies.renter_commission;
  const commission = applyCommission(rule, subtotal);
  const insurance = days * INSURANCE_PER_DAY;
  const deposit = getSecurityDeposit(settings, vehicle);
  const totalWithDeposit = subtotal + commission + insurance + deposit;
  return {
    days,
    pricePerDay,
    subtotal,
    commissionPct: rule.mode === "pct" ? Number(rule.value) : 0,
    commission,
    commissionLabel: describeCommission(rule),
    insurance,
    deposit,
    totalWithDeposit,
  };
};

// Alias legacy — usado por contratos y otras vistas.
export const computePriceBreakdown = computeRenterCharges;

export type OwnerBreakdown = {
  days: number;
  pricePerDay: number;
  subtotal: number;
  ownerCommission: number;
  ownerCommissionLabel: string;
  insurance: number;
  deposit: number;
  netEarnings: number; // lo que efectivamente recibe el aliado
};

// Cargos al aliado (descuentos que aplica la plataforma sobre su cobro).
export const computeOwnerBreakdown = (
  settings: SystemSettings,
  vehicle: any,
  startDate: string,
  endDate: string,
): OwnerBreakdown => {
  const days = daysBetween(startDate, endDate);
  const pricePerDay = Number(vehicle?.price_per_day ?? 0);
  const subtotal = pricePerDay * days;
  const rule = settings.policies.owner_commission;
  const ownerCommission = applyCommission(rule, subtotal);
  const insurance = days * INSURANCE_PER_DAY;
  const deposit = getSecurityDeposit(settings, vehicle);
  const netEarnings = Math.max(0, Math.round((subtotal - ownerCommission) * 100) / 100);
  return {
    days,
    pricePerDay,
    subtotal,
    ownerCommission,
    ownerCommissionLabel: describeCommission(rule),
    insurance,
    deposit,
    netEarnings,
  };
};
