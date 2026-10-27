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
 * Enlace del Libro de Reclamaciones virtual (el que te entrega Indecopi en "Tu Libro de Reclamaciones").
 * Pégalo aquí entre las comillas, o defínelo como VITE_LIBRO_RECLAMACIONES_URL en Render.
 * Mientras esté vacío (o no empiece con https://), el enlace no se muestra en el sitio.
 */
const LIBRO_RECLAMACIONES_MANUAL = "";
const libroUrl = ((import.meta.env.VITE_LIBRO_RECLAMACIONES_URL as string | undefined) || LIBRO_RECLAMACIONES_MANUAL).trim();
export const LIBRO_RECLAMACIONES_URL: string | undefined = /^https:\/\//i.test(libroUrl) ? libroUrl : undefined;
