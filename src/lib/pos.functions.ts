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

export async function getDashboard() {
  const { supabase, userId } = await getAuthenticatedClient();
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = !!roles?.some((r) => r.role === "admin");

  let salesQuery = supabase.from("sales").select("id, total, created_at, vendedor_id, customer_id");
  if (!isAdmin) salesQuery = salesQuery.eq("vendedor_id", userId);
  const { data: sales, error: salesErr } = await salesQuery;
  if (salesErr) throw new Error(salesErr.message);

  const { data: items } = await supabase
    .from("sale_items")
    .select("title, qty, total, sale_id, sales!inner(vendedor_id)")
    .order("created_at", { ascending: false })
    .limit(2000);

  const { data: customers } = await supabase.from("customers").select("id, nombre, doc_numero");
  const { data: profiles } = await supabase.from("profiles").select("id, full_name");

  return {
    sales: sales ?? [],
    items: items ?? [],
    customers: customers ?? [],
    profiles: profiles ?? [],
    isAdmin,
  };
}

export async function createStaffUser(input: {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "vendedor" | "cliente";
}) {
  const { email, password, full_name, role } = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    full_name: z.string().min(1),
    role: z.enum(["admin", "vendedor", "cliente"]),
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
  role: "admin" | "vendedor" | "cliente";
  action: "add" | "remove";
}) {
  const data = z.object({
    user_id: z.string().uuid(),
    role: z.enum(["admin", "vendedor", "cliente"]),
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
}) {
  const data = z.object({
    id:           z.string().uuid().optional(),
    nombre:       z.string().min(1).max(100),
    unidad:       z.string().min(1),
    stock_actual: z.number().min(0).optional(),
    stock_minimo: z.number().min(0).optional(),
    precio_unit:  z.number().min(0).optional().nullable(),
    proveedor:    z.string().max(200).optional().nullable(),
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