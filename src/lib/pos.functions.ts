import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemSchema = z.object({
  shopify_product_id: z.string().optional().nullable(),
  shopify_variant_id: z.string().optional().nullable(),
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

export const createSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: saleId, error } = await supabase.rpc("create_sale", {
      _tipo: data.tipo,
      _customer_id: data.customer_id as string,
      _metodo: data.metodo,
      _items: data.items as never,
      _notas: (data.notas ?? "") as string,
    });
    if (error) throw new Error(error.message);
    return { saleId };
  });

const CustomerSchema = z.object({
  doc_tipo: z.enum(["DNI", "RUC", "CE", "PASAPORTE"]),
  doc_numero: z.string().min(6).max(20).regex(/^[A-Z0-9]+$/i),
  nombre: z.string().min(1).max(255),
  email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  telefono: z.string().max(30).optional().nullable(),
  direccion: z.string().max(500).optional().nullable(),
});

export const upsertCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CustomerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      ...data,
      email: data.email || null,
      created_by: userId,
    };
    const { data: row, error } = await supabase
      .from("customers")
      .upsert(payload, { onConflict: "doc_tipo,doc_numero" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { customer: row };
  });

export const searchCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { q: string }) => z.object({ q: z.string().max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const q = data.q.trim();
    let query = supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(20);
    if (q) query = query.or(`nombre.ilike.%${q}%,doc_numero.ilike.%${q}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { customers: rows ?? [] };
  });

export const listSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("sales")
      .select("*, customers(nombre, doc_numero, doc_tipo), sale_items(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { sales: data ?? [] };
  });

export const getSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: sale, error } = await supabase
      .from("sales")
      .select("*, customers(*), sale_items(*), profiles!sales_vendedor_id_fkey(full_name)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return { sale };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

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
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at");
    if (error) throw new Error(error.message);
    const { data: roles } = await supabase.from("user_roles").select("*");
    return { profiles: profiles ?? [], roles: roles ?? [] };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["admin", "vendedor", "cliente"]),
      action: z.enum(["add", "remove"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
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
  });
