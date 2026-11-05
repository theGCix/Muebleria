// src/components/proyectos/ReaccionesProyecto.tsx
// Reacciones de un proyecto: resumen en la tarjeta (solo lectura) y selector en el detalle.
import { REACCIONES, totalReacciones, type ConteoProyecto, type TipoReaccion } from "@/hooks/useReaccionesProyectos";

/** Resumen para la tarjeta: aparece desde la primera reacción. No es un botón (la tarjeta ya lo es). */
export function ResumenReacciones({ conteo }: { conteo?: ConteoProyecto }) {
  const total = totalReacciones(conteo);
  if (total === 0) return null;
  const top = REACCIONES.filter((r) => (conteo?.[r.tipo] ?? 0) > 0)
    .sort((a, b) => (conteo?.[b.tipo] ?? 0) - (conteo?.[a.tipo] ?? 0))
    .slice(0, 3);
  return (
    <p
      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
      aria-label={`${total} ${total === 1 ? "reacción" : "reacciones"}`}
    >
      <span aria-hidden="true">{top.map((r) => r.emoji).join("")}</span>
      <span>{total}</span>
    </p>
  );
}

/** Selector del detalle: 4 reacciones táctiles (≥ 44 px). Tocar la propia la quita; otra la cambia. */
export function SelectorReacciones({
  conteo,
  mia,
  haySesion,
  onReaccionar,
}: {
  conteo?: ConteoProyecto;
  mia?: TipoReaccion;
  haySesion: boolean;
  onReaccionar: (t: TipoReaccion) => void;
}) {
  return (
    <div>
      <div role="group" aria-label="Reacciona a este proyecto" className="grid grid-cols-4 gap-2">
        {REACCIONES.map((r) => {
          const n = conteo?.[r.tipo] ?? 0;
          const activa = mia === r.tipo;
          return (
            <button
              key={r.tipo}
              type="button"
              onClick={() => onReaccionar(r.tipo)}
              aria-pressed={activa}
              aria-label={`${r.etiqueta}${n > 0 ? `, ${n}` : ""}`}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-center transition-colors ${
                activa ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
              }`}
            >
              <span className="text-xl leading-none" aria-hidden="true">{r.emoji}</span>
              <span className="text-[11px] leading-tight text-foreground">{r.etiqueta}</span>
              {n > 0 && <span className="text-xs font-semibold leading-none text-foreground">{n}</span>}
            </button>
          );
        })}
      </div>
      {!haySesion && <p className="mt-2 text-xs text-muted-foreground">Inicia sesión para reaccionar.</p>}
    </div>
  );
}
