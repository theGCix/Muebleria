// server/envioNacional.js
// Recalcula en el servidor el envío a provincias (no se confía en lo que manda el navegador).
// Usa el mismo server/envio-zonas.json que el frontend (src/lib/envioNacional.ts).
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(readFileSync(path.join(here, "envio-zonas.json"), "utf-8"));

export function getZona(departamento, provincia) {
  const d = DATA.destinos.find((x) => x.departamento === departamento);
  if (!d || !d.provincias.includes(provincia)) return null;
  return d.excepciones_por_provincia?.[provincia] ?? d.zona_por_defecto;
}

const redondear10 = (n) => Math.round(n / 10) * 10;

/**
 * @param {{departamento:string, provincia:string, items:{product_id:string, qty:number}[], productos:{id:string, volumen_m3:number|null}[]}} p
 * @returns {{zona:string|null, estado:'por_confirmar'|'por_cotizar', volumen:number, min:number|null, max:number|null}}
 */
export function calcularEnvioNacional({ departamento, provincia, items, productos }) {
  const zona = getZona(departamento, provincia);
  const vols = new Map((productos ?? []).map((p) => [p.id, p.volumen_m3 == null ? null : Number(p.volumen_m3)]));

  let volumen = 0;
  let falta = false;
  for (const it of items ?? []) {
    const v = vols.get(it.product_id);
    if (v == null || !(v > 0)) falta = true;
    else volumen += v * Number(it.qty || 0);
  }
  volumen = Math.round(volumen * 1000) / 1000;

  const info = zona ? DATA.zonas[zona] : null;
  if (!zona || zona === "Z1" || !info?.tarifa_m3 || info.flete_minimo == null || falta || !(volumen > 0)) {
    return { zona, estado: "por_cotizar", volumen, min: null, max: null };
  }
  return {
    zona,
    estado: "por_confirmar",
    volumen,
    min: redondear10(Math.max(info.flete_minimo, volumen * info.tarifa_m3.min)),
    max: redondear10(Math.max(info.flete_minimo, volumen * info.tarifa_m3.max)),
  };
}