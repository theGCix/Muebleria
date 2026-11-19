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
