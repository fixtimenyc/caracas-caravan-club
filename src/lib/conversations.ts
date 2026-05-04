import { supabase } from "@/integrations/supabase/client";

/**
 * Get-or-create a conversation between a renter and an owner about a vehicle.
 * Returns the conversation id.
 */
export async function getOrCreateConversation(params: {
  renterId: string;
  ownerId: string;
  vehicleId?: string | null;
  reservationId?: string | null;
}): Promise<string> {
  const { renterId, ownerId, vehicleId = null, reservationId = null } = params;

  let query = supabase
    .from("conversations")
    .select("id")
    .eq("renter_id", renterId)
    .eq("owner_id", ownerId)
    .limit(1);

  if (vehicleId) query = query.eq("vehicle_id", vehicleId);
  else query = query.is("vehicle_id", null);

  const { data: existing, error: selErr } = await query;
  if (selErr) throw selErr;
  if (existing && existing.length > 0) return existing[0].id;

  const { data: created, error: insErr } = await supabase
    .from("conversations")
    .insert({
      renter_id: renterId,
      owner_id: ownerId,
      vehicle_id: vehicleId,
      reservation_id: reservationId,
    })
    .select("id")
    .single();

  if (insErr) throw insErr;
  return created.id;
}
