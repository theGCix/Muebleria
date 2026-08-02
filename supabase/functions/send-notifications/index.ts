// supabase/functions/send-notifications/index.ts
//
// CAMBIO respecto al original: usa notif.asunto y notif.mensaje en vez del
// texto hardcodeado de "tu pedido ha cambiado de estado". Esto es necesario
// porque ahora la cola también recibe 'recordatorio_carrito' y (más
// adelante) 'solicitud_resena', que no son notificaciones de pedido.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async () => {
  const { data: pendientes } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("enviado", false)
    .limit(50);

  for (const notif of pendientes ?? []) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "G&M Mueblería <noreply@tudominio.com>",
          to: notif.destinatario_email,
          subject: notif.asunto ?? "Novedades de tu pedido — G&M Mueblería",
          // notif.mensaje ya viene armado desde el origen (recordatorios-carrito,
          // cambiar_estado_pedido, etc). Solo lo convertimos a párrafos con <br>.
          html: `<div style="font-family: sans-serif; white-space: pre-line;">${
            notif.mensaje ?? `Hola ${notif.destinatario_nombre ?? ""}, tu pedido ha cambiado de estado.`
          }</div>`,
        }),
      });
      await supabase
        .from("notificaciones")
        .update({ enviado: true, enviado_at: new Date().toISOString() })
        .eq("id", notif.id);
    } catch (err) {
      await supabase
        .from("notificaciones")
        .update({ error: String(err) })
        .eq("id", notif.id);
    }
  }
  return new Response("ok");
});