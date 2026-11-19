// src/lib/tapizado3d.ts
// Color del tapizado en la vista 3D de la ficha: el .glb trae UNA sola textura (atlas) con el tapizado
// y los detalles (madera, dorado, estampados). Se detecta el color base del tapizado, se enmascaran los
// píxeles cercanos a él y se recolorean conservando luz y sombra. Lo demás no se toca.
// Lógica pura sobre píxeles RGBA (sin DOM): se prueba con scripts/test-tapizado3d.mjs.
// El pegamento con <model-viewer> está al final (aplicarTapizado) y solo usa el DOM al ejecutarse.

export type RGB = [number, number, number];
export type Lab = [number, number, number];

/** «#rgb» o «#rrggbb» → [r,g,b] 0-255; null si no es un hex válido. */
export function hexARgb(hex: string | null | undefined): RGB | null {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const gam = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const fi = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
const BLANCO = [0.95047, 1, 1.08883];

export function rgbALab(r: number, g: number, b: number): Lab {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / BLANCO[0];
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / BLANCO[2];
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labARgb(L: number, a: number, b: number): RGB {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const x = fi(fx) * BLANCO[0], y = fi(fy), z = fi(fz) * BLANCO[2];
  const R = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const G = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const B = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(gam(Math.max(0, Math.min(1, v))))));
  return [c(R), c(G), c(B)];
}

const dist = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Color base del tapizado: el tono de croma bajo y luz media que más píxeles reúne (la textura es casi toda
 * tapizado). Agrupa en celdas de 6 unidades en a/b y 8 en L, y promedia la celda ganadora.
 */
export function detectarColorBase(data: Uint8ClampedArray | Uint8Array, paso = 7): Lab | null {
  const celdas = new Map<string, { n: number; L: number; a: number; b: number }>();
  for (let i = 0; i < data.length; i += 4 * paso) {
    if (data[i + 3] < 200) continue;
    const [L, a, b] = rgbALab(data[i], data[i + 1], data[i + 2]);
    if (L < 20 || L > 90 || Math.hypot(a, b) > 25) continue;
    const k = `${Math.floor(L / 8)}|${Math.floor(a / 6)}|${Math.floor(b / 6)}`;
    const c = celdas.get(k) ?? { n: 0, L: 0, a: 0, b: 0 };
    c.n++; c.L += L; c.a += a; c.b += b;
    celdas.set(k, c);
  }
  let mejor: { n: number; L: number; a: number; b: number } | null = null;
  for (const c of celdas.values()) if (!mejor || c.n > mejor.n) mejor = c;
  if (!mejor || mejor.n < 20) return null;
  return [mejor.L / mejor.n, mejor.a / mejor.n, mejor.b / mejor.n];
}

/** Colores que ofrece el visor 3D para probar el tapizado (null = el color original del modelo). */
export const PALETA_TAPIZADO: { nombre: string; hex: string | null }[] = [
  { nombre: "Original", hex: null },
  { nombre: "Crema", hex: "#e6dcc8" },
  { nombre: "Gris", hex: "#8a8d90" },
  { nombre: "Azul marino", hex: "#2f4a6b" },
  { nombre: "Verde", hex: "#4f6b4a" },
  { nombre: "Terracota", hex: "#a65d44" },
  { nombre: "Vino", hex: "#6e2a3a" },
  { nombre: "Negro", hex: "#232323" },
];

/** Tolerancia por defecto (distancia en Lab): deja fuera madera, dorado y estampados, y entra el tapizado con su sombra. */
export const TOLERANCIA_TAPIZADO = 16;

/** Peso 0-1 por píxel: 1 dentro del 60 % de la tolerancia, baja suave hasta 0 en el borde. */
export function crearMascara(data: Uint8ClampedArray | Uint8Array, base: Lab, tol = TOLERANCIA_TAPIZADO): Float32Array {
  const n = data.length / 4;
  const m = new Float32Array(n);
  const duro = tol * 0.6;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (data[i + 3] < 8) continue;
    const d = dist(rgbALab(data[i], data[i + 1], data[i + 2]), base);
    m[p] = d <= duro ? 1 : d >= tol ? 0 : 1 - (d - duro) / (tol - duro);
  }
  return m;
}

/**
 * Devuelve una copia de `data` con el tapizado (según la máscara) llevado al color `destino`, manteniendo
 * cada variación de luz, sombra y trama respecto al color base.
 */
export function recolorear(data: Uint8ClampedArray | Uint8Array, mascara: Float32Array, base: Lab, destino: RGB): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data);
  const [Ld, ad, bd] = rgbALab(destino[0], destino[1], destino[2]);
  // Luz: el contraste del tejido se escala con la luz del destino (un tapizado oscuro no pierde relieve ni uno claro se quema)
  const k = Math.max(0.5, Math.min(1.5, Ld / Math.max(base[0], 1)));
  for (let p = 0; p < mascara.length; p++) {
    const w = mascara[p];
    if (w <= 0) continue;
    const i = p * 4;
    const [L, a, b] = rgbALab(data[i], data[i + 1], data[i + 2]);
    const [r, g, bl] = labARgb(Ld + (L - base[0]) * k, ad + (a - base[1]) * 0.5, bd + (b - base[2]) * 0.5);
    out[i] = Math.round(data[i] + (r - data[i]) * w);
    out[i + 1] = Math.round(data[i + 1] + (g - data[i + 1]) * w);
    out[i + 2] = Math.round(data[i + 2] + (bl - data[i + 2]) * w);
  }
  return out;
}

// ───────────── Tela real: trama de la muestra sobre el tapizado ─────────────

export interface Muestra { w: number; h: number; data: Uint8ClampedArray | Uint8Array }

/** Media móvil horizontal+vertical (caja de radio r) de un canal; quita pliegues y sombras grandes de la foto de la muestra. */
function suavizar(v: Float32Array, w: number, h: number, r: number): Float32Array {
  const pasada = (src: Float32Array, n: number, m: number, paso: number, salto: number) => {
    const out = new Float32Array(src.length);
    for (let j = 0; j < m; j++) {
      const ini = j * salto;
      for (let i = 0; i < n; i++) {
        let suma = 0, cnt = 0;
        for (let d = -r; d <= r; d++) { const k = Math.min(n - 1, Math.max(0, i + d)); suma += src[ini + k * paso]; cnt++; }
        out[ini + i * paso] = suma / cnt;
      }
    }
    return out;
  };
  return pasada(pasada(v, w, h, 1, w), h, w, w, 1);
}

/**
 * Devuelve una copia de `data` con el tapizado (según la máscara) cubierto por la trama de la muestra, repetida en
 * espejo (sin costuras) y muestreada con suavizado (sin bloques). Conserva la luz y la sombra del modelo.
 * `destino` (opcional) lleva la tela a otro tono manteniendo su relieve; sin él, la tela conserva su color.
 * `tile` = lado en píxeles con que se repite la muestra. `patron`: telas con dibujo (floral, jaguar…): se conserva
 * el contraste completo de la muestra; en telas lisas solo el detalle fino de la trama. Un grano fino devuelve
 * nitidez cuando la muestra se amplía.
 */
export function texturizar(
  data: Uint8ClampedArray | Uint8Array, w: number, h: number, mascara: Float32Array, base: Lab,
  muestra: Muestra, tile: number, destino: RGB | null = null, patron = false,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data);
  const mw = muestra.w, mh = muestra.h, nm = mw * mh;
  const L = new Float32Array(nm), A = new Float32Array(nm), B = new Float32Array(nm);
  let mL = 0, mA = 0, mB = 0;
  for (let i = 0; i < nm; i++) {
    const [l, a, b] = rgbALab(muestra.data[i * 4], muestra.data[i * 4 + 1], muestra.data[i * 4 + 2]);
    L[i] = l; A[i] = a; B[i] = b; mL += l; mA += a; mB += b;
  }
  mL /= nm; mA /= nm; mB /= nm;
  // Luz relativa a la media de la muestra. Lisa: solo el detalle fino (se descartan pliegues de la foto). Con dibujo: todo.
  const rel = new Float32Array(nm);
  if (patron) {
    for (let i = 0; i < nm; i++) rel[i] = L[i] - mL;
  } else {
    const lisa = suavizar(L, mw, mh, Math.max(3, Math.round(Math.min(mw, mh) / 8)));
    for (let i = 0; i < nm; i++) rel[i] = (L[i] - lisa[i]) * 1.8;
  }
  const dst = destino ? rgbALab(destino[0], destino[1], destino[2]) : null;
  const lado = Math.max(8, tile);
  // Coordenada de la muestra (con decimales) para un píxel de la textura, en espejo
  const coord = (v: number, n: number) => {
    let f = ((v % (2 * lado)) / lado) * n;
    if (f > n) f = 2 * n - f;
    return Math.min(n - 1, Math.max(0, f));
  };
  const muestreo = (arr: Float32Array, x0: number, x1: number, y0: number, y1: number, tx: number, ty: number) =>
    (arr[y0 * mw + x0] * (1 - tx) + arr[y0 * mw + x1] * tx) * (1 - ty) + (arr[y1 * mw + x0] * (1 - tx) + arr[y1 * mw + x1] * tx) * ty;
  for (let y = 0; y < h; y++) {
    const fy = coord(y, mh), y0 = Math.floor(fy), y1 = Math.min(mh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const p = y * w + x, wgt = mascara[p];
      if (wgt <= 0) continue;
      const fx = coord(x, mw), x0 = Math.floor(fx), x1 = Math.min(mw - 1, x0 + 1), tx = fx - x0;
      const i = p * 4;
      const sombra = (rgbALab(data[i], data[i + 1], data[i + 2])[0] - base[0]) * 0.85; // luz del modelo
      const r = muestreo(rel, x0, x1, y0, y1, tx, ty);
      // Grano determinista (mismo resultado cada vez), ±2 de luz: da nitidez al tejido ampliado
      const g = ((Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0) / 4294967295 * 2 - 1;
      const Lt = (dst ? dst[0] : mL) + r + sombra + g * 2;
      const at = dst ? dst[1] + (muestreo(A, x0, x1, y0, y1, tx, ty) - mA) * 0.6 : muestreo(A, x0, x1, y0, y1, tx, ty);
      const bt = dst ? dst[2] + (muestreo(B, x0, x1, y0, y1, tx, ty) - mB) * 0.6 : muestreo(B, x0, x1, y0, y1, tx, ty);
      const [R, G, Bl] = labARgb(Lt, at, bt);
      out[i] = Math.round(data[i] + (R - data[i]) * wgt);
      out[i + 1] = Math.round(data[i + 1] + (G - data[i + 1]) * wgt);
      out[i + 2] = Math.round(data[i + 2] + (Bl - data[i + 2]) * wgt);
    }
  }
  return out;
}

// ───────────── Pegamento con <model-viewer> (solo navegador) ─────────────

interface Original { w: number; h: number; data: Uint8ClampedArray; base: Lab; mascara: Float32Array }
const originales = new WeakMap<object, Promise<Original | null>>();
const ultimaPeticion = new WeakMap<object, number>(); // si el cliente cambia de color rápido, solo gana la última

/**
 * Saca del .glb la imagen de la textura base del material 0 (model-viewer no la expone: su `uri` es un
 * nombre interno). Devuelve los bytes de la imagen y su tipo, o null si el modelo no la trae embebida.
 */
export function extraerTexturaGlb(glb: ArrayBuffer): { bytes: Uint8Array; mime: string } | null {
  const dv = new DataView(glb);
  if (glb.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67) return null; // «glTF»
  const lenJson = dv.getUint32(12, true);
  let json: any;
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, lenJson)));
  } catch {
    return null;
  }
  const binOff = 20 + lenJson;
  if (binOff + 8 > glb.byteLength) return null;
  const binLen = dv.getUint32(binOff, true);
  const bin = new Uint8Array(glb, binOff + 8, Math.min(binLen, glb.byteLength - binOff - 8));
  const idxTex = json.materials?.[0]?.pbrMetallicRoughness?.baseColorTexture?.index;
  const idxImg = json.textures?.[idxTex]?.source;
  const img = json.images?.[idxImg];
  const bv = json.bufferViews?.[img?.bufferView];
  if (!img || !bv) return null;
  const ini = bv.byteOffset ?? 0;
  return { bytes: bin.slice(ini, ini + bv.byteLength), mime: img.mimeType || "image/jpeg" };
}

async function leerOriginal(viewer: any): Promise<Original | null> {
  const src: string | undefined = viewer.src;
  if (!src) return null;
  const r = await fetch(src);
  if (!r.ok) return null;
  const tex = extraerTexturaGlb(await r.arrayBuffer());
  if (!tex) return null;
  const bmp = await createImageBitmap(new Blob([tex.bytes], { type: tex.mime }));
  const c = document.createElement("canvas");
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  const base = detectarColorBase(data);
  if (!base) return null;
  return { w: c.width, h: c.height, data, base, mascara: crearMascara(data, base) };
}

/**
 * Pinta el tapizado del modelo con `hex` (null/vacío → textura original). No lanza: si el modelo no
 * trae textura legible, deja el modelo como está y devuelve false.
 */
export async function aplicarTapizado(viewer: any, hex: string | null | undefined): Promise<boolean> {
  try {
    const material = viewer?.model?.materials?.[0];
    const slot = material?.pbrMetallicRoughness?.baseColorTexture;
    if (!slot) return false;
    const turno = (ultimaPeticion.get(viewer) ?? 0) + 1;
    ultimaPeticion.set(viewer, turno);
    if (!originales.has(viewer)) originales.set(viewer, leerOriginal(viewer));
    const o = await originales.get(viewer)!;
    if (!o || ultimaPeticion.get(viewer) !== turno) return false;

    const destino = hexARgb(hex);
    const c = document.createElement("canvas");
    c.width = o.w; c.height = o.h;
    const ctx = c.getContext("2d")!;
    const px = destino ? recolorear(o.data, o.mascara, o.base, destino) : o.data;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(px), o.w, o.h), 0, 0);
    const textura = await viewer.createTexture(c.toDataURL("image/png"));
    if (ultimaPeticion.get(viewer) !== turno) return false;
    slot.setTexture(textura);
    return true;
  } catch {
    return false;
  }
}

const muestras = new Map<string, Promise<Muestra | null>>();
function leerMuestra(url: string): Promise<Muestra | null> {
  if (!muestras.has(url)) {
    muestras.set(url, (async () => {
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        const bmp = await createImageBitmap(await r.blob());
        // Se descarta el 12 % de cada borde (etiquetas, bordes y sombras de la foto)
        const mx = Math.round(bmp.width * 0.12), my = Math.round(bmp.height * 0.12);
        const w = bmp.width - 2 * mx, h = bmp.height - 2 * my;
        // Se amplía 2× con suavizado de alta calidad: menos bloques al repetirla sobre el modelo
        const W = w * 2, H = h * 2;
        const c = document.createElement("canvas");
        c.width = W; c.height = H;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bmp, mx, my, w, h, 0, 0, W, H);
        return { w: W, h: H, data: ctx.getImageData(0, 0, W, H).data };
      } catch {
        return null;
      }
    })());
  }
  return muestras.get(url)!;
}

/** Lo que el cliente eligió: tela (si hay) y tono; `hex` es el color resultante (sirve de respaldo y para mostrar). */
export interface Tapizado { telaId: string | null; imagen: string | null; patron?: boolean; tonoHex: string | null; hex: string | null }
export const SIN_TAPIZADO: Tapizado = { telaId: null, imagen: null, tonoHex: null, hex: null };

/**
 * Pinta el modelo con la selección: con tela, cubre el tapizado con la trama de su muestra (y el tono si lo hay);
 * sin tela, solo recolorea como antes. Si la muestra no carga, cae al color. No lanza.
 */
export async function aplicarSeleccion(viewer: any, sel: Tapizado | null | undefined): Promise<boolean> {
  if (!sel || !sel.telaId || !sel.imagen) return aplicarTapizado(viewer, sel?.hex ?? null);
  try {
    const slot = viewer?.model?.materials?.[0]?.pbrMetallicRoughness?.baseColorTexture;
    if (!slot) return false;
    const turno = (ultimaPeticion.get(viewer) ?? 0) + 1;
    ultimaPeticion.set(viewer, turno);
    if (!originales.has(viewer)) originales.set(viewer, leerOriginal(viewer));
    const [o, muestra] = await Promise.all([originales.get(viewer)!, leerMuestra(sel.imagen)]);
    if (!o || ultimaPeticion.get(viewer) !== turno) return false;
    if (!muestra) return aplicarTapizado(viewer, sel.hex);
    const px = texturizar(o.data, o.w, o.h, o.mascara, o.base, muestra, Math.round(o.w / (sel.patron ? 6 : 12)), hexARgb(sel.tonoHex), !!sel.patron);
    const c = document.createElement("canvas");
    c.width = o.w; c.height = o.h;
    c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(px), o.w, o.h), 0, 0);
    const textura = await viewer.createTexture(c.toDataURL("image/png"));
    if (ultimaPeticion.get(viewer) !== turno) return false;
    slot.setTexture(textura);
    return true;
  } catch {
    return false;
  }
}
