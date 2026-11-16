// src/components/checkout/PasosCheckout.tsx
// Indicador de pasos del checkout (Datos → Envío → Pago). Es solo orientación: el formulario sigue siendo
// uno solo y cada paso lleva (desplaza) a su sección. «Completo» sale de datos reales del formulario.
import { Check } from "lucide-react";

export interface PasoCheckout {
  id: string; // id de la sección a la que desplaza
  label: string;
  hecho: boolean;
}

export function PasosCheckout({ pasos, className = "" }: { pasos: PasoCheckout[]; className?: string }) {
  // El paso actual es el primero sin completar; si todos los anteriores están listos, el último (Pago)
  const actual = Math.max(0, pasos.findIndex((p) => !p.hecho));
  const irA = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <nav aria-label="Pasos de la compra" className={className}>
      <ol className="flex items-center">
        {pasos.map((p, i) => {
          const esActual = i === actual && !p.hecho;
          return (
            <li key={p.id} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={() => irA(p.id)}
                aria-current={esActual ? "step" : undefined}
                className="flex min-h-[44px] items-center gap-2 rounded-md pr-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span
                  aria-hidden
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    p.hecho
                      ? "bg-primary text-primary-foreground"
                      : esActual
                        ? "border-2 border-primary text-primary"
                        : "border border-border text-muted-foreground"
                  }`}
                >
                  {p.hecho ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={`text-sm ${esActual || p.hecho ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {p.label}
                  {p.hecho && <span className="sr-only"> (completo)</span>}
                </span>
              </button>
              {i < pasos.length - 1 && <span aria-hidden className={`h-px flex-1 ${p.hecho ? "bg-primary" : "bg-border"}`} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
