const isProd = import.meta.env.VITE_ENV === "prod";

export const API_URL = isProd
  ? import.meta.env.VITE_API_URL_PROD   // https://muebleria-api.onrender.com
  : import.meta.env.VITE_API_URL_LOCAL; // http://localhost:3001

export const APP_URL = isProd
  ? import.meta.env.VITE_APP_URL_PROD
  : import.meta.env.VITE_APP_URL_LOCAL;

/**
 * Número de WhatsApp de ventas (solo dígitos, con código de país: 51999999999).
 * Si no está definido, el botón de WhatsApp de la ficha de producto no se muestra.
 */
export const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined)?.replace(/\D/g, "") || undefined;

/**
 * Datos oficiales para pagar el flete a provincias por transferencia/Yape, tal como se mostrarán al cliente
 * dentro de "Mis pedidos". Ej: "Yape 999 999 999 · BCP 191-0000000-0-00 · A nombre de G&M Mueblería SAC".
 * Defínelo como VITE_PAGO_FLETE_TEXTO en Render. Si está vacío, se le pide al cliente que lo solicite por WhatsApp.
 */
export const PAGO_FLETE_TEXTO = ((import.meta.env.VITE_PAGO_FLETE_TEXTO as string | undefined) ?? "").trim() || undefined;

/**
 * Enlace del Libro de Reclamaciones virtual (el que te entrega Indecopi en "Tu Libro de Reclamaciones").
 * Pégalo aquí entre las comillas, o defínelo como VITE_LIBRO_RECLAMACIONES_URL en Render.
 * Mientras esté vacío (o no empiece con https://), el enlace no se muestra en el sitio.
 */
const LIBRO_RECLAMACIONES_MANUAL = "";
const libroUrl = ((import.meta.env.VITE_LIBRO_RECLAMACIONES_URL as string | undefined) || LIBRO_RECLAMACIONES_MANUAL).trim();
export const LIBRO_RECLAMACIONES_URL: string | undefined = /^https:\/\//i.test(libroUrl) ? libroUrl : undefined;


// ── Datos de la empresa (se muestran en Términos y Privacidad) ─────────────────────────
// Llénalos aquí entre las comillas, o como variables VITE_* en Render. Lo que quede vacío no se muestra.
const dato = (env: unknown, manual: string) => ((env as string | undefined) || manual).trim();

export const EMPRESA = {
  nombre: "G&M Mueblería",
  razonSocial: dato(import.meta.env.VITE_EMPRESA_RAZON_SOCIAL, ""),
  ruc: dato(import.meta.env.VITE_EMPRESA_RUC, ""),
  direccion: dato(import.meta.env.VITE_EMPRESA_DIRECCION, ""),
  email: dato(import.meta.env.VITE_EMPRESA_EMAIL, ""),
};

// ── Redes sociales del pie de página (solo se muestran las que empiecen con https://) ──
const redUrl = (env: unknown, manual: string): string | undefined => {
  const v = dato(env, manual);
  return /^https:\/\//i.test(v) ? v : undefined;
};

export const REDES = {
  instagram: redUrl(import.meta.env.VITE_INSTAGRAM_URL, ""),
  facebook: redUrl(import.meta.env.VITE_FACEBOOK_URL, ""),
  twitter: redUrl(import.meta.env.VITE_TWITTER_URL, ""),
};