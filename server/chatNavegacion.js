// server/chatNavegacion.js
// ─────────────────────────────────────────────────────────────
// Decide a qué páginas de la tienda enviar al cliente según lo que preguntó
// y lo que hicieron las herramientas del chatbot. Es lógica pura (sin red,
// sin modelo): barata, predecible y fácil de probar.
//
// Cada enlace tiene la forma que el frontend pasa a navigate() de TanStack Router:
//   { label, to, params?, search?, hash? }
// Si agregas o renombras rutas en src/routes, actualiza esta tabla.
// ─────────────────────────────────────────────────────────────
import { normalizar } from "./envioChat.js";

const MAX_ENLACES = 3;

const L = {
  catalogo: { label: "Ver el catálogo", to: "/catalogo" },
  envios: { label: "Plazos y envíos", to: "/envios" },
  terminos: { label: "Garantía y condiciones", to: "/terminos" },
  privacidad: { label: "Política de privacidad", to: "/privacidad" },
  medida: { label: "Pedir cotización a medida", to: "/", hash: "a-medida" },
  proyectos: { label: "Ver proyectos realizados", to: "/proyectos" },
  nosotros: { label: "Conocer el taller", to: "/nosotros" },
  testimonios: { label: "Ver testimonios", to: "/testimonios" },
  pedidos: { label: "Mis pedidos", to: "/perfil/pedidos" },
  direcciones: { label: "Mis direcciones", to: "/perfil/direcciones" },
  facturacion: { label: "Datos de facturación", to: "/perfil/facturacion" },
  favoritos: { label: "Mis favoritos", to: "/perfil/favoritos" },
  seguridad: { label: "Cambiar contraseña", to: "/perfil/seguridad" },
  perfil: { label: "Mi cuenta", to: "/perfil" },
  checkout: { label: "Ir a pagar", to: "/checkout" },
};

const categoria = (slug, label, sub) => ({
  label,
  to: "/categoria/$slug",
  params: { slug },
  ...(sub ? { search: { sub } } : {}),
});

/**
 * Intenciones por palabra clave. El orden importa: las más específicas van primero
 * (las pistas se comparan al inicio de palabra, así "sofa" también acepta "sofas").
 */
const INTENCIONES = [
  // Cuenta
  { pistas: ["contrasena", "clave", "password"], enlace: L.seguridad },
  { pistas: ["direccion de entrega", "mis direcciones", "guardar direccion"], enlace: L.direcciones },
  { pistas: ["factura", "boleta", "ruc", "comprobante"], enlace: L.facturacion },
  { pistas: ["favorito", "lista de deseos", "guardados"], enlace: L.favoritos },
  { pistas: ["mi cuenta", "mi perfil", "registrarme", "crear cuenta", "iniciar sesion"], enlace: L.perfil },
  // Pedidos y pago
  { pistas: ["mi pedido", "mis pedidos", "seguimiento", "rastrear", "estado de mi"], enlace: L.pedidos },
  { pistas: ["pagar", "checkout", "finalizar compra"], enlace: L.checkout },
  // Políticas
  { pistas: ["garantia", "devolucion", "devolver", "cambio", "cambiar", "reembolso", "reclamo", "reclamacion", "terminos", "condiciones"], enlace: L.terminos },
  { pistas: ["privacidad", "datos personales"], enlace: L.privacidad },
  // Envíos
  { pistas: ["envio", "entrega", "despacho", "delivery", "flete", "provincia", "recojo", "recoger", "demora", "cuanto tarda", "plazo"], enlace: L.envios },
  // Servicios
  { pistas: ["a medida", "medida", "personaliz", "cotiz", "diseno"], enlace: L.medida },
  { pistas: ["proyecto", "trabajos realizados", "portafolio", "galeria"], enlace: L.proyectos },
  { pistas: ["testimonio", "opinion", "resena", "clientes satisfechos"], enlace: L.testimonios },
  { pistas: ["taller", "fabrica", "fabrican", "madera", "material", "nosotros", "quienes son", "whatsapp", "contacto", "contactar", "ubicacion", "donde estan"], enlace: L.nosotros },
  // Catálogo por categoría (de lo más específico a lo más general)
  { pistas: ["mesa de centro", "mesas de centro"], enlace: categoria("accesorios", "Mesas de centro", "mesas-centro") },
  { pistas: ["mesa lateral", "mesas laterales"], enlace: categoria("accesorios", "Mesas laterales", "mesas-laterales") },
  { pistas: ["puff", "banqueta", "bancos de"], enlace: categoria("accesorios", "Puffs y bancos", "puffs-bancos") },
  { pistas: ["decoracion", "adorno"], enlace: categoria("accesorios", "Decoración", "decoracion") },
  { pistas: ["accesorio"], enlace: categoria("accesorios", "Accesorios") },
  { pistas: ["comedor", "silla", "mesa de comedor"], enlace: categoria("comedores", "Ver comedores") },
  { pistas: ["recamara", "dormitorio", "cama", "cabecera", "comoda", "colchon"], enlace: categoria("recamaras", "Ver recámaras") },
  { pistas: ["separador", "biombo", "divisor", "division"], enlace: categoria("separadores", "Ver separadores") },
  { pistas: ["juego de sala", "sofa", "sillon", "mueble de sala", "sala", "living", "departamento"], enlace: categoria("muebles", "Ver muebles de sala", "sala") },
  { pistas: ["mueble", "catalogo", "productos", "que venden"], enlace: L.catalogo },
];

function contiene(textoNormalizado, pista) {
  return ` ${textoNormalizado} `.includes(` ${pista}`);
}

/** Intenciones que coinciden con el texto, sin repetir destino, en orden de la tabla. */
export function enlacesPorTexto(texto) {
  const t = normalizar(String(texto ?? ""));
  if (!t) return [];
  const vistos = new Set();
  const out = [];
  for (const { pistas, enlace } of INTENCIONES) {
    if (!pistas.some((p) => contiene(t, p))) continue;
    const clave = `${enlace.to}|${JSON.stringify(enlace.params ?? {})}|${JSON.stringify(enlace.search ?? {})}|${enlace.hash ?? ""}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(enlace);
  }
  return out;
}

function recortar(s, n = 38) {
  const t = String(s ?? "").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Enlaces que salen de lo que hicieron las herramientas (producto hallado, envío calculado…). */
export function enlacesPorHallazgos(h = {}) {
  const out = [];
  for (const p of (h.productos ?? []).slice(0, 2)) {
    if (!p?.id) continue;
    out.push({
      label: `Ver ${recortar(p.nombre) || "producto"}`,
      to: "/product/$handle",
      params: { handle: String(p.id) },
    });
  }
  if (h.carrito) out.push(L.checkout);
  if (h.pedido) out.push(L.pedidos);
  if (h.envio) out.push(L.envios);
  return out;
}

/**
 * Enlaces finales del turno: primero lo concreto (productos, pedido), luego lo que
 * pidió el cliente por texto. Sin duplicados, máximo MAX_ENLACES.
 */
export function enlacesDeTurno({ texto, hallazgos } = {}) {
  const todos = [...enlacesPorHallazgos(hallazgos), ...enlacesPorTexto(texto)];
  const vistos = new Set();
  const out = [];
  for (const e of todos) {
    const clave = `${e.to}|${JSON.stringify(e.params ?? {})}|${JSON.stringify(e.search ?? {})}|${e.hash ?? ""}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(e);
    if (out.length >= MAX_ENLACES) break;
  }
  return out;
}
