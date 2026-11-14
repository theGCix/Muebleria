// src/lib/escenaEspacio.ts
// «Pruébalo en tu espacio»: lógica pura (sin DOM) para recortar el fondo de la foto del producto,
// calibrar la escala de la foto del cliente y calcular el tamaño del mueble en pantalla.
// Todo es aproximado: es una imagen 2D, sin perspectiva ni luz. La página lo dice al cliente.
import type { Pieza } from "./piezas";

export interface Punto {
  /** Fracción del ancho de la foto (0–1). */
  x: number;
  /** Fracción del alto de la foto (0–1). */
  y: number;
}

export interface Recorte {
  /** RGBA ya recortado al borde del mueble (sin márgenes de fondo). */
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** false = no se pudo separar el fondo (foto con ambiente, degradado, etc.). */
  fondoQuitado: boolean;
  /** Fracción de píxeles que se consideró fondo (0–1). */
  cobertura: number;
}

/** Referencias que el cliente reconoce en su foto, con su medida real. */
export const REFERENCIAS = [
  { id: "puerta", nombre: "Alto de una puerta", cm: 210 },
  { id: "libre", nombre: "Otra medida que conozco", cm: null },
] as const;

/** Sin calibrar, el mueble ocupa esta fracción del ancho de la foto. */
export const ANCHO_POR_DEFECTO = 0.45;
export const AJUSTE_MIN = 0.4;
export const AJUSTE_MAX = 2;

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/* ───────────────────────── Recorte de fondo ───────────────────────── */

const distRgb = (d: Uint8ClampedArray, i: number, r: number, g: number, b: number) => {
  const dr = d[i] - r;
  const dg = d[i + 1] - g;
  const db = d[i + 2] - b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

/**
 * Quita el fondo liso de una foto de estudio (blanco, gris claro, crema…): inunda desde los bordes
 * los píxeles parecidos al color de las esquinas y los vuelve transparentes. Suaviza el borde y
 * recorta al contorno del mueble. Si las esquinas no son parecidas o casi todo cambia de fondo,
 * devuelve `fondoQuitado: false` y la imagen original.
 */
export function quitarFondo(rgba: Uint8ClampedArray, w: number, h: number, tolerancia = 34): Recorte {
  const total = w * h;
  const out = new Uint8ClampedArray(rgba);

  // Color de fondo = promedio de las 4 esquinas (bloques de hasta 3×3)
  const esquinas: [number, number][] = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  const colores = esquinas.map(([cx, cy]) => {
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = 0; dy < 3; dy++)
      for (let dx = 0; dx < 3; dx++) {
        const x = clamp(cx === 0 ? dx : cx - dx, 0, w - 1);
        const y = clamp(cy === 0 ? dy : cy - dy, 0, h - 1);
        const i = (y * w + x) * 4;
        r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++;
      }
    return [r / n, g / n, b / n];
  });
  const bg = [0, 1, 2].map((c) => colores.reduce((s, col) => s + col[c], 0) / colores.length);
  const esquinasParecidas = colores.every(
    (col) => Math.hypot(col[0] - bg[0], col[1] - bg[1], col[2] - bg[2]) <= tolerancia * 1.2,
  );

  const esFondo = (p: number) => {
    const i = p * 4;
    return rgba[i + 3] < 16 || distRgb(rgba, i, bg[0], bg[1], bg[2]) <= tolerancia;
  };

  // Inundación desde el borde (pila de enteros: sin recursión)
  const fondo = new Uint8Array(total);
  const pila = new Int32Array(total);
  let tope = 0;
  const meter = (p: number) => {
    if (!fondo[p] && esFondo(p)) {
      fondo[p] = 1;
      pila[tope++] = p;
    }
  };
  for (let x = 0; x < w; x++) { meter(x); meter((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { meter(y * w); meter(y * w + w - 1); }
  while (tope > 0) {
    const p = pila[--tope];
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) meter(p - 1);
    if (x < w - 1) meter(p + 1);
    if (y > 0) meter(p - w);
    if (y < h - 1) meter(p + w);
  }

  let nFondo = 0;
  for (let p = 0; p < total; p++) if (fondo[p]) nFondo++;
  const cobertura = nFondo / total;
  const fondoQuitado = esquinasParecidas && cobertura >= 0.08 && cobertura <= 0.97;

  if (!fondoQuitado) return { data: out, width: w, height: h, fondoQuitado: false, cobertura };

  // Aplicar transparencia; el borde se suaviza según qué tan lejos está del color de fondo
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    if (fondo[p]) {
      out[i + 3] = 0;
      continue;
    }
    const x = p % w;
    const y = (p - x) / w;
    const tocaFondo =
      (x > 0 && fondo[p - 1]) || (x < w - 1 && fondo[p + 1]) || (y > 0 && fondo[p - w]) || (y < h - 1 && fondo[p + w]);
    if (tocaFondo) {
      const d = distRgb(rgba, i, bg[0], bg[1], bg[2]);
      const a = clamp((d - tolerancia * 0.5) / (tolerancia * 1.2), 0, 1);
      out[i + 3] = Math.round(out[i + 3] * a);
    }
  }

  // Contorno del mueble: filas/columnas con al menos 2 píxeles opacos (ignora motas sueltas)
  const cols = new Uint16Array(w);
  const filas = new Uint16Array(h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (out[(y * w + x) * 4 + 3] > 40) {
        cols[x]++;
        filas[y]++;
      }
  const primero = (a: Uint16Array) => a.findIndex((v) => v >= 2);
  const ultimo = (a: Uint16Array) => {
    for (let i = a.length - 1; i >= 0; i--) if (a[i] >= 2) return i;
    return -1;
  };
  const x0 = primero(cols), x1 = ultimo(cols), y0 = primero(filas), y1 = ultimo(filas);
  if (x0 < 0 || y0 < 0 || x1 <= x0 || y1 <= y0) {
    return { data: out, width: w, height: h, fondoQuitado: false, cobertura };
  }

  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const crop = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const desde = ((y + y0) * w + x0) * 4;
    crop.set(out.subarray(desde, desde + cw * 4), y * cw * 4);
  }
  return { data: crop, width: cw, height: ch, fondoQuitado: true, cobertura };
}

/* ───────────────────────── Escala ───────────────────────── */

/**
 * Píxeles (de la foto original) que equivalen a 1 cm, a partir de dos puntos marcados sobre algo de
 * medida conocida. Devuelve null si los puntos están casi juntos o la medida no es válida.
 */
export function pxPorCm(a: Punto, b: Punto, fotoW: number, fotoH: number, refCm: number): number | null {
  if (!Number.isFinite(refCm) || refCm <= 0) return null;
  const px = Math.hypot((b.x - a.x) * fotoW, (b.y - a.y) * fotoH);
  // Menos de 2 % de la diagonal: el cliente tocó dos veces el mismo sitio
  if (px < Math.hypot(fotoW, fotoH) * 0.02) return null;
  return px / refCm;
}

/** Pieza principal (la más ancha) para mostrar cuando el producto trae varias. */
export function piezaPrincipal(piezas: Pieza[]): Pieza | null {
  const conAncho = piezas.filter((p) => p.ancho_cm !== null);
  if (conAncho.length === 0) return null;
  return conAncho.reduce((m, p) => ((p.ancho_cm ?? 0) > (m.ancho_cm ?? 0) ? p : m));
}

/**
 * Ancho del mueble como fracción del ancho de la foto.
 * Calibrada: ancho real × px/cm. Sin calibrar o sin medida: ANCHO_POR_DEFECTO.
 */
export function anchoFraccion(anchoCm: number | null, escala: number | null, fotoW: number): number {
  if (anchoCm && escala) return clamp((anchoCm * escala) / fotoW, 0.03, 1.5);
  return ANCHO_POR_DEFECTO;
}

/**
 * ¿La foto del producto está de frente? Compara la proporción alto/ancho del recorte con la real.
 * Una foto en ángulo hace que el ancho visible sea menor que el real y la escala salga algo corta.
 * Devuelve la razón (1 = coincide); null si falta alguna medida.
 */
export function razonProporcion(recW: number, recH: number, anchoCm: number | null, altoCm: number | null): number | null {
  if (!anchoCm || !altoCm || recW <= 0 || recH <= 0) return null;
  return recH / recW / (altoCm / anchoCm);
}

/** Texto corto con la medida mostrada, p. ej. «≈ 210 cm de ancho». */
export function etiquetaMedida(anchoCm: number | null, ajuste: number): string | null {
  if (!anchoCm) return null;
  return `≈ ${Math.round(anchoCm * ajuste)} cm de ancho`;
}
