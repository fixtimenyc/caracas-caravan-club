// Infers a vehicle category from brand/model since DB doesn't store it.
export type VehicleCategory = "sedan" | "suv" | "compact" | "pickup";

const SUV = ["cr-v", "crv", "rav4", "tucson", "sportage", "terios", "fortuner", "explorer", "edge", "highlander", "pilot", "santa fe", "kuga", "escape", "trailblazer", "tracker", "captiva", "outlander", "x-trail", "xtrail", "pathfinder", "4runner", "grand cherokee", "cherokee", "compass", "renegade", "ecosport", "duster", "creta"];
const PICKUP = ["hilux", "tacoma", "tundra", "ranger", "f-150", "f150", "silverado", "colorado", "frontier", "np300", "amarok", "l200", "dmax", "d-max", "bt-50", "tornado", "rampage", "gladiator"];
const COMPACT = ["spark", "picanto", "aveo", "i10", "i20", "fit", "yaris", "march", "kwid", "mirage", "celerio", "alto", "swift", "polo", "gol", "up!", "fiesta", "ka"];

export const inferCategory = (brand: string, model: string): VehicleCategory => {
  const text = `${brand} ${model}`.toLowerCase().trim();
  if (PICKUP.some((k) => text.includes(k))) return "pickup";
  if (SUV.some((k) => text.includes(k))) return "suv";
  if (COMPACT.some((k) => text.includes(k))) return "compact";
  return "sedan";
};
