// src/lib/recorteImagen.ts
// Carga de imágenes y recorte de fondo en el navegador. Lo comparten «Pruébalo en tu espacio»
// (ficha de producto) y la escena de la portada. La lógica pura del recorte vive en
// lib/escenaEspacio.ts (`quitarFondo`); aquí solo está lo que necesita DOM (Image, canvas).
import { quitarFondo } from "./escenaEspacio";

export interface RecorteListo {
  url: string; // dataURL (PNG con transparencia) o foto original si no se pudo recortar
  canvas: HTMLCanvasElement | HTMLImageElement;
  w: number;
  h: number;
  fondoQuitado: boolean;
}

export const MAX_RECORTE = 900;

/** Carga una imagen; con crossOrigin anónimo para poder leer sus píxeles (Cloudinary lo permite). */
export function cargarImagen(src: string, cors = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    if (cors) im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    im.src = src;
  });
}

/** Foto del producto → recorte con fondo transparente. Si no se puede, devuelve la foto tal cual. */
export async function prepararRecorte(src: string): Promise<RecorteListo> {
  try {
    const im = await cargarImagen(src, true);
    const k = Math.min(1, MAX_RECORTE / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.round(im.naturalWidth * k);
    const h = Math.round(im.naturalHeight * k);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(im, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h); // lanza si el canvas quedó «tainted» por CORS
    const r = quitarFondo(px.data, w, h);
    if (!r.fondoQuitado) return { url: src, canvas: im, w: im.naturalWidth, h: im.naturalHeight, fondoQuitado: false };
    const out = document.createElement("canvas");
    out.width = r.width;
    out.height = r.height;
    out.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.width, r.height), 0, 0);
    return { url: out.toDataURL("image/png"), canvas: out, w: r.width, h: r.height, fondoQuitado: true };
  } catch {
    const im = await cargarImagen(src);
    return { url: src, canvas: im, w: im.naturalWidth, h: im.naturalHeight, fondoQuitado: false };
  }
}
