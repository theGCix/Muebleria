// src/lib/salaVirtual.ts
// Lógica pura de la «Sala virtual» (visor 3D en pantalla completa): ambientes de luz, vistas de cámara y
// puntos de medida. Sin DOM, para poder probarla con `node --test scripts/test-sala-virtual.mjs`.
// Paleta Japandi Premium (RULES #4): marfil, beige, marrón y verde bosque; sin nogal, dorado ni teal.

export type AmbienteId = "dia" | "atardecer" | "noche";

export interface Ambiente {
  id: AmbienteId;
  nombre: string;
  /** Fondo de la sala: pared arriba, piso abajo, con una transición suave en el horizonte. */
  fondo: string;
  /** Brillo del modelo (`exposure` de <model-viewer>). */
  exposicion: number;
  /** Intensidad de la sombra de contacto sobre el piso. */
  sombra: number;
}

export const AMBIENTES: Ambiente[] = [
  {
    id: "dia",
    nombre: "Día",
    fondo: "linear-gradient(180deg, #F5F1E8 0%, #EDE6D6 54%, #D8C3A5 64%, #C9B28F 100%)",
    exposicion: 1.05,
    sombra: 1.1,
  },
  {
    id: "atardecer",
    nombre: "Atardecer",
    fondo: "linear-gradient(180deg, #EBD9BF 0%, #D9BFA0 54%, #A98B69 64%, #8B735B 100%)",
    exposicion: 0.9,
    sombra: 1.3,
  },
  {
    id: "noche",
    nombre: "Noche",
    fondo: "linear-gradient(180deg, #34443A 0%, #26302A 54%, #1E2621 64%, #151B17 100%)",
    exposicion: 0.65,
    sombra: 0.8,
  },
];

export interface VistaCamara {
  id: "esquina" | "frente" | "arriba";
  nombre: string;
  /** Valor de `camera-orbit` de <model-viewer>: giro, ángulo desde arriba y distancia. */
  orbita: string;
}

export const VISTAS_CAMARA: VistaCamara[] = [
  { id: "esquina", nombre: "Esquina", orbita: "35deg 72deg auto" },
  { id: "frente", nombre: "Frente", orbita: "0deg 84deg auto" },
  { id: "arriba", nombre: "Desde arriba", orbita: "20deg 38deg auto" },
];

export interface Vec3 { x: number; y: number; z: number }

/** Metros (como los entrega <model-viewer>) → centímetros enteros. */
export const metrosACm = (m: number): number => Math.round(m * 100);

export interface PuntoMedida {
  id: "ancho" | "fondo" | "alto";
  etiqueta: string;
  /** Texto de `data-position` (metros, «x y z») para el hotspot. */
  posicion: string;
}

const f = (n: number) => String(Math.round(n * 10000) / 10000);
const pos = (x: number, y: number, z: number) => `${f(x)}m ${f(y)}m ${f(z)}m`;

/**
 * Tres medidas sobre la caja del modelo: ancho (borde frontal inferior), fondo (borde lateral inferior) y
 * alto (arista frontal derecha). Las cifras salen del propio archivo (`getDimensions`), no se escriben a mano.
 * Devuelve [] si el tamaño no es válido.
 */
export function puntosDeMedida(centro: Vec3, tam: Vec3): PuntoMedida[] {
  const ok = [centro.x, centro.y, centro.z, tam.x, tam.y, tam.z].every(Number.isFinite) && tam.x > 0 && tam.y > 0 && tam.z > 0;
  if (!ok) return [];
  const maxX = centro.x + tam.x / 2;
  const minY = centro.y - tam.y / 2;
  const maxZ = centro.z + tam.z / 2;
  return [
    { id: "ancho", etiqueta: `Ancho ${metrosACm(tam.x)} cm`, posicion: pos(centro.x, minY, maxZ) },
    { id: "fondo", etiqueta: `Fondo ${metrosACm(tam.z)} cm`, posicion: pos(maxX, minY, centro.z) },
    { id: "alto", etiqueta: `Alto ${metrosACm(tam.y)} cm`, posicion: pos(maxX, centro.y, maxZ) },
  ];
}

/* ───────── Modo «Mi espacio»: el sofá en vivo sobre la foto del cliente ─────────
 * Todo en fracciones de la foto (0–1) para que la imagen final coincida con lo que se ve en pantalla.
 * No hay medida real: el tamaño es solo visual (decisión del dueño, sin escala de dos puntos). */

export const TAMANO_MIN = 0.2;
export const TAMANO_MAX = 1.4;
export const TAMANO_INICIAL = 0.55;
export const BRILLO_MIN = 0.5;
export const BRILLO_MAX = 1.5;

const acotar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Tamaño del visor como fracción del ancho de la foto, siempre dentro de [TAMANO_MIN, TAMANO_MAX]. */
export const limitarTamano = (n: number): number => (Number.isFinite(n) ? acotar(n, TAMANO_MIN, TAMANO_MAX) : TAMANO_INICIAL);

export const limitarBrillo = (n: number): number => (Number.isFinite(n) ? acotar(n, BRILLO_MIN, BRILLO_MAX) : 1);

/** Giro en grados dentro de [0, 360). */
export const normalizarGiro = (g: number): number => (Number.isFinite(g) ? ((g % 360) + 360) % 360 : 0);

/** Pellizco con dos dedos: el tamaño cambia en la misma proporción que la distancia entre los dedos. */
export function tamanoPorPellizco(base: number, distInicial: number, distActual: number): number {
  if (!(distInicial > 0) || !Number.isFinite(distActual)) return limitarTamano(base);
  return limitarTamano(base * (distActual / distInicial));
}

export interface Centro { x: number; y: number }

/** Mueve el centro del sofá `dx`/`dy` píxeles sobre un escenario de `ancho` × `alto`; el centro no sale de la foto. */
export function moverCentro(c: Centro, dx: number, dy: number, ancho: number, alto: number): Centro {
  if (!(ancho > 0) || !(alto > 0)) return c;
  return { x: acotar(c.x + dx / ancho, 0, 1), y: acotar(c.y + dy / alto, 0, 1) };
}

export interface CajaPx { left: number; top: number; lado: number }

/** Caja cuadrada del visor en píxeles del escenario (el modelo se ajusta dentro de ella). */
export function cajaDelMueble(centro: Centro, tamano: number, ancho: number, alto: number): CajaPx {
  const lado = limitarTamano(tamano) * ancho;
  return { left: centro.x * ancho - lado / 2, top: centro.y * alto - lado / 2, lado };
}

/** Mayor tamaño que cabe dentro de `libreW` × `libreH` conservando la proporción de la foto. */
export function ajustarAlEspacio(fotoW: number, fotoH: number, libreW: number, libreH: number): { w: number; h: number } {
  if (!(fotoW > 0) || !(fotoH > 0) || !(libreW > 0) || !(libreH > 0)) return { w: 0, h: 0 };
  const k = Math.min(libreW / fotoW, libreH / fotoH);
  return { w: Math.floor(fotoW * k), h: Math.floor(fotoH * k) };
}
