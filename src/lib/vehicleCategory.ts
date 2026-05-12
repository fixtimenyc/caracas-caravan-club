// Infers a vehicle category from brand/model since DB doesn't store it.
export type VehicleCategory = "sedan" | "economico" | "suv" | "pickup" | "camioneta" | "lujo";

export const VEHICLE_CATEGORIES: { id: VehicleCategory; name: string }[] = [
  { id: "sedan", name: "Sedán" },
  { id: "economico", name: "Económico" },
  { id: "suv", name: "SUV" },
  { id: "pickup", name: "Pick-up" },
  { id: "camioneta", name: "Camioneta" },
  { id: "lujo", name: "Lujo" },
];

const LUJO_BRANDS = ["bmw", "mercedes", "audi", "lexus", "porsche", "jaguar", "land rover", "range rover", "tesla", "infiniti", "cadillac", "maserati", "bentley", "ferrari", "lamborghini", "volvo"];
const SUV = ["cr-v", "crv", "rav4", "tucson", "sportage", "terios", "fortuner", "explorer", "edge", "highlander", "pilot", "santa fe", "kuga", "escape", "trailblazer", "tracker", "captiva", "outlander", "x-trail", "xtrail", "pathfinder", "4runner", "grand cherokee", "cherokee", "compass", "renegade", "ecosport", "duster", "creta"];
const PICKUP = ["hilux", "tacoma", "tundra", "ranger", "f-150", "f150", "silverado", "colorado", "frontier", "np300", "amarok", "l200", "dmax", "d-max", "bt-50", "tornado", "rampage", "gladiator"];
const CAMIONETA = ["hiace", "sienna", "odyssey", "caravan", "h1", "h-1", "transit", "sprinter", "express", "savana", "starex", "town & country", "town and country", "quest", "previa", "eurovan"];
const ECONOMICO = ["spark", "picanto", "aveo", "i10", "i20", "fit", "yaris", "march", "kwid", "mirage", "celerio", "alto", "swift", "polo", "gol", "up!", "fiesta", "ka"];

export const inferCategory = (brand: string, model: string): VehicleCategory => {
  const text = `${brand} ${model}`.toLowerCase().trim();
  const brandLc = brand.toLowerCase().trim();
  if (LUJO_BRANDS.some((b) => brandLc.includes(b) || text.includes(b))) return "lujo";
  if (PICKUP.some((k) => text.includes(k))) return "pickup";
  if (CAMIONETA.some((k) => text.includes(k))) return "camioneta";
  if (SUV.some((k) => text.includes(k))) return "suv";
  if (ECONOMICO.some((k) => text.includes(k))) return "economico";
  return "sedan";
};
