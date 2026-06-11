// supabase/functions/alertas-stock/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async () => {
  // 1. Calcular velocidad de consumo de insumos (últimas 4 semanas)
  const { data: movimientos } = await supabase
    .from("insumo_movimientos")
    .select("insumo_id, cantidad, tipo, created_at")
    .eq("tipo", "salida")
    .gte("created_at", new Date(Date.now() - 28 * 86400_000).toISOString());

  // Agrupar salidas por insumo
  const consumoPorInsumo: Record<string, number> = {};
  for (const m of movimientos ?? []) {
    consumoPorInsumo[m.insumo_id] = (consumoPorInsumo[m.insumo_id] ?? 0) + Number(m.cantidad);
  }

  // 2. Cruzar con stock actual
  const { data: insumos } = await supabase
    .from("insumos")
    .select("id, nombre, unidad, stock_actual, stock_minimo, proveedor_id")
    .eq("activo", true);

  const alertas = [];
  for (const ins of insumos ?? []) {
    const consumo28d = consumoPorInsumo[ins.id] ?? 0;
    const consumoDiario = consumo28d / 28;
    const diasRestantes = consumoDiario > 0
      ? Math.floor(Number(ins.stock_actual) / consumoDiario)
      : null;

    // Alerta si el stock se acaba en menos de 14 días
    if (diasRestantes !== null && diasRestantes < 14) {
      alertas.push({
        insumo_id:       ins.id,
        nombre:          ins.nombre,
        stock_actual:    ins.stock_actual,
        stock_minimo:    ins.stock_minimo,
        dias_restantes:  diasRestantes,
        consumo_semanal: (consumo28d / 4).toFixed(1),
        unidad:          ins.unidad,
        proveedor_id:    ins.proveedor_id,
      });
    }
  }

  // 3. Guardar alertas en notificaciones para el admin
  if (alertas.length > 0) {
    const resumen = alertas
      .sort((a, b) => a.dias_restantes - b.dias_restantes)
      .map((a) => `• ${a.nombre}: ${a.dias_restantes}d de stock (consume ${a.consumo_semanal} ${a.unidad}/sem)`)
      .join("\n");

    // Obtener email del admin
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();

    if (adminRoles) {
      const { data: authUser } = await supabase.auth.admin.getUserById(adminRoles.user_id);
      if (authUser?.user?.email) {
        await supabase.from("notificaciones").insert({
          tipo:                   "stock_bajo",
          canal:                  "email",
          destinatario_email:     authUser.user.email,
          destinatario_nombre:    "Administrador",
          asunto:                 `⚠️ ${alertas.length} insumo${alertas.length > 1 ? "s" : ""} con stock crítico`,
          cuerpo:                 `Insumos que se agotan pronto:\n${resumen}\n\nRevisa el panel de insumos para reponer.`,
        });
      }
    }
  }

  return new Response(
    JSON.stringify({ alertas: alertas.length, ok: true }),
    { headers: { "Content-Type": "application/json" } }
  );
});