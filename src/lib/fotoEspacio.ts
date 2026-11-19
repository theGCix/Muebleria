// src/lib/fotoEspacio.ts
// Foto del cliente para «Mi espacio» (sala virtual): se reduce a MAX_LADO en el propio dispositivo
// (las fotos de celular pesan 10+ MB) y no se sube a ningún servidor.
import { cargarImagen } from "./recorteImagen";

export const MAX_LADO_FOTO = 1600;

export interface FotoEspacio {
  img: HTMLImageElement;
  /** JPEG reducido (data URL), para mostrarlo de fondo. */
  url: string;
  w: number;
  h: number;
}

export async function prepararFotoEspacio(file: File): Promise<FotoEspacio> {
  const origen = URL.createObjectURL(file);
  try {
    const im = await cargarImagen(origen);
    const k = Math.min(1, MAX_LADO_FOTO / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.round(im.naturalWidth * k);
    const h = Math.round(im.naturalHeight * k);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(im, 0, 0, w, h);
    const url = c.toDataURL("image/jpeg", 0.9);
    return { img: await cargarImagen(url), url, w, h };
  } finally {
    URL.revokeObjectURL(origen);
  }
}
