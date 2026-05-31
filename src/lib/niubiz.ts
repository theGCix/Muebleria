// ════════════════════════════════════════════════════════════════
// src/lib/niubiz.ts
// Niubiz — Integración de pagos en línea
// Documentación: https://developers.niubiz.com.pe
//
// Las URLs se leen de process.env en runtime (server-only).
// Los valores hardcodeados en FALLBACK_URLS son solo respaldo por
// si alguna variable no está definida — en producción siempre
// deben venir del .env.
// ════════════════════════════════════════════════════════════════

// Fallbacks por si faltan variables en .env (no deben usarse en producción)
const FALLBACK_URLS = {
  integracion: {
    security:  "https://apitestenv.vnforapps.com/api.security/v1/security",
    session:   "https://apitestenv.vnforapps.com/api.ecommerce/v2/ecommerce/token/session",
    authorize: "https://apitestenv.vnforapps.com/api.authorization/v3/authorization/ecommerce",
    js:        "https://static-content-qas.vnforapps.com/v2/js/checkout.js",
  },
  produccion: {
    security:  "https://apiprod.vnforapps.com/api.security/v1/security",
    session:   "https://apiprod.vnforapps.com/api.ecommerce/v2/ecommerce/token/session",
    authorize: "https://apiprod.vnforapps.com/api.authorization/v3/authorization/ecommerce",
    js:        "https://static-content.vnforapps.com/v2/js/checkout.js",
  },
} as const;

/**
 * Devuelve las URLs de Niubiz leyendo process.env en runtime.
 * Orden de precedencia:
 *   1. Variables explícitas del .env  (NIUBIZ_URL_SECURITY, etc.)
 *   2. Fallback según NIUBIZ_AMBIENTE (integracion | produccion)
 *
 * Llamar SIEMPRE dentro de una función/handler, nunca a nivel de módulo.
 */
export function getNiubizUrls() {
  const ambiente = (process.env.NIUBIZ_AMBIENTE ?? "integracion") as
    keyof typeof FALLBACK_URLS;
  const fallback = FALLBACK_URLS[ambiente] ?? FALLBACK_URLS.integracion;

  return {
    security:  process.env.NIUBIZ_URL_SECURITY  ?? fallback.security,
    session:   process.env.NIUBIZ_URL_SESSION    ?? fallback.session,
    authorize: process.env.NIUBIZ_URL_AUTH       ?? fallback.authorize,
    js:        process.env.NIUBIZ_URL_JS         ?? fallback.js,
  };
}

// ── Interfaces ───────────────────────────────────────────────

export interface NiubizSessionRequest {
  amount: number;       // En soles: 150.00
  currency: "PEN" | "USD";
  orderId: string;      // ID único del pedido
  email?: string;
}

export interface NiubizConfig {
  sessionKey: string;
  merchantId: string;
  amount: number;
  currency: string;
  orderId: string;
  jsUrl: string;
}

// ── Server-side helpers ──────────────────────────────────────

/**
 * Paso 1: Obtiene token de seguridad de Niubiz
 * Llamar SÓLO desde el servidor (usa credenciales secretas)
 */
export async function getNiubizSecurityToken(): Promise<string> {
  const user     = process.env.NIUBIZ_USER;
  const password = process.env.NIUBIZ_PASSWORD;

  if (!user || !password) {
    throw new Error("NIUBIZ_USER y NIUBIZ_PASSWORD no configurados en .env");
  }

  const { security } = getNiubizUrls();
  const credentials  = Buffer.from(`${user}:${password}`).toString("base64");

  const res = await fetch(security, {
    method:  "GET",
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) throw new Error(`Niubiz security error: ${res.status}`);
  return res.text();
}

/**
 * Paso 2: Crea sesión de pago en Niubiz
 * Llamar SÓLO desde el servidor
 */
export async function createNiubizSession(
  securityToken: string,
  req: NiubizSessionRequest
): Promise<{ sessionKey: string }> {
  const merchantId = process.env.NIUBIZ_MERCHANT_ID;
  if (!merchantId) throw new Error("NIUBIZ_MERCHANT_ID no configurado en .env");

  const { session } = getNiubizUrls();

  const res = await fetch(`${session}/${merchantId}`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  securityToken,
    },
    body: JSON.stringify({
      amount: req.amount.toFixed(2),
      antifraud: {
        clientIp: "127.0.0.1",
        merchantDefineData: {
          MDD4:  req.email ?? "",
          MDD32: merchantId,
          MDD75: "Ecommerce",
          MDD77: "0",
        },
      },
      channel:  "web",
      currency: req.currency,
      orderId:  req.orderId,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Niubiz session error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return { sessionKey: json.sessionKey };
}

/**
 * Paso 3: Autoriza el pago con el transactionToken del frontend
 * Llamar SÓLO desde el servidor
 */
export async function authorizeNiubizPayment(
  securityToken: string,
  transactionToken: string,
  req: NiubizSessionRequest
): Promise<{ authorizationCode: string; referenceCode: string; status: string }> {
  const merchantId = process.env.NIUBIZ_MERCHANT_ID;
  if (!merchantId) throw new Error("NIUBIZ_MERCHANT_ID no configurado en .env");

  const { authorize } = getNiubizUrls();

  const res = await fetch(`${authorize}/${merchantId}`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  securityToken,
    },
    body: JSON.stringify({
      channel:     "web",
      captureType: "manual",
      countable:   true,
      order: {
        tokenId:        transactionToken,
        amount:         req.amount.toFixed(2),
        currency:       req.currency,
        purchaseNumber: req.orderId,
        productId:      merchantId,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Niubiz authorize error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return {
    authorizationCode: json.order?.authorizationCode ?? "",
    referenceCode:     json.order?.referenceCode     ?? "",
    status:            json.order?.status            ?? "error",
  };
}