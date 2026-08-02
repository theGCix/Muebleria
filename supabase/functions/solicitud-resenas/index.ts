// supabase/functions/solicitud-resenas/index.ts
//
// Detecta pedidos entregados hace 10+ días con ítems sin reseñar
// (ver v_pedidos_pendientes_resena) y encola UNA notificación por
// pedido en `notificaciones`. El envío real lo hace el worker
// existente `send-notifications`, igual que con carritos abandonados.
//
// Programar en Supabase Dashboard → Edge Functions → Schedules: 0 15 * * *
// (una vez al día, 15:00 UTC ≈ 10am Lima)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const APP_URL = Deno.env.get("APP_URL") ?? "https://muebleria.example.com";

Deno.serve(async () => {
  const { data: pendientes, error } = await supabase
    .from("v_pedidos_pendientes_resena")
    .select("*")
    .limit(100);

  if (error) {
    console.error("Error consultando v_pedidos_pendientes_resena:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let encoladas = 0;

  for (const pedido of pendientes ?? []) {
    const link = `${APP_URL}/resena/${pedido.order_id}`;

    const mensaje = `Hola ${pedido.nombre ?? ""} 👋

¿Qué te pareció tu compra (pedido ${pedido.order_number})? Tu opinión ayuda a que otros clientes elijan con más confianza.

Cuéntanos aquí, toma menos de un minuto: ${link}

¡Gracias por confiar en G&M Mueblería!`;

    const { error: insertError } = await supabase.from("notificaciones").insert({
      order_id: pedido.order_id,
      destinatario_email: pedido.email,
      destinatario_nombre: pedido.nombre,
      tipo: "solicitud_resena",
      canal: "email",
      asunto: `¿Cómo te fue con tu pedido ${pedido.order_number}?`,
      mensaje,
    });

    if (!insertError) encoladas++;
    else console.error(`Error encolando solicitud para pedido ${pedido.order_id}:`, insertError.message);
  }

  return new Response(JSON.stringify({ ok: true, encoladas }), {
    headers: { "Content-Type": "application/json" },
  });
});