// src/lib/ventasFiltros.ts
// Filtros de «Ventas realizadas». La lista mezcla dos orígenes con estados distintos:
//   · Local (POS):  estado = «completada» | «anulada»
//   · Online:       estado = estado del pedido (pagado, en_preparacion, enviado, entregado, cancelado…)
// Por eso «Estado» se filtra por vigencia, igual para ambos canales: una venta está ANULADA si es
// «anulada» (local) o «cancelado» (online); todo lo demás está VIGENTE.

export type FiltroEstado = "todos" | "vigentes" | "anuladas";

export interface VentaFiltrable {
  numero?: string | null;
  cliente_nombre?: string | null;
  tipo: string;
  estado: string;
  canal: string;
}

export interface FiltrosVentas {
  tipo: string;      // "todos" | "boleta" | "factura" | "nota"
  estado: FiltroEstado;
  canal: string;     // "todos" | "local" | "online"
  busqueda: string;
}

export const FILTROS_INICIALES: FiltrosVentas = { tipo: "todos", estado: "todos", canal: "todos", busqueda: "" };

export const esAnulada = (v: Pick<VentaFiltrable, "estado">) => v.estado === "anulada" || v.estado === "cancelado";

export const hayFiltrosActivos = (f: FiltrosVentas) =>
  f.tipo !== "todos" || f.estado !== "todos" || f.canal !== "todos" || f.busqueda.trim() !== "";

export function filtrarVentas<T extends VentaFiltrable>(ventas: T[], f: FiltrosVentas): T[] {
  const q = f.busqueda.trim().toLowerCase();
  return ventas.filter((v) => {
    const matchTipo = f.tipo === "todos" || v.tipo === f.tipo;
    const matchEstado = f.estado === "todos" || (f.estado === "anuladas" ? esAnulada(v) : !esAnulada(v));
    const matchCanal = f.canal === "todos" || v.canal === f.canal;
    const matchBusqueda = !q || !!v.numero?.toLowerCase().includes(q) || !!v.cliente_nombre?.toLowerCase().includes(q);
    return matchTipo && matchEstado && matchCanal && matchBusqueda;
  });
}
