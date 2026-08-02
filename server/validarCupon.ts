import type { SupabaseClient } from "@supabase/supabase-js";

export interface CartItemInput {
  product_id: string | null;
  categoria: string | null;
  combo_id?: string | null;
  qty: number;
  unit_price: number;
}

export interface ValidarCuponParams {
  supabase: SupabaseClient; // cliente con service_role (server-side)
  codigo: string;
  customerId: string | null; // null si es checkout de invitado
  items: CartItemInput[];
}

export interface ValidarCuponResult {
  valid: boolean;
  error?: string;
  cupon?: {
    id: string;
    codigo: string;
    tipo_descuento: "porcentaje" | "monto_fijo";
  };
  descuento?: number;
  baseElegible?: number;
}

/**
 * Valida un código de cupón contra el carrito actual.
 * NO registra el uso (eso ocurre recién al confirmar el pedido, ver aplicarCupon.sql).
 * Diseñado para llamarse desde un endpoint del checkout cada vez que el
 * usuario ingresa/cambia el código o cambia el carrito.
 */
export async function validarCupon({
  supabase,
  codigo,
  customerId,
  items,
}: ValidarCuponParams): Promise<ValidarCuponResult> {
  const codigoNormalizado = codigo.trim().toUpperCase();
  if (!codigoNormalizado) {
    return { valid: false, error: "Ingresa un código de cupón" };
  }

  const subtotal = items.reduce((acc, i) => acc + i.unit_price * i.qty, 0);

  const { data: cupon, error } = await supabase
    .from("cupones")
    .select("*")
    .eq("codigo", codigoNormalizado)
    .maybeSingle();

  if (error) {
    return { valid: false, error: "Error al verificar el cupón" };
  }
  if (!cupon) {
    return { valid: false, error: "El cupón no existe" };
  }
  if (!cupon.activo) {
    return { valid: false, error: "Este cupón ya no está disponible" };
  }

  const ahora = new Date();
  if (new Date(cupon.vigente_desde) > ahora) {
    return { valid: false, error: "Este cupón todavía no está vigente" };
  }
  if (cupon.vence_el && new Date(cupon.vence_el) < ahora) {
    return { valid: false, error: "Este cupón ha vencido" };
  }

  if (subtotal < Number(cupon.monto_minimo_compra)) {
    return {
      valid: false,
      error: `Compra mínima de S/ ${cupon.monto_minimo_compra} para usar este cupón`,
    };
  }

  if (cupon.uso_maximo_total !== null && cupon.usos_actuales >= cupon.uso_maximo_total) {
    return { valid: false, error: "Este cupón alcanzó su límite de usos" };
  }

  // --- Reglas que requieren identificar al cliente ---
  let segmentoCliente: string | null = null;
  let esPrimeraCompra = true;
  let usosDelCliente = 0;

  if (customerId) {
    const [{ data: customer }, { count: ordenesPrevias }, { count: usosPrevios }] =
      await Promise.all([
        supabase.from("customers").select("segmento").eq("id", customerId).maybeSingle(),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", customerId)
          .not("paid_at", "is", null),
        supabase
          .from("cupon_usos")
          .select("id", { count: "exact", head: true })
          .eq("cupon_id", cupon.id)
          .eq("customer_id", customerId),
      ]);

    segmentoCliente = customer?.segmento ?? null;
    esPrimeraCompra = (ordenesPrevias ?? 0) === 0;
    usosDelCliente = usosPrevios ?? 0;
  }

  if (cupon.segmento_objetivo && cupon.segmento_objetivo !== segmentoCliente) {
    return { valid: false, error: "Este cupón no aplica a tu cuenta" };
  }

  if (cupon.solo_primera_compra && !esPrimeraCompra) {
    return { valid: false, error: "Este cupón es solo para tu primera compra" };
  }

  if (usosDelCliente >= cupon.uso_maximo_por_cliente) {
    return { valid: false, error: "Ya usaste este cupón el máximo de veces permitido" };
  }

  // --- Alcance del descuento (aplica_a) ---
  let baseElegible = subtotal;
  if (cupon.aplica_a === "categoria") {
    baseElegible = items
      .filter((i) => i.categoria === cupon.categoria)
      .reduce((acc, i) => acc + i.unit_price * i.qty, 0);
  } else if (cupon.aplica_a === "producto") {
    baseElegible = items
      .filter((i) => i.product_id === cupon.producto_id)
      .reduce((acc, i) => acc + i.unit_price * i.qty, 0);
  } else if (cupon.aplica_a === "combo") {
    baseElegible = items
      .filter((i) => i.combo_id === cupon.combo_id)
      .reduce((acc, i) => acc + i.unit_price * i.qty, 0);
  }

  if (baseElegible <= 0) {
    return {
      valid: false,
      error: "Ninguno de los productos en tu carrito es elegible para este cupón",
    };
  }

  let descuento =
    cupon.tipo_descuento === "porcentaje"
      ? baseElegible * (Number(cupon.valor) / 100)
      : Math.min(Number(cupon.valor), baseElegible);

  if (cupon.tipo_descuento === "porcentaje" && cupon.descuento_maximo) {
    descuento = Math.min(descuento, Number(cupon.descuento_maximo));
  }

  descuento = Math.round(descuento * 100) / 100;

  return {
    valid: true,
    cupon: { id: cupon.id, codigo: cupon.codigo, tipo_descuento: cupon.tipo_descuento },
    descuento,
    baseElegible,
  };
}