// server/envioChat.js
// Cálculo de envío para el chatbot (herramienta `calcular_envio`).
//   · Lima y Callao: tarifa fija por distrito (server/envio-distritos.json, copia de src/lib/envios.ts).
//   · Provincias: estimación por zona y volumen (server/envio-zonas.json + envioNacional.js).
// Funciones puras, sin Supabase: se pueden probar sin red.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { calcularEnvioNacional } from "./envioNacional.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const leer = (f) => JSON.parse(readFileSync(path.join(here, f), "utf-8"));
const DISTRITOS = leer("envio-distritos.json");
const ZONAS = leer("envio-zonas.json");

/** minúsculas, sin tildes ni espacios sobrantes: "Áncash " → "ancash". */
export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buscarDistrito(nombre) {
  const n = normalizar(nombre);
  if (!n) return { exacto: null, sugerencias: [] };
  const exacto = DISTRITOS.distritos.find((d) => normalizar(d.destino) === n) ?? null;
  if (exacto) return { exacto, sugerencias: [] };
  const sugerencias = DISTRITOS.distritos
    .filter((d) => normalizar(d.destino).includes(n) || n.includes(normalizar(d.destino)))
    .slice(0, 5);
  return { exacto: null, sugerencias };
}

/** Devuelve los nombres oficiales { departamento, provincia } o null si no existen. */
export function resolverDestino(departamento, provincia) {
  const dep = ZONAS.destinos.find((d) => normalizar(d.departamento) === normalizar(departamento));
  if (!dep) return null;
  const prov = dep.provincias.find((p) => normalizar(p) === normalizar(provincia));
  return prov ? { departamento: dep.departamento, provincia: prov } : null;
}

/**
 * @param {{distrito?:string, departamento?:string, provincia?:string,
 *          producto?:{id:string, nombre?:string, volumen_m3:number|null}, cantidad?:number}} p
 * Devuelve un objeto serializable para el modelo. `ok:true` + `necesita` = falta un dato (no es un fallo).
 */
export function calcularEnvioChat({ distrito, departamento, provincia, producto, cantidad = 1 }) {
  // 1) Lima / Callao
  if (distrito && !departamento && !provincia) {
    const { exacto, sugerencias } = buscarDistrito(distrito);
    if (exacto) {
      return {
        tipo: "lima_callao",
        distrito: exacto.destino,
        precio_soles: exacto.precio,
        origen: DISTRITOS.origen,
        nota: "Tarifa por distrito. Se confirma en el checkout.",
      };
    }
    return {
      encontrado: false,
      mensaje: "Ese distrito no figura en la tarifa de Lima y Callao.",
      sugerencias: sugerencias.map((s) => s.destino),
    };
  }

  // 2) Provincias
  if (!departamento || !provincia) {
    return {
      ok: true,
      necesita: "Pide al cliente su distrito (Lima/Callao) o su departamento y provincia.",
    };
  }
  const destino = resolverDestino(departamento, provincia);
  if (!destino) {
    return {
      encontrado: false,
      mensaje: "No reconozco ese departamento/provincia. Pide al cliente que lo confirme.",
    };
  }

  const items = producto ? [{ product_id: producto.id, qty: cantidad }] : [];
  const productos = producto ? [{ id: producto.id, volumen_m3: producto.volumen_m3 }] : [];
  const r = calcularEnvioNacional({ ...destino, items, productos });
  const zona = r.zona ? ZONAS.zonas[r.zona] : null;

  const base = { tipo: "provincia", ...destino, zona: zona?.nombre ?? null };
  if (r.estado === "por_confirmar") {
    return {
      ...base,
      estado: "estimado",
      desde_soles: r.min,
      hasta_soles: r.max,
      volumen_m3: r.volumen,
      nota: "ESTIMADO referencial; el costo final lo confirma el equipo antes de cobrar. No lo presentes como precio final.",
    };
  }
  return {
    ...base,
    estado: "por_cotizar",
    nota: producto
      ? "No se puede estimar con los datos disponibles (zona sin tarifa o producto sin volumen). Indica que el equipo lo cotizará."
      : "Para estimar necesito un producto concreto (usa buscar_productos y pasa su id). Si no, el equipo lo cotizará.",
  };
}
