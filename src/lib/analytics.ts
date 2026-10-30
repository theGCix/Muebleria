// src/lib/analytics.ts
// GA4 + Meta Pixel. Se activan solo si defines las variables en Render (o en .env):
//   VITE_GA_MEASUREMENT_ID = G-XXXXXXXXXX
//   VITE_META_PIXEL_ID     = 1234567890123456
// Si no están definidas, no se carga nada y el resto del sitio sigue igual.

import { esRutaStaff } from "@/lib/rutas";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[][]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
  }
}

const GA_ID = ((import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) ?? "").trim();
const PIXEL_ID = ((import.meta.env.VITE_META_PIXEL_ID as string | undefined) ?? "").trim();

const gaActivo = /^G-[A-Z0-9]{4,}$/.test(GA_ID) && GA_ID !== "G-XXXXXXXXXX";
const pixelActivo = /^\d{6,}$/.test(PIXEL_ID);

export const CURRENCY = "PEN";
let iniciado = false;

function initGA() {
  if (!gaActivo) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  // send_page_view:false → los page_view los mandamos nosotros en cada cambio de ruta (SPA)
  window.gtag("config", GA_ID, { send_page_view: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

function initPixel() {
  if (!pixelActivo) return;
  if (window.fbq) return;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue!.push(args);
  } as NonNullable<Window["fbq"]>;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  window.fbq("init", PIXEL_ID);
}

/**
 * Excluye TU navegador de las métricas: abre el sitio una vez con ?no_track=1
 * (y ?no_track=0 para volver a medirte). Útil para no contar tus pruebas ni las del equipo.
 */
function excluido(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("no_track");
    if (q === "1") localStorage.setItem("gm_no_track", "1");
    if (q === "0") localStorage.removeItem("gm_no_track");
    return localStorage.getItem("gm_no_track") === "1";
  } catch {
    return false;
  }
}
let omitir = false;

export function initAnalytics() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  omitir = excluido();
  if (omitir) return;
  try {
    initGA();
    initPixel();
  } catch {
    // la analítica nunca debe romper el sitio
  }
}

// Quita claves undefined para no mandar parámetros vacíos a GA4/Meta
const limpiar = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));

function ga(event: string, params: Record<string, unknown>) {
  if (omitir) return;
  try { window.gtag?.("event", event, params); } catch { /* noop */ }
}
function fb(event: string, params?: Record<string, unknown>, eventID?: string) {
  if (omitir) return;
  try {
    if (eventID) window.fbq?.("track", event, params ?? {}, { eventID });
    else window.fbq?.("track", event, params ?? {});
  } catch { /* noop */ }
}

let ultimaRuta = "";
let temporizadorPV: ReturnType<typeof setTimeout> | undefined;

/**
 * Programa el page_view de una navegación (SPA). Se espera un instante para que la página
 * ya haya puesto su título real (page_title correcto) y se ignora el panel interno del negocio.
 */
export function programarPageView(path: string) {
  clearTimeout(temporizadorPV);
  if (esRutaStaff(path)) {
    ultimaRuta = "";
    return;
  }
  temporizadorPV = setTimeout(() => trackPageView(window.location.pathname), 400);
}

export function trackPageView(path: string) {
  if (esRutaStaff(path)) return;
  if (path === ultimaRuta) return;
  ultimaRuta = path;
  ga("page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
  fb("PageView");
}

type Item = { id: string; nombre?: string; precio?: number; cantidad?: number; categoria?: string | null };

const gaItems = (items: Item[]) =>
  items.map((i) => ({
    item_id: i.id,
    item_name: i.nombre,
    item_category: i.categoria ?? undefined,
    price: i.precio,
    quantity: i.cantidad ?? 1,
  }));

export function trackViewItem(i: Item) {
  ga("view_item", { currency: CURRENCY, value: i.precio ?? 0, items: gaItems([i]) });
  fb("ViewContent", { content_ids: [i.id], content_type: "product", content_name: i.nombre, value: i.precio ?? 0, currency: CURRENCY });
}

export function trackAddToCart(i: Item) {
  const value = (i.precio ?? 0) * (i.cantidad ?? 1);
  ga("add_to_cart", { currency: CURRENCY, value, items: gaItems([i]) });
  fb("AddToCart", { content_ids: [i.id], content_type: "product", content_name: i.nombre, value, currency: CURRENCY });
}

export function trackBeginCheckout(value: number, items?: Item[]) {
  ga("begin_checkout", { currency: CURRENCY, value, items: items ? gaItems(items) : undefined });
  fb("InitiateCheckout", { value, currency: CURRENCY, num_items: items?.length });
}

/** Compra confirmada. Se manda una sola vez por pedido (aunque el efecto corra de nuevo). */
export function trackPurchase(orderId: string, value: number) {
  const key = `gm_purchase_${orderId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch { /* noop */ }
  ga("purchase", { transaction_id: orderId, value, currency: CURRENCY });
  fb("Purchase", { value, currency: CURRENCY }, orderId);
}

/**
 * Intención de compra por canal directo.
 *  - "whatsapp"   → clic al asesor por WhatsApp   (Meta: Contact)
 *  - "cotizacion" → formulario de cotización       (Meta: Lead)
 *  - "cupon"      → correo dejado por el cupón     (Meta: Lead)
 * En GA4 todos van como generate_lead con `lead_source` (márcalo como evento clave en GA4).
 */
export function trackLead(origen: "whatsapp" | "cotizacion" | "cupon", i?: Partial<Item>) {
  const items = i?.id ? gaItems([{ id: i.id, nombre: i.nombre, precio: i.precio, categoria: i.categoria }]) : undefined;
  ga("generate_lead", limpiar({ currency: CURRENCY, value: i?.precio, lead_source: origen, items }));
  fb(
    origen === "whatsapp" ? "Contact" : "Lead",
    limpiar({
      content_name: i?.nombre,
      content_ids: i?.id ? [i.id] : undefined,
      value: i?.precio,
      currency: i?.precio != null ? CURRENCY : undefined,
      lead_source: origen,
    }),
  );
}

/** Búsqueda en el catálogo (todas las búsquedas públicas terminan en /catalogo?q=). */
export function trackSearch(termino: string) {
  const t = termino.trim();
  if (t.length < 2) return;
  ga("search", { search_term: t });
  fb("Search", { search_string: t });
}
