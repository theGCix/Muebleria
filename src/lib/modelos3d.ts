// Reglas puras de los modelos 3D (.glb) de la ficha. Sin imports: se prueba con scripts/test-modelos3d.mjs.
// Subida y borrado: productos.tsx (bucket «modelos-3d» de Supabase Storage).

export const BUCKET_MODELOS_3D = "modelos-3d";
export const MAX_MODELO_3D_BYTES = 5 * 1024 * 1024; // = file_size_limit del bucket (migración 20261119)

/** Mensaje de error si el archivo no sirve; null si es válido. */
export function validarModelo3d(nombre: string, bytes: number): string | null {
  if (!/\.glb$/i.test(nombre.trim())) return "El modelo debe ser un archivo .glb";
  if (bytes <= 0) return "El archivo está vacío";
  if (bytes > MAX_MODELO_3D_BYTES) {
    return `El modelo pesa ${(bytes / 1048576).toFixed(1)} MB; el máximo es ${MAX_MODELO_3D_BYTES / 1048576} MB`;
  }
  return null;
}

/** Un .glb válido empieza con los 4 bytes «glTF». */
export async function tieneCabeceraGlb(file: Blob): Promise<boolean> {
  const buf = await file.slice(0, 4).arrayBuffer();
  return new TextDecoder().decode(buf) === "glTF";
}

/** Ruta única dentro del bucket: «<slug>-<marca de tiempo>.glb» (nombre único → sin problemas de caché al reemplazar). */
export function rutaModelo3d(base: string, ahora: number = Date.now()): string {
  const slug = base
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40) || "modelo";
  return `${slug}-${ahora}.glb`;
}

/** Ruta dentro del bucket a partir de la URL pública; null si la URL no es de nuestro bucket. */
export function rutaDesdeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marca = `/object/public/${BUCKET_MODELOS_3D}/`;
  const i = url.indexOf(marca);
  if (i < 0) return null;
  const ruta = decodeURIComponent(url.slice(i + marca.length).split("?")[0]);
  return ruta || null;
}
