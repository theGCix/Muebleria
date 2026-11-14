// src/components/SelectorSegmento.tsx
// «¿Para qué es?»: elige uno de los segmentos de lib/segmentos.ts (o ninguno). Opcional siempre.
//  - variant "chips": fila de botones (portada y formulario a medida)
//  - variant "select": lista nativa, más compacta (diálogo de cotización)
import { useId } from "react";
import { SEGMENTOS, esSegmento, type SegmentoId } from "@/lib/segmentos";

interface Props {
  value: SegmentoId | null;
  onChange: (v: SegmentoId | null) => void;
  label?: string;
  variant?: "chips" | "select";
  /** En móvil, una sola fila que se desliza (ahorra altura en la portada). */
  deslizable?: boolean;
  className?: string;
}

export function SelectorSegmento({
  value,
  onChange,
  label = "¿Para qué es?",
  variant = "chips",
  deslizable = false,
  className = "",
}: Props) {
  const id = useId();

  if (variant === "select") {
    return (
      <div className={className}>
        <label htmlFor={id} className="text-sm font-medium leading-none">
          {label} <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <select
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(esSegmento(e.target.value) ? e.target.value : null)}
          className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Prefiero no decirlo</option>
          {SEGMENTOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={className}>
      <p id={id} className="mb-2 text-sm font-medium text-muted-foreground">
        {label} <span className="font-normal">(opcional)</span>
      </p>
      <div
        role="group"
        aria-labelledby={id}
        className={
          deslizable
            ? "-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-start sm:overflow-visible sm:px-0"
            : "flex flex-wrap gap-2"
        }
      >
        {SEGMENTOS.map((s) => {
          const activo = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={activo}
              onClick={() => onChange(activo ? null : s.id)}
              className={`min-h-[44px] shrink-0 snap-start rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                activo
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary"
              }`}
            >
              {s.chip}
            </button>
          );
        })}
      </div>
    </div>
  );
}
