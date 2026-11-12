// src/lib/recuperacionCarrito.ts
// Plantillas y enlaces para recuperar un carrito abandonado a mano (WhatsApp o correo).
// Los textos reutilizan los de n8n/armar-correo-carrito.js (aviso 1 y aviso 2 con cupón) para que el
// cliente reciba el mismo tono tanto del aviso automático como del manual.
// NUNCA inventa datos: solo usa el nombre, los productos y el total que ya tiene el carrito.

export type CanalRecuperacion = "whatsapp" | "correo";
export type PlantillaId = "recordatorio" | "cupon";

/** Mismos valores que n8n (CUPON_PORCENTAJE, CUPON_HORAS) y que la función SQL cupon_recuperacion_carrito. */
export const CUPON_PORCENTAJE = 5;
export const CUPON_HORAS = 48;

/** Dirección pública de la tienda (la misma que usa n8n). */
export const SITIO_URL = "https://muebleria-q74c.onrender.com";

export interface DatosCarrito {
  nombre?: string | null;
  items: Array<{ title: string; price: number; qty: number }>;
  subtotal: number;
}

export const PLANTILLAS: Record<PlantillaId, { label: string; descripcion: string; requiereCupon: boolean }> = {
  recordatorio: { label: "Recordatorio", descripcion: "Avisa que sus productos siguen guardados", requiereCupon: false },
  cupon: { label: "Con cupón de recuperación", descripcion: `${CUPON_PORCENTAJE}% · ${CUPON_HORAS} h · un solo uso (solo administrador)`, requiereCupon: true },
};

// Misma validación que n8n
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;
export const esCorreoValido = (correo: string | null | undefined) => EMAIL_RE.test(String(correo ?? "").trim());

const sinSaltos = (s: unknown) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();
const soles = (n: number) => "S/ " + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const primerNombre = (nombre: string | null | undefined) => sinSaltos(nombre).split(" ")[0] || "";

/** Enlace al checkout con UTM (como n8n, pero con utm_source=panel para distinguir el envío manual). */
export function enlaceRecuperacion(canal: CanalRecuperacion, plantilla: PlantillaId, origen: string = SITIO_URL): string {
  const base = origen.replace(/\/$/, "");
  const medio = canal === "correo" ? "email" : "whatsapp";
  return `${base}/checkout?utm_source=panel&utm_medium=${medio}&utm_campaign=carrito_abandonado&utm_content=manual_${plantilla}`;
}

export function asuntoCorreo(plantilla: PlantillaId, nombre: string | null | undefined): string {
  const n = primerNombre(nombre);
  return plantilla === "recordatorio"
    ? `${n ? n + ", tu" : "Tu"} carrito te está esperando — G&M Mueblería`
    : `${n ? n + ", un" : "Un"} ${CUPON_PORCENTAJE}% de descuento para tu carrito — G&M Mueblería`;
}

const INTRO: Record<CanalRecuperacion, Record<PlantillaId, string>> = {
  correo: {
    recordatorio: "Dejaste estos muebles en tu carrito. Siguen guardados; si tienes dudas de medidas, materiales o tiempos de entrega, responde este correo o escríbenos por WhatsApp.",
    cupon: "Son piezas hechas a mano y el stock es limitado. Para ayudarte a decidir, te dejamos un cupón exclusivo para este carrito.",
  },
  whatsapp: {
    recordatorio: "Siguen guardados; si tienes dudas de medidas, materiales o tiempos de entrega, escríbenos por aquí.",
    cupon: "Son piezas hechas a mano y el stock es limitado. Para ayudarte a decidir, te dejamos un cupón exclusivo para este carrito.",
  },
};

export interface OpcionesMensaje {
  canal: CanalRecuperacion;
  plantilla: PlantillaId;
  carrito: DatosCarrito;
  /** Código de cupón ya obtenido (solo para la plantilla con cupón). */
  cuponCodigo?: string | null;
  origen?: string;
}

/** Texto del mensaje (sin HTML). El personal puede editarlo antes de enviarlo. */
export function construirMensaje({ canal, plantilla, carrito, cuponCodigo, origen }: OpcionesMensaje): string {
  const nombre = primerNombre(carrito.nombre);
  const items = (carrito.items ?? []).filter((i) => i && i.title).slice(0, 5);
  const lineas = items.map((i) => `- ${sinSaltos(i.title)} x${i.qty}: ${soles(Number(i.price || 0) * Number(i.qty || 1))}`);
  const total = (carrito.items ?? []).reduce((a, i) => a + Number(i.price || 0) * Number(i.qty || 1), 0) || carrito.subtotal;
  const url = enlaceRecuperacion(canal, plantilla, origen);
  const cupon = plantilla === "cupon" && cuponCodigo
    ? `Cupón ${CUPON_PORCENTAJE}% (${CUPON_HORAS} h, un solo uso): ${cuponCodigo}`
    : "";

  if (canal === "correo") {
    return [
      nombre ? `Hola ${nombre},` : "Hola,",
      INTRO.correo[plantilla],
      "",
      ...lineas,
      `Total: ${soles(total)}`,
      cupon ? `\n${cupon}` : "",
      `\nCompletar mi pedido: ${url}`,
      "\nG&M Mueblería · Si no quieres más recordatorios, responde NO.",
    ].join("\n");
  }
  return [
    `Hola${nombre ? " " + nombre : ""} 👋 Vimos que dejaste productos en tu carrito de G&M Mueblería:`,
    ...lineas,
    `Total: ${soles(total)}`,
    "",
    INTRO.whatsapp[plantilla],
    cupon,
    `Completa tu pedido aquí: ${url}`,
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

/** Enlace mailto: (se abre en el correo del propio personal; el sistema no envía correos desde la app). */
export function mailtoLink(correo: string, asunto: string, cuerpo: string): string {
  return `mailto:${encodeURIComponent(String(correo).trim())}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}
