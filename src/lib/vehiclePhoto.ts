import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a vehicle photo path to a usable URL.
 * - Returns absolute URLs as-is.
 * - Tries the public `vehicle-photos` bucket first.
 * - Falls back to a signed URL from the private `owner-documents` bucket.
 */
export const resolveVehiclePhoto = async (
  path?: string | null,
  fallback = "/placeholder.svg"
): Promise<string> => {
  if (!path) return fallback;
  if (path.startsWith("http")) return path;

  const pub = supabase.storage.from("vehicle-photos").getPublicUrl(path);
  try {
    const head = await fetch(pub.data.publicUrl, { method: "HEAD" });
    if (head.ok) return pub.data.publicUrl;
  } catch {}

  const { data: signed } = await supabase.storage
    .from("owner-documents")
    .createSignedUrl(path, 60 * 60);
  return signed?.signedUrl || fallback;
};

export const resolveVehiclePhotos = async (
  paths?: string[] | null,
  fallback = "/placeholder.svg"
): Promise<string[]> => {
  if (!paths || paths.length === 0) return [fallback];
  return Promise.all(paths.map((p) => resolveVehiclePhoto(p, fallback)));
};
