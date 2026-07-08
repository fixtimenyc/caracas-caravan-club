// Shared helpers for reading system settings (Admin → Configuración)
// stored in localStorage and reused by finance + contract rendering,
// so the numbers actually reflect the configured commission and deposits.
import { inferCategory } from "@/lib/vehicleCategory";

export const SYSTEM_SETTINGS_KEY = "ruedave_system_settings_v1";

export type SystemSettings = {
  business: { website: string; name: string };
  policies: {
    commission_pct: number;
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

export const loadSystemSettings = (): SystemSettings => {
  try {
    const raw = localStorage.getItem(SYSTEM_SETTINGS_KEY);
    if (!raw) return DEFAULT_SYSTEM_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      business: { ...DEFAULT_SYSTEM_SETTINGS.business, ...(parsed.business ?? {}) },
      policies: {
        ...DEFAULT_SYSTEM_SETTINGS.policies,
        ...(parsed.policies ?? {}),
        security_deposits: {
          ...DEFAULT_SYSTEM_SETTINGS.policies.security_deposits,
          ...((parsed.policies ?? {}).security_deposits ?? {}),
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

export type PriceBreakdown = {
  days: number;
  pricePerDay: number;
  subtotal: number;
  commissionPct: number;
  commission: number;
  insurance: number;
  deposit: number;
  totalWithDeposit: number;
};

export const computePriceBreakdown = (
  settings: SystemSettings,
  vehicle: any,
  startDate: string,
  endDate: string,
): PriceBreakdown => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const pricePerDay = Number(vehicle?.price_per_day ?? 0);
  const subtotal = pricePerDay * days;
  const commissionPct = Number(settings.policies.commission_pct ?? 20);
  const commission = Math.round(subtotal * (commissionPct / 100) * 100) / 100;
  const insurance = days * INSURANCE_PER_DAY;
  const deposit = getSecurityDeposit(settings, vehicle);
  const totalWithDeposit = subtotal + commission + insurance + deposit;
  return { days, pricePerDay, subtotal, commissionPct, commission, insurance, deposit, totalWithDeposit };
};
