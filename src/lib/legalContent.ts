// Custom legal content overrides administered from Admin → Configuración → Legal.
// Each page renders its default JSX when the corresponding field is empty; otherwise
// the admin-provided plain-text content is rendered with preserved whitespace.

export type LegalKey = "terms" | "privacy" | "cancellation" | "insurance";

export type LegalContent = Record<LegalKey, string>;

export const LEGAL_CONTENT_KEY = "ruedave_legal_content_v1";

export const LEGAL_META: Record<LegalKey, { title: string; subtitle: string; path: string }> = {
  terms: {
    title: "Términos y Condiciones Generales de Uso",
    subtitle: "Condiciones que rigen el uso de la plataforma RuedaVe",
    path: "/terminos",
  },
  privacy: {
    title: "Política de Privacidad y Protección de Datos",
    subtitle: "Cómo tratamos, protegemos y compartimos tus datos personales",
    path: "/politica-privacidad",
  },
  cancellation: {
    title: "Políticas de Cancelación y Reembolsos",
    subtitle: "Condiciones para la cancelación de reservas y devolución de pagos",
    path: "/politica-cancelacion",
  },
  insurance: {
    title: "Seguro y Cobertura",
    subtitle: "Alcance de la cobertura, exclusiones y proceso de reclamos",
    path: "/seguro",
  },
};

export const EMPTY_LEGAL_CONTENT: LegalContent = {
  terms: "",
  privacy: "",
  cancellation: "",
  insurance: "",
};

export const loadLegalContent = (): LegalContent => {
  try {
    const raw = localStorage.getItem(LEGAL_CONTENT_KEY);
    if (!raw) return { ...EMPTY_LEGAL_CONTENT };
    const parsed = JSON.parse(raw) as Partial<LegalContent>;
    return { ...EMPTY_LEGAL_CONTENT, ...parsed };
  } catch {
    return { ...EMPTY_LEGAL_CONTENT };
  }
};

export const saveLegalContent = (content: LegalContent) => {
  localStorage.setItem(LEGAL_CONTENT_KEY, JSON.stringify(content));
};

export const getLegalOverride = (key: LegalKey): string => {
  const c = loadLegalContent();
  return (c[key] ?? "").trim();
};
