// src/lib/envioNacional.ts
// Envío nacional (provincias): zonas + cálculo por volumen embalado (m³).
// Los datos viven en server/envio-zonas.json, que es la ÚNICA fuente de verdad:
// el servidor Express lee el mismo archivo para recalcular el flete al crear el pedido.
//
// IMPORTANTE: las tarifas son ESTIMADAS (no cotizaciones). Por eso en provincias el
// checkout NO cobra el flete en Niubiz: se cobra el producto y el flete se confirma
// por WhatsApp. Ver CLAUDE/README del cambio.
import zonasJson from "../../server/envio-zonas.json";

export type ZonaId = "Z1" | "Z2" | "Z3" | "Z4" | "Z5" | "Z6";

interface Destino {
  departamento: string;
  provincias: string[];
  zona_por_defecto: ZonaId;
  excepciones_por_provincia?: Record<string, ZonaId>;
}

interface ZonaInfo {
  nombre: string;
  tarifa_m3: { min: number; max: number } | null;
  flete_minimo: number | null;
}

const DESTINOS = zonasJson.destinos as Destino[];
const ZONAS = zonasJson.zonas as unknown as Record<ZonaId, ZonaInfo>;

/** Departamentos que se ofrecen en "Envío a provincias" (Lima Metropolitana y Callao usan el tarifario por distrito). */
export const DEPARTAMENTOS_PROVINCIA: string[] = DESTINOS.filter((d) => d.departamento !== "Callao").map(
  (d) => d.departamento,
);

/** Provincias de un departamento. En Lima se excluye la provincia de Lima (esa va por distrito). */
export function provinciasDe(departamento: string): string[] {
  const d = DESTINOS.find((x) => x.departamento === departamento);
  if (!d) return [];
  return d.provincias.filter((p) => getZona(departamento, p) !== "Z1");
}

export function getZona(departamento: string, provincia: string): ZonaId | null {
  const d = DESTINOS.find((x) => x.departamento === departamento);
  if (!d || !d.provincias.includes(provincia)) return null;
  return d.excepciones_por_provincia?.[provincia] ?? d.zona_por_defecto;
}

export function nombreZona(z: ZonaId): string {
  return ZONAS[z].nombre;
}

export type EstimacionEnvio =
  | { tipo: "estimado"; zona: ZonaId; min: number; max: number }
  | { tipo: "cotizar"; zona: ZonaId | null; motivo: "zona_sin_tarifa" | "sin_volumen" | "destino_invalido" };

/**
 * flete = max(mínimo de la zona, m³ × tarifa/m³ de la zona), como rango [min, max].
 * Devuelve "cotizar" si la zona no tiene tarifa (Z6), si falta el volumen de algún
 * producto del carrito o si el destino no existe. Nunca devuelve 0 como si fuera precio.
 */
export function estimarEnvioProvincia(
  departamento: string,
  provincia: string,
  volumenM3: number,
  faltaVolumen = false,
): EstimacionEnvio {
  const zona = getZona(departamento, provincia);
  if (!zona) return { tipo: "cotizar", zona: null, motivo: "destino_invalido" };
  const info = ZONAS[zona];
  if (!info.tarifa_m3 || info.flete_minimo == null) return { tipo: "cotizar", zona, motivo: "zona_sin_tarifa" };
  if (faltaVolumen || !(volumenM3 > 0)) return { tipo: "cotizar", zona, motivo: "sin_volumen" };
  const redondear = (n: number) => Math.round(n / 10) * 10;
  return {
    tipo: "estimado",
    zona,
    min: redondear(Math.max(info.flete_minimo, volumenM3 * info.tarifa_m3.min)),
    max: redondear(Math.max(info.flete_minimo, volumenM3 * info.tarifa_m3.max)),
  };
}