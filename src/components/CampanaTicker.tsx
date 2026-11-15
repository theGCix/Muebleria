// src/components/CampanaTicker.tsx
// Cuenta regresiva de la campaña activa, con dos presentaciones:
//  · «barra» (por defecto): texto de la barra superior del Header, visible en todas las páginas.
//  · «portada»: reloj visual (días · horas · min · seg en casillas) para la diapositiva de la campaña.
// Sin campaña vigente (o ya terminada) muestra `fallback`.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import { useCampana } from "@/hooks/useCampana";
import { useCountdown } from "@/hooks/useCountdown";

const dos = (n: number) => String(n).padStart(2, "0");

export function CampanaTicker({
  fallback,
  variante = "barra",
}: {
  fallback: ReactNode;
  variante?: "barra" | "portada";
}) {
  const { campana } = useCampana();
  const r = useCountdown(campana?.venceMs ?? null);

  if (!campana || !r || r.terminada) return <>{fallback}</>;

  if (variante === "portada") {
    // Con menos de un día se quita la casilla de días para que el reloj no muestre «00».
    const casillas: [string, string][] = [
      ...(r.d > 0 ? ([[dos(r.d), "días"]] as [string, string][]) : []),
      [dos(r.h), "horas"],
      [dos(r.m), "min"],
      [dos(r.s), "seg"],
    ];
    const texto =
      r.d > 0
        ? `${r.d} ${r.d === 1 ? "día" : "días"}, ${r.h} horas y ${r.m} minutos`
        : `${r.h} horas y ${r.m} minutos`;
    return (
      <div role="timer" aria-label={`Termina en ${texto}`}>
        <p aria-hidden className="text-xs font-semibold uppercase tracking-wide text-gm-durazno md:text-sm">
          Termina en
        </p>
        <div aria-hidden className="mt-1.5 flex items-start gap-1.5 md:mt-2 md:gap-2.5">
          {casillas.map(([valor, rotulo], i) => (
            <div key={rotulo} className="flex items-start gap-1.5 md:gap-2.5">
              {i > 0 && (
                <span className="mt-1.5 font-display text-lg leading-none text-gm-durazno/60 md:mt-2 md:text-2xl">:</span>
              )}
              <div className="flex w-10 flex-col items-center rounded-lg bg-gm-bosque-2 py-1.5 ring-1 ring-white/15 md:w-16 md:rounded-xl md:py-2.5">
                <span className="font-display text-xl font-bold leading-none tabular-nums text-gm-durazno md:text-4xl">
                  {valor}
                </span>
                <span className="mt-1 text-[9px] uppercase leading-none tracking-wide text-background/80 md:text-[11px]">
                  {rotulo}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const restante =
    r.d > 0 ? `${r.d}d ${dos(r.h)}h ${dos(r.m)}m` : `${dos(r.h)}:${dos(r.m)}:${dos(r.s)}`;

  return (
    <Link
      to="/"
      hash="ofertas"
      className="flex min-h-11 items-center gap-1.5 hover:underline underline-offset-2"
    >
      <Flame className="h-3.5 w-3.5 flex-shrink-0" />
      <span>
        {campana.nombre ? `${campana.nombre}: ` : "Ofertas: "}hasta -{campana.maxDescuento}%.
        Termina en <span className="font-semibold tabular-nums">{restante}</span>
      </span>
    </Link>
  );
}