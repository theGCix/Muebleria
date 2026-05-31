// supabase/functions/niubiz-session/index.ts
// Edge Function — proxy seguro hacia la API de Niubiz
// Las credenciales viven en Supabase Secrets, nunca en el cliente.
//
// Desplegar:
//   supabase secrets set NIUBIZ_MERCHANT_ID=xxx NIUBIZ_USER=xxx NIUBIZ_PASSWORD=xxx NIUBIZ_URL_SECURITY=xxx NIUBIZ_URL_SESSION=xxx
//   supabase functions deploy niubiz-session

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { amount, orderId, email } = await req.json() as {
      amount: number;
      orderId: string;
      email?: string;
    };

    if (!amount || !orderId) {
      return new Response(
        JSON.stringify({ error: "amount y orderId son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Leer credenciales desde Supabase Secrets ──────────────
    const MERCHANT_ID  = Deno.env.get("NIUBIZ_MERCHANT_ID");
    const USER         = Deno.env.get("NIUBIZ_USER");
    const PASSWORD     = Deno.env.get("NIUBIZ_PASSWORD");
    const URL_SECURITY = Deno.env.get("NIUBIZ_URL_SECURITY");
    const URL_SESSION  = Deno.env.get("NIUBIZ_URL_SESSION");
    const URL_JS       = Deno.env.get("NIUBIZ_URL_JS");

    if (!MERCHANT_ID || !USER || !PASSWORD || !URL_SECURITY || !URL_SESSION) {
      return new Response(
        JSON.stringify({ error: "Credenciales Niubiz no configuradas en Secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Paso 1: Security token ─────────────────────────────────
    const credentials = btoa(`${USER}:${PASSWORD}`);
    const secRes = await fetch(URL_SECURITY, {
      method: "GET",
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (!secRes.ok) {
      throw new Error(`Niubiz security error: ${secRes.status}`);
    }
    const securityToken = await secRes.text();

    // ── Paso 2: Session key ────────────────────────────────────
    const sessRes = await fetch(`${URL_SESSION}/${MERCHANT_ID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: securityToken,
      },
      body: JSON.stringify({
        amount: amount.toFixed(2),
        antifraud: {
          clientIp: "127.0.0.1",
          merchantDefineData: {
            MDD4:  email ?? "",
            MDD32: MERCHANT_ID,
            MDD75: "Ecommerce",
            MDD77: "0",
          },
        },
        channel:  "web",
        currency: "PEN",
        orderId,
      }),
    });

    if (!sessRes.ok) {
      const err = await sessRes.text();
      throw new Error(`Niubiz session error ${sessRes.status}: ${err}`);
    }

    const { sessionKey } = await sessRes.json();

    // ── Responder al frontend ──────────────────────────────────
    return new Response(
      JSON.stringify({
        sessionKey,
        merchantId: MERCHANT_ID,
        jsUrl: URL_JS ?? "https://static-content-qas.vnforapps.com/v2/js/checkout.js",
        currency: "PEN",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[niubiz-session]", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});