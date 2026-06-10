import { z } from "zod";
import { getAuthenticatedClient } from "@/integrations/supabase/auth-middleware";

const ItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  sku: z.string().optional().nullable(),
  title: z.string().min(1).max(255),
  qty: z.number().positive().max(9999),
  unit_price: z.number().min(0).max(999999),
});

const SaleSchema = z.object({
  tipo: z.enum(["boleta", "factura", "nota"]),
  customer_id: z.string().uuid().nullable(),
  metodo: z.enum(["efectivo", "tarjeta", "transferencia", "yape_plin"]),
  notas: z.string().max(500).optional().nullable(),
  items: z.array(ItemSchema).min(1).max(50),
});

export async function createSale(input: { data: z.infer<typeof SaleSchema> }) {
  const data = SaleSchema.parse(input.data);
  const { supabase } = await getAuthenticatedClient();
  const { data: saleId, error } = await supabase.rpc("create_sale", {
    _tipo: data.tipo,
    _customer_id: data.customer_id as string,
    _metodo: data.metodo,
    _items: data.items as never,
    _notas: (data.notas ?? "") as string,
  });
  if (error) throw new Error(error.message);
  return { saleId };
}

const CustomerSchema = z.object({
  doc_tipo: z.enum(["DNI", "RUC", "CE", "PASAPORTE"]),
  doc_numero: z.string().min(6).max(20).regex(/^[A-Z0-9]+$/i),
  nombre: z.string().min(1).max(255),
  email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  telefono: z.string().max(30).optional().nullable(),
  direccion: z.string().max(500).optional().nullable(),
  distrito: z.string().max(100).optional().nullable(),   // nuevo
  ciudad: z.string().max(100).optional().nullable(),     // nuevo
});

export async function upsertCustomer(input: { data: z.infer<typeof CustomerSchema> }) {
  const data = CustomerSchema.parse(input.data);
  const { supabase, userId } = await getAuthenticatedClient();
  const payload = { ...data, email: data.email || null, created_by: userId };
  const { data: row, error } = await supabase
    .from("customers")
    .upsert(payload, { onConflict: "doc_tipo,doc_numero" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { customer: row };
}

export async function searchCustomers(input: { data: { q: string; limit?: number } }) {
  const { q, limit = 50 } = z.object({
    q: z.string().max(100),
    limit: z.number().int().min(1).max(200).optional(),
  }).parse(input.data);

  const { supabase } = await getAuthenticatedClient();
  const trimmed = q.trim();

  let query = supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (trimmed) {
    query = query.or(
      `nombre.ilike.%${trimmed}%,doc_numero.ilike.%${trimmed}%,email.ilike.%${trimmed}%,telefono.ilike.%${trimmed}%`
    );
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  return { customers: rows ?? [] };
}


export async function listSales() {
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("sales")
    .select("*, customers(nombre, doc_numero, doc_tipo), sale_items(*)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return { sales: data ?? [] };
}

export async function getSale(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { data: sale, error } = await supabase
    .from("sales")
    .select("*, customers(*), sale_items(*)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return { sale };
}

// export async function getDashboard() {
//   const { supabase, userId } = await getAuthenticatedClient();
//   const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
//   const isAdmin = !!roles?.some((r) => r.role === "admin");

//   let salesQuery = supabase.from("sales").select("id, total, created_at, vendedor_id, customer_id");
//   if (!isAdmin) salesQuery = salesQuery.eq("vendedor_id", userId);
//   const { data: sales, error: salesErr } = await salesQuery;
//   if (salesErr) throw new Error(salesErr.message);

//   const { data: items } = await supabase
//     .from("sale_items")
//     .select("title, qty, total, sale_id, sales!inner(vendedor_id)")
//     .order("created_at", { ascending: false })
//     .limit(2000);

//   const { data: customers } = await supabase.from("customers").select("id, nombre, doc_numero");
//   const { data: profiles } = await supabase.from("profiles").select("id, full_name");

//   return {
//     sales: sales ?? [],
//     items: items ?? [],
//     customers: customers ?? [],
//     profiles: profiles ?? [],
//     isAdmin,
//   };
// }

// src/lib/pos.functions.ts — REEMPLAZAR getDashboard()

export async function getDashboardKpis(input?: {
  desde?: string;  // YYYY-MM-DD
  hasta?: string;
}) {
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase.rpc("get_dashboard_kpis", {
    
    _desde: input?.desde ?? null,
    _hasta: input?.hasta ?? null,
  });
  if (error) throw new Error(error.message);
  return data as {
    ingresos_totales:         number;
    ingresos_mes_ant:         number;
    ingresos_var_pct:         number | null;
    ventas_pos:               number;
    ventas_pos_count:         number;
    ticket_promedio_pos:      number;
    ventas_ecommerce:         number;
    pedidos_ec_count:         number;
    clientes_nuevos:          number;
    clientes_total:           number;
    prod_pendientes:          number;
    prod_en_proceso:          number;
    prod_vencidas:            number;
    prod_terminadas:          number;
    tiempo_prod_promedio_dias: number;
    insumos_stock_bajo:       number;
    oc_pendientes:            number;
    oc_monto_pendiente:       number;
    periodo_desde:            string;
    periodo_hasta:            string;
    is_admin:                 boolean;
  };
}

export async function getDashboardSeries(input?: {
  desde?: string;
  hasta?: string;
  agrupacion?: "dia" | "semana" | "mes";
}) {
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase.rpc("get_dashboard_series", {
    _desde:      input?.desde ?? null,
    _hasta:      input?.hasta ?? null,
    _agrupacion: input?.agrupacion ?? "dia",
  });
  if (error) throw new Error(error.message);
  return data as {
    ingresos_serie:     Array<{ fecha: string; pos: number; ec: number; total: number }>;
    top_productos_pos:  Array<{ title: string; unidades: number; total: number }>;
    top_productos_ec:   Array<{ title: string; unidades: number; total: number }>;
    top_vendedores:     Array<{ vendedor_id: string; full_name: string; total: number; ventas: number }>;
    metodos_pago:       Array<{ metodo: string; total: number; count: number }>;
  };
}

export async function createStaffUser(input: {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "vendedor" | "carpintero" | "cliente";
}) {
  const { email, password, full_name, role } = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    full_name: z.string().min(1),
    role: z.enum(["admin", "vendedor", "carpintero",  "cliente"]),
  }).parse(input);

  // Verificar que el llamante es admin
  const { supabase, userId } = await getAuthenticatedClient();
  const { data: adminCheck } = await supabase
    .from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!adminCheck) throw new Error("Solo administradores pueden crear usuarios");

  // Llamar a la Admin API de Supabase con la service role key
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
  if (!SERVICE_KEY) throw new Error("VITE_SUPABASE_SERVICE_KEY no configurado");

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.msg ?? err?.message ?? "Error creando usuario");
  }

  const newUser = await res.json();

  // Asignar rol en user_roles (el trigger ya crea el profile y asigna 'cliente')
  // Si el rol deseado no es cliente, lo actualizamos
  if (role !== "cliente") {
    await supabase.from("user_roles")
      .update({ role })
      .eq("user_id", newUser.id);
  }

   if (role !== "carpintero") {
    await supabase.from("user_roles")
      .update({ role })
      .eq("user_id", newUser.id);
  }

  return { ok: true, user: newUser };
}

export async function listUsers() {
  const { supabase } = await getAuthenticatedClient();
  const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at");
  if (error) throw new Error(error.message);
  const { data: roles } = await supabase.from("user_roles").select("*");
  return { profiles: profiles ?? [], roles: roles ?? [] };
}

export async function setUserRole(input: {
  user_id: string;
  role: "admin" | "vendedor" | "carpintero" | "cliente";
  action: "add" | "remove";
}) {
  const data = z.object({
    user_id: z.string().uuid(),
    role: z.enum(["admin", "vendedor", "carpintero", "cliente"]),
    action: z.enum(["add", "remove"]),
  }).parse(input);

  const { supabase, userId } = await getAuthenticatedClient();
  const { data: adminCheck } = await supabase
    .from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!adminCheck) throw new Error("Solo administradores pueden cambiar roles");

  if (data.action === "add") {
    const { error } = await supabase.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", data.user_id).eq("role", data.role);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function anularVenta(input: { data: { id: string } }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input.data);
  const { supabase, userId } = await getAuthenticatedClient();
  const { data: roles } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!roles) throw new Error("Solo administradores pueden anular comprobantes");
  const { error } = await supabase.from("sales").update({ estado: "anulada" }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}





//SE- GR#08062026
// Obtener un cliente con su valor completo (vista v_customer_valor)
export async function getCustomerValor(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("v_customer_valor")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return { customer: data };
}

// Historial de compras POS de un cliente
export async function getCustomerSales(input: { customer_id: string }) {
  const { customer_id } = z.object({ customer_id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("sales")
    .select("id, numero, tipo, total, metodo_pago, estado, created_at, sale_items(title, qty, unit_price)")
    .eq("customer_id", customer_id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { sales: data ?? [] };
}

// Historial de pedidos online de un cliente (por email)
export async function getCustomerOrders(input: { email: string }) {
  const { email } = z.object({ email: z.string().email() }).parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, total, status, created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { orders: data ?? [] };
}

// Actualizar segmento y notas de un cliente
export async function updateCustomerCrm(input: {
  id: string;
  segmento: "nuevo" | "recurrente" | "vip" | "inactivo";
  notas?: string | null;
  tags?: string[];
}) {
  const data = z.object({
    id: z.string().uuid(),
    segmento: z.enum(["nuevo", "recurrente", "vip", "inactivo"]),
    notas: z.string().max(2000).optional().nullable(),
    tags: z.array(z.string()).optional(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { data: row, error } = await supabase
    .from("customers")
    .update({
      segmento: data.segmento,
      notas: data.notas ?? null,
      tags: data.tags ?? [],
      fecha_ultimo_contacto: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { customer: row };
}
//EE- GR#08062026








//SE- GR#09062026
export async function listInsumos() {
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("insumos")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return { insumos: data ?? [] };
}

export async function upsertInsumo(input: {
  id?: string;
  nombre: string;
  unidad: string;
  stock_actual?: number;
  stock_minimo?: number;
  precio_unit?: number | null;
  proveedor?: string | null;
  proveedor_id?: string | null;
}) {
  const data = z.object({
    id:           z.string().uuid().optional(),
    nombre:       z.string().min(1).max(100),
    unidad:       z.string().min(1),
    stock_actual: z.number().min(0).optional(),
    stock_minimo: z.number().min(0).optional(),
    precio_unit:  z.number().min(0).optional().nullable(),
    proveedor:    z.string().max(200).optional().nullable(),  
    proveedor_id: z.string().uuid().optional().nullable(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { data: row, error } = await supabase
    .from("insumos")
    .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { insumo: row };
}

export async function registrarMovimiento(input: {
  insumo_id: string;
  tipo: "entrada" | "salida" | "ajuste";
  cantidad: number;
  motivo?: string;
  referencia?: string;
}) {
  const data = z.object({
    insumo_id:  z.string().uuid(),
    tipo:       z.enum(["entrada", "salida", "ajuste"]),
    cantidad:   z.number(),
    motivo:     z.string().max(500).optional(),
    referencia: z.string().max(100).optional(),
  }).parse(input);

  const { supabase, userId } = await getAuthenticatedClient();
  const { error } = await supabase
    .from("insumo_movimientos")
    .insert({ ...data, registrado_por: userId });
  if (error) throw new Error(error.message);
  return { ok: true };
}

// BOM
export async function getBom(input: { modelo: string; talla: string }) {
  const { modelo, talla } = z.object({
    modelo: z.string().min(1),
    talla:  z.string().min(1),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("bom_items")
    .select("*, insumos(id, nombre, unidad, stock_actual)")
    .eq("modelo", modelo)
    .eq("talla", talla)
    .order("created_at");
  if (error) throw new Error(error.message);
  return { items: data ?? [] };
}

// Calculadora MRP: ¿cuánto insumo necesito para N juegos?
export async function calcularMrp(input: {
  pedidos: Array<{ modelo: string; talla: string; cantidad: number }>;
}) {
  const { pedidos } = z.object({
    pedidos: z.array(z.object({
      modelo:   z.string().min(1),
      talla:    z.string().min(1),
      cantidad: z.number().int().positive(),
    })).min(1),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();

  // Obtener todos los BOM relevantes de una vez
  const combinaciones = pedidos.map((p) => `(modelo.eq.${p.modelo},talla.eq.${p.talla})`);
  const { data: boms, error } = await supabase
    .from("bom_items")
    .select("modelo, talla, cantidad, insumos(id, nombre, unidad, stock_actual)")
    .or(combinaciones.join(","));
  if (error) throw new Error(error.message);

  // Agregar necesidad total por insumo
  const necesidad: Record<string, {
    nombre: string; unidad: string; stock_actual: number;
    necesario: number; faltante: number;
  }> = {};

  for (const pedido of pedidos) {
    const bomDelPedido = boms?.filter(
      (b) => b.modelo === pedido.modelo && b.talla === pedido.talla
    ) ?? [];

    for (const item of bomDelPedido) {
      const ins = item.insumos as any;
      if (!ins) continue;
      if (!necesidad[ins.id]) {
        necesidad[ins.id] = {
          nombre: ins.nombre,
          unidad: ins.unidad,
          stock_actual: Number(ins.stock_actual),
          necesario: 0,
          faltante: 0,
        };
      }
      necesidad[ins.id].necesario += Number(item.cantidad) * pedido.cantidad;
    }
  }

  // Calcular faltantes
  for (const key of Object.keys(necesidad)) {
    const n = necesidad[key];
    n.faltante = Math.max(0, n.necesario - n.stock_actual);
  }

  return {
    resultado: Object.values(necesidad).sort((a, b) => b.faltante - a.faltante),
    hayFaltantes: Object.values(necesidad).some((n) => n.faltante > 0),
  };
}

// Alertas de stock bajo
export async function getStockBajo() {
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("v_insumos_stock_bajo")
    .select("*");
  if (error) throw new Error(error.message);
  return { alertas: data ?? [] };
}
//EE- GR#09062026


















// SE- GR#09062026:09:21

// ── PRODUCCIÓN ───────────────────────────────────────────────

// Panel admin: todas las órdenes de fabricación activas
export async function listProduccion() {
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("v_produccion_panel")
    .select("*")
    .order("prioridad", { ascending: true })
    .order("fecha_fin_estimada", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return { ordenes: data ?? [] };
}

// Vista del carpintero: sus propias órdenes
export async function listMiProduccion() {
  const { supabase, userId } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("v_mi_produccion")
    .select("*")
    .eq("asignado_a", userId)
    .order("prioridad", { ascending: true });
  if (error) throw new Error(error.message);
  return { ordenes: data ?? [] };
}

// Detalle completo de una orden (items del pedido + insumos BOM)
export async function getDetalleProduccion(input: { order_id: string }) {
  const { order_id } = z.object({ order_id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();

  const [itemsRes, produccionRes] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, sku, title, qty, unit_price, total, image_url")
      .eq("order_id", order_id),
    supabase
      .from("produccion")
      .select("*")
      .eq("order_id", order_id)
      .single(),
  ]);

  if (itemsRes.error) throw new Error(itemsRes.error.message);
  return {
    items: itemsRes.data ?? [],
    produccion: produccionRes.data ?? null,
  };
}

// Cambiar estado de orden incluyendo modelo+talla para descuento MRP
export async function cambiarEstadoPedido(input: {
  order_id: string;
  nuevo_estado: string;
  motivo?: string;
  modelo?: string;
  talla?: string;
}) {
  const data = z.object({
    order_id:     z.string().uuid(),
    nuevo_estado: z.string().min(1),
    motivo:       z.string().optional(),
    modelo:       z.string().optional(),
    talla:        z.string().optional(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { data: result, error } = await supabase.rpc("cambiar_estado_pedido", {
    _order_id:     data.order_id,
    _nuevo_estado: data.nuevo_estado,
    _motivo:       data.motivo ?? null,
    _modelo:       data.modelo ?? null,
    _talla:        data.talla ?? null,
  });
  if (error) throw new Error(error.message);
  return result;
}

// Actualizar estado interno de producción (carpintero o admin)
export async function actualizarProduccion(input: {
  produccion_id: string;
  status?: string;
  observaciones?: string;
  prioridad?: number;
  fecha_fin_real?: string;
}) {
  const data = z.object({
    produccion_id: z.string().uuid(),
    status:        z.string().optional(),
    observaciones: z.string().max(2000).optional(),
    prioridad:     z.number().int().min(1).max(3).optional(),
    fecha_fin_real: z.string().optional(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase.rpc("actualizar_produccion", {
    _produccion_id:  data.produccion_id,
    _status:         data.status ?? null,
    _observaciones:  data.observaciones ?? null,
    _prioridad:      data.prioridad ?? null,
    _fecha_fin_real: data.fecha_fin_real ?? null,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

// Asignar carpintero (solo admin/vendedor)
export async function asignarCarpintero(input: {
  produccion_id: string;
  carpintero_id: string;
}) {
  const data = z.object({
    produccion_id: z.string().uuid(),
    carpintero_id: z.string().uuid(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase.rpc("asignar_carpintero", {
    _produccion_id: data.produccion_id,
    _carpintero_id: data.carpintero_id,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

// Listar carpinteros disponibles (para el selector de asignación)
export async function listCarpinteros() {
  const { supabase } = await getAuthenticatedClient();
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "carpintero");

  if (!roles?.length) return { carpinteros: [] };

  const ids = roles.map((r) => r.user_id);
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return { carpinteros: profiles ?? [] };
}
// EE- GR#09062026:09:21





// ── PROVEEDORES ──────────────────────────────────────────────

export async function listProveedores(input?: { activo?: boolean }) {
  const { supabase } = await getAuthenticatedClient();
  let q = supabase
    .from("v_proveedores_resumen")
    .select("*")
    .order("nombre");
  if (input?.activo !== undefined) q = q.eq("activo", input.activo);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { proveedores: data ?? [] };
}

export async function upsertProveedor(input: {
  id?: string;
  nombre: string;
  ruc?: string | null;
  tipo: "insumo" | "producto" | "ambos";
  contacto_nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  direccion?: string | null;
  distrito?: string | null;
  plazo_entrega_dias?: number;
  credito_dias?: number;
  notas?: string | null;
}) {
  const data = z.object({
    id:                  z.string().uuid().optional(),
    nombre:              z.string().min(1).max(200),
    ruc:                 z.string().length(11).optional().nullable(),
    tipo:                z.enum(["insumo", "producto", "ambos"]),
    contacto_nombre:     z.string().max(150).optional().nullable(),
    telefono:            z.string().max(30).optional().nullable(),
    email:               z.string().email().optional().nullable().or(z.literal("")),
    whatsapp:            z.string().max(30).optional().nullable(),
    direccion:           z.string().max(500).optional().nullable(),
    distrito:            z.string().max(100).optional().nullable(),
    plazo_entrega_dias:  z.number().int().min(0).max(365).optional(),
    credito_dias:        z.number().int().min(0).max(365).optional(),
    notas:               z.string().max(2000).optional().nullable(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { data: row, error } = await supabase
    .from("proveedores")
    .upsert({ ...data, email: data.email || null, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { proveedor: row };
}

export async function getProveedor(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("proveedores")
    .select("*, insumos(id, nombre, unidad, stock_actual), products(id, nombre, sku, precio)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return { proveedor: data };
}

// ── ÓRDENES DE COMPRA ────────────────────────────────────────

export async function listOrdenes(input?: { proveedor_id?: string; status?: string }) {
  const { supabase } = await getAuthenticatedClient();
  let q = supabase
    .from("ordenes_compra")
    .select("*, proveedores(id, nombre, telefono), orden_compra_items(id, descripcion, cantidad, precio_unit, subtotal, cantidad_recibida, insumo_id, product_id)")
    .order("fecha_emision", { ascending: false })
    .limit(200);
  if (input?.proveedor_id) q = q.eq("proveedor_id", input.proveedor_id);
  if (input?.status)       q = q.eq("status", input.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { ordenes: data ?? [] };
}

export async function crearOrdenCompra(input: {
  proveedor_id: string;
  fecha_esperada?: string | null;
  notas?: string | null;
  items: Array;
}) {
  const data = z.object({
    proveedor_id:   z.string().uuid(),
    fecha_esperada: z.string().optional().nullable(),
    notas:          z.string().max(1000).optional().nullable(),
    items: z.array(z.object({
      insumo_id:   z.string().uuid().optional().nullable(),
      product_id:  z.string().uuid().optional().nullable(),
      descripcion: z.string().min(1).max(300),
      unidad:      z.string().min(1).max(30),
      cantidad:    z.number().positive(),
      precio_unit: z.number().min(0),
    })).min(1).max(50),
  }).parse(input);

  const { supabase, userId } = await getAuthenticatedClient();

  // Generar número de OC
  const { data: numRow, error: numErr } = await supabase.rpc("next_orden_compra_numero");
  if (numErr) throw new Error(numErr.message);

  const { data: orden, error: ordenErr } = await supabase
    .from("ordenes_compra")
    .insert({
      numero:         numRow,
      proveedor_id:   data.proveedor_id,
      fecha_esperada: data.fecha_esperada ?? null,
      notas:          data.notas ?? null,
      creado_por:     userId,
    })
    .select()
    .single();
  if (ordenErr) throw new Error(ordenErr.message);

  const { error: itemsErr } = await supabase
    .from("orden_compra_items")
    .insert(data.items.map((item) => ({ ...item, orden_id: orden.id })));
  if (itemsErr) throw new Error(itemsErr.message);

  return { orden };
}

export async function actualizarStatusOrden(input: {
  id: string;
  status: "enviada" | "confirmada" | "cancelada";
}) {
  const { id, status } = z.object({
    id:     z.string().uuid(),
    status: z.enum(["enviada", "confirmada", "cancelada"]),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase
    .from("ordenes_compra")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function recibirOrdenCompra(input: { id: string; notas?: string }) {
  const { id, notas } = z.object({
    id:    z.string().uuid(),
    notas: z.string().optional(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase.rpc("recibir_orden_compra", {
    _orden_id: id,
    _notas:    notas ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}




















// src/lib/pos.functions.ts

export async function getMarketingAnalytics(input?: {
  desde?: string;
  hasta?: string;
}) {
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase.rpc("get_marketing_analytics", {
    _desde: input?.desde ?? null,
    _hasta: input?.hasta ?? null,
  });
  if (error) throw new Error(error.message);
  return data as {
    canales:       Array<{ canal: string; transacciones: number; ingresos: number; ticket_promedio: number }>;
    utm_fuentes:   Array<{ fuente: string; pedidos: number; ingresos: number }> | null;
    geo_distritos: Array<{ distrito: string; pedidos: number; ingresos: number }> | null;
    categorias:    Array<{ categoria: string; pedidos: number; unidades: number; ingresos: number }> | null;
    segmentos:     Array<{ segmento: string; clientes: number; ingresos_pos: number }> | null;
    top_productos: Array<{ title: string; unidades: number; ingresos: number }> | null;
    funnel:        { vistas: number; productos_vistos: number; carritos: number; checkouts: number; compras: number } | null;
    retencion:     { clientes_recurrentes: number; clientes_periodo: number } | null;
    serie_ec:      Array<{ fecha: string; pedidos: number; ingresos: number }> | null;
    periodo_desde: string;
    periodo_hasta: string;
  };
}