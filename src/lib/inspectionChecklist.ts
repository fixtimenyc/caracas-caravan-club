// Checklist completo para inspección de vehículo (entrega y devolución)
// Cada ítem se evalúa con: 'ok' | 'minor' | 'damage' | 'na'

export type InspectionItemState = "ok" | "minor" | "damage" | "na";

export interface ChecklistItem {
  key: string;
  label: string;
}

export interface ChecklistSection {
  key: string;
  title: string;
  items: ChecklistItem[];
}

export const INSPECTION_SECTIONS: ChecklistSection[] = [
  {
    key: "exterior",
    title: "Exterior y carrocería",
    items: [
      { key: "front_bumper", label: "Parachoques delantero" },
      { key: "rear_bumper", label: "Parachoques trasero" },
      { key: "hood", label: "Capó" },
      { key: "roof", label: "Techo" },
      { key: "trunk", label: "Maletero/Cajuela" },
      { key: "front_left_door", label: "Puerta delantera izquierda" },
      { key: "front_right_door", label: "Puerta delantera derecha" },
      { key: "rear_left_door", label: "Puerta trasera izquierda" },
      { key: "rear_right_door", label: "Puerta trasera derecha" },
      { key: "left_fender", label: "Guardafango izquierdo" },
      { key: "right_fender", label: "Guardafango derecho" },
      { key: "windshield", label: "Parabrisas" },
      { key: "rear_window", label: "Vidrio trasero" },
      { key: "side_mirrors", label: "Retrovisores" },
      { key: "paint", label: "Pintura general" },
    ],
  },
  {
    key: "lights",
    title: "Luces",
    items: [
      { key: "headlights", label: "Luces delanteras (altas/bajas)" },
      { key: "tail_lights", label: "Luces traseras" },
      { key: "brake_lights", label: "Luces de freno" },
      { key: "turn_signals", label: "Direccionales" },
      { key: "reverse_lights", label: "Luces de reversa" },
      { key: "interior_lights", label: "Luces interiores" },
      { key: "fog_lights", label: "Luces antiniebla" },
    ],
  },
  {
    key: "wheels",
    title: "Llantas y rines",
    items: [
      { key: "tire_fl", label: "Llanta delantera izquierda" },
      { key: "tire_fr", label: "Llanta delantera derecha" },
      { key: "tire_rl", label: "Llanta trasera izquierda" },
      { key: "tire_rr", label: "Llanta trasera derecha" },
      { key: "spare_tire", label: "Llanta de repuesto" },
      { key: "rims", label: "Rines" },
      { key: "lug_nuts", label: "Tuercas/pernos" },
    ],
  },
  {
    key: "interior",
    title: "Interior",
    items: [
      { key: "driver_seat", label: "Asiento del conductor" },
      { key: "passenger_seat", label: "Asiento del pasajero" },
      { key: "rear_seats", label: "Asientos traseros" },
      { key: "seatbelts", label: "Cinturones de seguridad" },
      { key: "dashboard", label: "Tablero" },
      { key: "steering_wheel", label: "Volante" },
      { key: "carpet", label: "Alfombras/tapetes" },
      { key: "headliner", label: "Tapizado del techo" },
      { key: "cleanliness", label: "Limpieza interior" },
      { key: "smell", label: "Olor (sin tabaco/humedad)" },
    ],
  },
  {
    key: "mechanical",
    title: "Mecánico y funcionamiento",
    items: [
      { key: "engine_start", label: "Encendido del motor" },
      { key: "brakes", label: "Frenos" },
      { key: "handbrake", label: "Freno de mano" },
      { key: "steering", label: "Dirección" },
      { key: "transmission", label: "Caja/transmisión" },
      { key: "ac", label: "Aire acondicionado" },
      { key: "heater", label: "Calefacción" },
      { key: "horn", label: "Bocina/claxon" },
      { key: "wipers", label: "Limpiaparabrisas" },
      { key: "windows", label: "Vidrios eléctricos" },
      { key: "central_lock", label: "Cierre centralizado" },
      { key: "warning_lights", label: "Sin testigos encendidos" },
    ],
  },
  {
    key: "documents",
    title: "Documentos y accesorios",
    items: [
      { key: "circulation_card", label: "Carnet de circulación" },
      { key: "soat", label: "Póliza de seguro" },
      { key: "vehicle_keys", label: "Llaves entregadas" },
      { key: "spare_key", label: "Llave de repuesto" },
      { key: "jack", label: "Gato hidráulico" },
      { key: "tools", label: "Herramientas básicas" },
      { key: "triangle", label: "Triángulo de emergencia" },
      { key: "extinguisher", label: "Extintor" },
      { key: "first_aid", label: "Botiquín" },
      { key: "manual", label: "Manual del propietario" },
    ],
  },
];

export const FUEL_LEVELS = [
  { value: "E", label: "Vacío (E)" },
  { value: "1/8", label: "1/8" },
  { value: "1/4", label: "1/4" },
  { value: "3/8", label: "3/8" },
  { value: "1/2", label: "1/2" },
  { value: "5/8", label: "5/8" },
  { value: "3/4", label: "3/4" },
  { value: "7/8", label: "7/8" },
  { value: "F", label: "Lleno (F)" },
];

export const STATE_META: Record<InspectionItemState, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  minor: { label: "Detalle menor", cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" },
  damage: { label: "Daño", cls: "bg-red-500/10 text-red-700 border-red-500/30" },
  na: { label: "N/A", cls: "bg-muted text-muted-foreground border-border" },
};

export const buildEmptyChecklist = (): Record<string, InspectionItemState> => {
  const out: Record<string, InspectionItemState> = {};
  INSPECTION_SECTIONS.forEach((s) => s.items.forEach((i) => (out[i.key] = "ok")));
  return out;
};

export const summarizeChecklist = (
  checklist: Record<string, InspectionItemState>
) => {
  const counts = { ok: 0, minor: 0, damage: 0, na: 0 };
  Object.values(checklist || {}).forEach((v) => {
    if (counts[v] !== undefined) counts[v]++;
  });
  return counts;
};
