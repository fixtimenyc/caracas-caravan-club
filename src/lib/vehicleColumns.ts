import { supabase } from "@/integrations/supabase/client";

/**
 * Columns of `vehicles` that are readable directly by clients.
 * Sensitive fields (plate, vin, document URLs, internal notes) are protected at the
 * database level and must be fetched through the secure RPCs below.
 */
export const VEHICLE_PUBLIC_COLUMNS =
  "id, owner_id, brand, model, year, location, price_per_day, available, photos, description, active, created_at, updated_at, house_rules, features, custom_features, color, fuel_type, transmission, seats, soat_expiry, circulation_expiry, insurance_expiry, weekend_price, weekly_price, monthly_price, zone, gps_lat, gps_lng";

export type VehiclePrivateFields = {
  plate: string | null;
  vin: string | null;
  soat_doc_url: string | null;
  circulation_doc_url: string | null;
  insurance_doc_url: string | null;
  internal_notes: string | null;
};

/** Sensitive fields for a single vehicle (owner, admin or renter with a reservation). */
export async function fetchVehiclePrivateFields(
  vehicleId: string,
): Promise<VehiclePrivateFields | null> {
  if (!vehicleId) return null;
  const { data, error } = await supabase.rpc("get_vehicle_private_fields", {
    _vehicle_id: vehicleId,
  });
  if (error) return null;
  const row = Array.isArray(data) ? (data[0] as VehiclePrivateFields | undefined) : null;
  return row ?? null;
}

/** Sensitive fields for every vehicle the caller may see (admins: all, owners: their own). */
export async function fetchVehiclePrivateMap(): Promise<
  Record<string, VehiclePrivateFields>
> {
  const { data, error } = await supabase.rpc("list_vehicle_private_fields");
  if (error || !Array.isArray(data)) return {};
  const map: Record<string, VehiclePrivateFields> = {};
  for (const row of data as (VehiclePrivateFields & { vehicle_id: string })[]) {
    map[row.vehicle_id] = row;
  }
  return map;
}
