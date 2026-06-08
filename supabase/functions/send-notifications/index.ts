// supabase/functions/send-notifications/index.ts
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
      // Enviar con Resend, SendGrid, etc.
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "G&M Mueblería <noreply@tudominio.com>",
          to: notif.destinatario_email,
          subject: notif.asunto,
          html: `<p>Hola ${notif.destinatario_nombre}, tu pedido ha cambiado de estado.</p>`,
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