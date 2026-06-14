// ─────────────────────────────────────────────────────────────
// G&M Mueblería — Types: módulo de producción (carpintero)
// ─────────────────────────────────────────────────────────────

export type ProduccionStatus =
  | "pendiente"
  | "en_proceso"
  | "pausado"
  | "terminado"
  | "rechazado_calidad";

export type PrioridadNivel = 1 | 2 | 3; // 1=alta, 2=media, 3=baja

// ── Fila que devuelve v_mi_produccion ────────────────────────
export interface MiOrdenRow {
  produccion_id: string;
  order_id: string;
  order_number: string;
  /** Para órdenes internas siempre "Producción interna" */
  cliente: string;
  email: string | null;
  telefono: string | null;
  total: number;
  order_status: string;
  prod_status: ProduccionStatus;
  prioridad: PrioridadNivel;
  fecha_inicio: string | null;       // ISO date string
  fecha_fin_estimada: string | null; // ISO date string
  fecha_fin_real: string | null;
  calidad_aprobada: boolean | null;
  observaciones: string | null;
  asignado_a: string | null;
}

// ── Ítem de pedido (order_items) ─────────────────────────────
export interface OrderItem {
  id: string;
  sku: string | null;
  title: string;
  qty: number;
  unit_price: number;
  total: number;
  image_url: string | null;
  /** Personalización JSONB: {madera, acabado, medidas, color, ...} */
  personalizacion?: Record<string, string> | null;
}

// ── Insumo del BOM ───────────────────────────────────────────
export interface BomInsumo {
  id: string;
  insumo_id: string;
  modelo: string;
  talla: string;
  cantidad: number;
  insumos: {
    id: string;
    nombre: string;
    unidad: string;
    stock_actual: number;
  };
}

// ── Material calculado para mostrar al carpintero ────────────
export interface MaterialNecesario {
  insumo_id: string;
  nombre: string;
  unidad: string;
  necesario: number;
  stock_actual: number;
  /** true si stock_actual >= necesario */
  stockOk: boolean;
}

// ── Respuesta de getDetalleProduccion ────────────────────────
export interface DetalleProduccion {
  items: OrderItem[];
  produccion: {
    id: string;
    order_id: string;
    status: ProduccionStatus;
    prioridad: PrioridadNivel;
    fecha_inicio: string | null;
    fecha_fin_estimada: string | null;
    fecha_fin_real: string | null;
    calidad_aprobada: boolean | null;
    observaciones: string | null;
  } | null;
}

// ── Input para actualizarProduccion ─────────────────────────
export interface ActualizarProduccionInput {
  produccion_id: string;
  status?: ProduccionStatus;
  observaciones?: string;
  prioridad?: PrioridadNivel;
  fecha_fin_real?: string;
}

// ── Config visual de cada estado ────────────────────────────
export interface StatusConfig {
  label: string;
  colorClass: string;   // Tailwind bg + text combinados
  dotColor: string;     // hex para el indicador circular
}

export const PROD_STATUS_CONFIG: Record<ProduccionStatus, StatusConfig> = {
  pendiente: {
    label: "Pendiente",
    colorClass: "bg-amber-50 text-amber-900",
    dotColor: "#B45309",
  },
  en_proceso: {
    label: "En proceso",
    colorClass: "bg-blue-50 text-blue-900",
    dotColor: "#1D4ED8",
  },
  pausado: {
    label: "Pausado",
    colorClass: "bg-gray-100 text-gray-700",
    dotColor: "#6B7280",
  },
  terminado: {
    label: "Terminado",
    colorClass: "bg-green-50 text-green-900",
    dotColor: "#15803D",
  },
  rechazado_calidad: {
    label: "Rechazado calidad",
    colorClass: "bg-red-50 text-red-900",
    dotColor: "#B91C1C",
  },
};

// ── Helpers ──────────────────────────────────────────────────

/**
 * Días restantes hasta fecha_fin_estimada.
 * Retorna null si no hay fecha.
 */
export function diasRestantes(fechaFin: string | null): number | null {
  if (!fechaFin) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin);
  fin.setHours(0, 0, 0, 0);
  return Math.round((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Porcentaje estimado de avance por estado.
 * El carpintero puede ajustarlo en el futuro; por ahora lo derivamos del estado.
 */
export function avancePorEstado(status: ProduccionStatus): number {
  const map: Record<ProduccionStatus, number> = {
    pendiente: 0,
    en_proceso: 50,
    pausado: 30,
    terminado: 100,
    rechazado_calidad: 0,
  };
  return map[status];
}

/**
 * Extrae etiquetas legibles de personalizacion JSONB.
 * Ejemplo: { madera: "cedro", acabado: "barniz mate" }
 */
export function parsePersonalizacion(
  raw: Record<string, string> | null | undefined
): Array<{ key: string; value: string }> {
  if (!raw) return [];
  const labelMap: Record<string, string> = {
    madera: "Madera",
    acabado: "Acabado",
    medidas: "Medidas",
    color: "Color",
    tela: "Tela",
    tipo_entrega: "Entrega",
  };
  return Object.entries(raw).map(([key, value]) => ({
    key: labelMap[key] ?? key,
    value,
  }));
}
