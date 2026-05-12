// Canonical list of zones in Caracas used across the marketplace.
// Keep this list as the single source of truth so the home filter,
// vehicle creation, vehicle edit and admin views all stay aligned.

export const CARACAS_ZONES = [
  "Altamira",
  "La Castellana",
  "Los Palos Grandes",
  "Chacao",
  "Las Mercedes",
  "El Rosal",
  "Bello Monte",
  "Sabana Grande",
  "Chuao",
  "La Trinidad",
  "El Hatillo",
  "Los Naranjos",
  "Santa Mónica",
  "El Cafetal",
  "Macaracuay",
  "La Urbina",
  "Los Dos Caminos",
  "La California",
  "Prados del Este",
  "Santa Fe",
  "Caurimare",
  "El Paraíso",
  "La Florida",
  "Los Chorros",
] as const;

export type CaracasZone = (typeof CARACAS_ZONES)[number];

/**
 * Tries to match a free-text location string against the canonical zones list.
 * Returns the matching zone or null if no match is found.
 */
export const matchZone = (location: string | null | undefined): CaracasZone | null => {
  if (!location) return null;
  const normalized = location.toLowerCase();
  return (
    CARACAS_ZONES.find((z) => normalized.includes(z.toLowerCase())) ?? null
  );
};
