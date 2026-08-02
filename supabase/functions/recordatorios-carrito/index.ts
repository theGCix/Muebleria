// supabase/functions/recordatorios-carrito/index.ts
//
// Detecta carritos listos para el siguiente paso del flujo de recuperación
// (ver v_carritos_pendientes_paso) y encola el email en `notificaciones`.
// El envío real lo hace el worker existente `send-notifications`, igual
// que con las notificaciones de pedidos.
//
// Programar en Supabase Dashboard → Edge Functions → Schedules: */30 * * * *

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

// Arma el cuerpo del email según el paso. El paso 3 recibe el código de
// cupón recién generado, que se le inyecta después de crear el registro.
function mensajeParaPaso(
  paso: number,
  nombre: string,
  items: { title: string; qty: number }[],
  subtotal: number,
  cuponCodigo?: string
): string {
  const listaItems = items
    .slice(0, 3)
    .map((i) => `• ${i.qty}× ${i.title}`)
    .join("\n");

  if (paso === 1) {
    return `Hola ${nombre || ""} 👋

Notamos que dejaste estos productos en tu carrito:
${listaItems}

Total: ${fmt(subtotal)}

Tu selección sigue guardada. Si tienes dudas sobre medidas, materiales o tiempos de entrega, respóndenos este correo o escríbenos por WhatsApp — te ayudamos a decidir con confianza.`;
  }

  if (paso === 2) {
    return `Hola ${nombre || ""},

Tus productos siguen esperándote:
${listaItems}

Total: ${fmt(subtotal)}

Son piezas de stock limitado. Muchos clientes que compraron estos modelos destacan la calidad de los materiales y el acabado — puedes ver fotos reales de entregas en nuestra web.

¿Completamos tu pedido?`;
  }

  // paso 3
  return `Hola ${nombre || ""},

Para ayudarte a decidir, te dejamos un cupón exclusivo para tu carrito:

  Código: ${cuponCodigo}
  5% de descuento — válido por 48 horas

Tus productos:
${listaItems}

Total: ${fmt(subtotal)}

Este cupón es de un solo uso y vence pronto, así que si ya lo decidiste, es el momento.`;
}

Deno.serve(async () => {
  const { data: pendientes, error } = await supabase
    .from("v_carritos_pendientes_paso")
    .select("*")
    .limit(100);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let procesados = 0;

  for (const c of pendientes ?? []) {
    try {
      // 1. Si el paso incluye cupón, generarlo llamando a la función SQL
      //    (necesita el id de la notificación, así que lo hacemos en dos
      //    pasos: insertar notificación "placeholder" con mensaje final
      //    calculado después de tener el código del cupón).
      let cuponCodigo: string | undefined;
      let cuponId: string | null = null;

      if (c.incluye_cupon) {
        cuponCodigo = `VUELVE-${c.carrito_id.replace(/-/g, "").slice(0, 8)}`;
      }

      const mensaje = mensajeParaPaso(c.paso, c.nombre, c.items, c.subtotal, cuponCodigo);

      // 2. Encolar el email (el worker send-notifications lo despacha)
      const { data: notif, error: notifErr } = await supabase
        .from("notificaciones")
        .insert({
          tipo: "recordatorio_carrito",
          canal: "email",
          destinatario_email: c.email,
          destinatario_nombre: c.nombre,
          asunto: c.asunto,
          mensaje,
        })
        .select("id")
        .single();

      if (notifErr) throw notifErr;

      // 3. Registrar el paso (y generar el cupón real vinculado) vía RPC
      const { data: cupon, error: rpcErr } = await supabase.rpc(
        "fn_registrar_recordatorio_carrito",
        {
          p_carrito_id: c.carrito_id,
          p_paso: c.paso,
          p_notificacion_id: notif.id,
        }
      );

      if (rpcErr) throw rpcErr;
      cuponId = cupon;

      procesados++;
    } catch (err) {
      console.error(`Error en carrito ${c.carrito_id}, paso ${c.paso}:`, err);
      // seguimos con el resto, un carrito con error no debe bloquear a los demás
    }
  }

  return new Response(
    JSON.stringify({ ok: true, procesados, detectados: pendientes?.length ?? 0 }),
    { headers: { "Content-Type": "application/json" } }
  );
});