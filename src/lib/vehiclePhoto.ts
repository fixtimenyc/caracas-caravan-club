import { supabase } from "@/integrations/supabase/client";

const WEB_IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

/**
 * True when the file extension is safe to render in an <img> tag.
 * Filters out raw formats like .dng/.heic/.tiff/.cr2 that browsers won't display.
 */
export const isWebImagePath = (path?: string | null): boolean =>
  !!path && (path.startsWith("http") || WEB_IMAGE_EXT.test(path));

/**
 * Keep only browser-renderable images and deduplicate paths while preserving order.
 */
export const sanitizeVehiclePhotoPaths = (paths?: (string | null | undefined)[] | null): string[] => {
  if (!paths || paths.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    if (!p || !isWebImagePath(p) || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
};

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
  if (!isWebImagePath(path)) return fallback;

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
  const clean = sanitizeVehiclePhotoPaths(paths);
  if (clean.length === 0) return [fallback];
  return Promise.all(clean.map((p) => resolveVehiclePhoto(p, fallback)));
};
