// src/components/admin/ItemsBoleta.tsx
// Ítems de una boleta: tabla desde 640 px y tarjetas apiladas por debajo (sin scroll horizontal).
import { cn } from "@/lib/utils";

const fmt = (n: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

export interface ItemBoleta { id: string | number; title: string; qty: number | string; unit_price: number | string; total: number | string }
export interface FilaPie { etiqueta: string; valor: number; fuerte?: boolean }

export function ItemsBoleta({ items, pie = [] }: { items: ItemBoleta[]; pie?: FilaPie[] }) {
  return (
    <div className="overflow-hidden rounded border">
      {/* Móvil: tarjetas */}
      <ul className="divide-y sm:hidden">
        {items.map((it) => (
          <li key={it.id} className="space-y-1 p-3">
            <p className="break-words text-sm font-medium leading-snug">{it.title}</p>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{it.qty} × {fmt(Number(it.unit_price))}</span>
              <span className="font-semibold tabular-nums">{fmt(Number(it.total))}</span>
            </div>
          </li>
        ))}
        {pie.map((f) => (
          <li key={f.etiqueta} className={cn("flex items-baseline justify-between gap-3 bg-muted/30 px-3 py-2 text-sm", f.fuerte && "font-semibold")}>
            <span className={f.fuerte ? undefined : "text-muted-foreground"}>{f.etiqueta}</span>
            <span className="tabular-nums">{fmt(f.valor)}</span>
          </li>
        ))}
      </ul>

      {/* Escritorio: tabla */}
      <table className="hidden w-full text-xs sm:table">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left">Producto</th>
            <th className="px-3 py-2 text-right">Cant.</th>
            <th className="px-3 py-2 text-right">P. Unit.</th>
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t">
              <td className="px-3 py-2">{it.title}</td>
              <td className="px-3 py-2 text-right">{it.qty}</td>
              <td className="px-3 py-2 text-right">{fmt(Number(it.unit_price))}</td>
              <td className="px-3 py-2 text-right">{fmt(Number(it.total))}</td>
            </tr>
          ))}
        </tbody>
        {pie.length > 0 && (
          <tfoot className="bg-muted/30">
            {pie.map((f) => (
              <tr key={f.etiqueta} className={cn("border-t", f.fuerte && "font-semibold")}>
                <td colSpan={3} className={cn("px-3 py-2 text-right", !f.fuerte && "text-muted-foreground")}>{f.etiqueta}</td>
                <td className="px-3 py-2 text-right">{fmt(f.valor)}</td>
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </div>
  );
}
