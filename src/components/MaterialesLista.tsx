// src/components/produccion/MaterialesLista.tsx
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { MaterialNecesario } from "@/types/produccion";

interface Props {
  materiales: MaterialNecesario[];
}

export function MaterialesLista({ materiales }: Props) {
  if (!materiales.length) {
    return (
      <p className="text-sm text-muted-foreground py-1">
        No se encontraron materiales en el BOM para este pedido.
        <br />
        <span className="text-xs">
          Verifica que los ítems tengan modelo y talla configurados en el BOM.
        </span>
      </p>
    );
  }

  return (
    <div className="divide-y divide-border/40 rounded-lg border border-border/50 bg-card overflow-hidden">
      {materiales.map((m) => (
        <div
          key={m.insumo_id}
          className="flex items-center justify-between px-3 py-2.5 gap-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{m.nombre}</p>
            {m.stockOk ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-700">
                <CheckCircle2 className="h-3 w-3" />
                Stock disponible ({m.stock_actual} {m.unidad})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                Stock bajo — disponible: {m.stock_actual} {m.unidad}
              </span>
            )}
          </div>
          <span className="font-mono text-sm font-medium shrink-0 tabular-nums">
            {m.necesario % 1 === 0 ? m.necesario : m.necesario.toFixed(2)}{" "}
            {m.unidad}
          </span>
        </div>
      ))}
    </div>
  );
}
