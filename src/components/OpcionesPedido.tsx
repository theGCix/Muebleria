// src/components/OpcionesPedido.tsx
// Etiquetas con las opciones elegidas de un ítem del pedido (Color: Verde · Tapizado: Cuero …).
import type { OpcionPedido } from "@/lib/opcionesPedido";
import { cn } from "@/lib/utils";

export function OpcionesPedido({
  opciones,
  conMaterial = false,
  className,
}: {
  opciones: OpcionPedido[];
  /** El carpintero ve también el material (p. ej. "Cuero · cuero ecológico"). */
  conMaterial?: boolean;
  className?: string;
}) {
  if (opciones.length === 0) return null;
  return (
    <ul className={cn("mt-1 flex flex-wrap gap-1.5", className)} aria-label="Opciones elegidas">
      {opciones.map((o) => (
        <li
          key={o.valor_id ?? `${o.tipo}-${o.valor}`}
          className="rounded-full bg-muted px-2 py-0.5 text-[11px] leading-tight text-foreground/80"
        >
          <span className="text-muted-foreground">{o.etiqueta}:</span> {o.valor}
          {conMaterial && o.material && o.material.toLowerCase() !== o.valor.toLowerCase() ? ` · ${o.material}` : ""}
        </li>
      ))}
    </ul>
  );
}
