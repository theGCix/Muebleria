// src/components/checkout/DireccionesGuardadas.tsx
// Selector rápido de las direcciones guardadas en "Mis direcciones" (solo envío a Lima y Callao).
import { Link } from "@tanstack/react-router";
import { Check, MapPin } from "lucide-react";
import type { Address } from "@/lib/perfil.functions";
import { direccionUsable, distritoDeTarifa } from "@/hooks/useCheckoutPrefill";

export function DireccionesGuardadas({
  direcciones, direccionActual, distritoActual, onElegir,
}: {
  direcciones: Address[];
  direccionActual: string;
  distritoActual: string;
  onElegir: (a: Address) => void;
}) {
  const lista = direcciones.filter(direccionUsable);
  if (lista.length === 0) return null;

  return (
    <div className="sm:col-span-2 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Tus direcciones guardadas</p>
        <Link
          to="/perfil/direcciones"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Administrar
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Direcciones guardadas">
        {lista.map((a) => {
          const activa =
            a.direccion.trim() === direccionActual.trim() && distritoDeTarifa(a.distrito) === distritoActual;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={activa}
              onClick={() => onElegir(a)}
              className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                activa ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {a.etiqueta}
                  {a.predeterminada && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      Predeterminada
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[a.direccion, a.distrito].filter(Boolean).join(" · ")}
                </span>
              </span>
              {activa && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
