// src/lib/analytics.ts
// GA4 + Meta Pixel. Se activan solo si defines las variables en Render (o en .env):
//   VITE_GA_MEASUREMENT_ID = G-XXXXXXXXXX
//   VITE_META_PIXEL_ID     = 1234567890123456
// Si no están definidas, no se carga nada y el resto del sitio sigue igual.

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

export function initAnalytics() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  try {
    initGA();
    initPixel();
  } catch {
    // la analítica nunca debe romper el sitio
  }
}

function ga(event: string, params: Record<string, unknown>) {
  try { window.gtag?.("event", event, params); } catch { /* noop */ }
}
function fb(event: string, params?: Record<string, unknown>, eventID?: string) {
  try {
    if (eventID) window.fbq?.("track", event, params ?? {}, { eventID });
    else window.fbq?.("track", event, params ?? {});
  } catch { /* noop */ }
}

let ultimaRuta = "";
export function trackPageView(path: string) {
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
