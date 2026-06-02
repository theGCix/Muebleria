const isProd = import.meta.env.VITE_ENV === "prod";

export const API_URL = isProd
  ? import.meta.env.VITE_API_URL_PROD
  : import.meta.env.VITE_API_URL_LOCAL;

export const APP_URL = isProd
  ? import.meta.env.VITE_APP_URL_PROD
  : import.meta.env.VITE_APP_URL_LOCAL;