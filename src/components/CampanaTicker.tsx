// src/components/CampanaTicker.tsx
// Texto de la barra superior del Header: con campaña activa muestra la cuenta regresiva
// (visible en todas las páginas); si no, muestra el mensaje de servicio de siempre.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import { useCampana } from "@/hooks/useCampana";
import { useCountdown } from "@/hooks/useCountdown";

const dos = (n: number) => String(n).padStart(2, "0");

export function CampanaTicker({ fallback }: { fallback: ReactNode }) {
  const { campana } = useCampana();
  const r = useCountdown(campana?.venceMs ?? null);

  if (!campana || !r || r.terminada) return <>{fallback}</>;

  const restante =
    r.d > 0 ? `${r.d}d ${dos(r.h)}h ${dos(r.m)}m` : `${dos(r.h)}:${dos(r.m)}:${dos(r.s)}`;

  return (
    <Link
      to="/"
      hash="ofertas"
      className="flex items-center gap-1.5 hover:underline underline-offset-2"
    >
      <Flame className="h-3.5 w-3.5 flex-shrink-0" />
      <span>
        {campana.nombre ? `${campana.nombre}: ` : "Ofertas: "}hasta -{campana.maxDescuento}%.
        Termina en <span className="font-semibold tabular-nums">{restante}</span>
      </span>
    </Link>
  );
}
