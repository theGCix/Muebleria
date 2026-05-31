// ────────────────────────────────────────────────────────────
// Cloudinary helper  –  upload + delete images
// ────────────────────────────────────────────────────────────
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? "muebleria_unsigned";
const API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;

export interface CloudinaryResult {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
}

/**
 * Upload a file to Cloudinary using an unsigned preset.
 * Create the preset in: Cloudinary Dashboard → Settings → Upload → Upload presets
 * Set it to "Unsigned" and optionally restrict to images.
 */
export async function uploadImage(
  file: File,
  folder = "muebleria/productos"
): Promise<CloudinaryResult> {
  if (!CLOUD_NAME) throw new Error("VITE_CLOUDINARY_CLOUD_NAME no configurado");

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);
  form.append("folder", folder);
  form.append("api_key", API_KEY ?? "");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: form }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Error subiendo imagen a Cloudinary");
  }
  return res.json();
}

/** Returns a resized/optimized URL for display */
export function cloudinaryUrl(
  publicId: string,
  opts: { w?: number; h?: number; q?: number } = {}
): string {
  const { w = 600, h, q = 80 } = opts;
  const transforms = [`w_${w}`, `q_${q}`, "f_auto", h ? `h_${h}` : ""].filter(Boolean).join(",");
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${publicId}`;
}
