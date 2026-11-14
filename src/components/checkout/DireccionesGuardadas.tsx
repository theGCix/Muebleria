// src/components/checkout/DireccionesGuardadas.tsx
// Parte del checkout para envío a Lima y Callao con direcciones de "Mis direcciones":
//  · <DireccionSeleccionada>: tarjeta resumen «Entregar en» con botón «Cambiar» (estado normal).
//  · <DireccionesGuardadas>: lista para elegir otra, con «Usar otra dirección» y «Administrar».
import { Link } from "@tanstack/react-router";
import { Check, MapPin } from "lucide-react";
import type { Address } from "@/lib/perfil.functions";
import { distritoDeTarifa } from "@/hooks/useCheckoutPrefill";

const envioTxt = (envio: number | null | undefined, fmt: (n: number) => string) =>
  envio == null ? null : `Envío ${fmt(envio)}`;

/** Tarjeta resumen de la dirección elegida, con el costo de envío a la vista. */
export function DireccionSeleccionada({
  direccion, envio, fmt, onCambiar,
}: {
  direccion: Address;
  envio: number | null | undefined;
  fmt: (n: number) => string;
  onCambiar: () => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Entregar en</p>
      <div className="flex items-start gap-3 rounded-lg border border-primary bg-primary/5 p-3">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{direccion.etiqueta}</p>
          <p className="break-words text-sm text-muted-foreground">
            {[direccion.direccion, direccion.distrito].filter(Boolean).join(" · ")}
          </p>
          {envioTxt(envio, fmt) && <p className="mt-1 text-xs font-semibold">{envioTxt(envio, fmt)}</p>}
        </div>
        <button
          type="button"
          onClick={onCambiar}
          className="min-h-[44px] shrink-0 px-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Cambiar
        </button>
      </div>
    </div>
  );
}

export function DireccionesGuardadas({
  direcciones, direccionActual, distritoActual, envioDe, fmt, onElegir, onUsarOtra, onCancelar,
}: {
  direcciones: Address[]; // ya filtradas (usables) por el checkout
  direccionActual: string;
  distritoActual: string;
  envioDe: (distrito: string) => number | null | undefined;
  fmt: (n: number) => string;
  onElegir: (a: Address) => void;
  onUsarOtra: () => void;
  /** Solo cuando ya había una elegida: permite cerrar la lista sin cambiar nada. */
  onCancelar?: () => void;
}) {
  if (direcciones.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Elige dónde entregamos</p>
        <Link
          to="/perfil/direcciones"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Administrar
        </Link>
      </div>
      <div className="grid gap-2" role="radiogroup" aria-label="Direcciones guardadas">
        {direcciones.map((a) => {
          const activa =
            a.direccion.trim() === direccionActual.trim() && distritoDeTarifa(a.distrito) === distritoActual;
          const envio = envioTxt(envioDe(distritoDeTarifa(a.distrito)), fmt);
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={activa}
              onClick={() => onElegir(a)}
              className={`flex min-h-[56px] items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                activa ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {a.etiqueta}
                  {a.predeterminada && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                      Predeterminada
                    </span>
                  )}
                </span>
                <span className="block break-words text-sm text-muted-foreground">{a.direccion}</span>
                <span className="block text-xs text-muted-foreground">
                  {[a.distrito, envio].filter(Boolean).join(" · ")}
                </span>
              </span>
              {activa && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onUsarOtra}
          className="min-h-[44px] rounded-lg border border-dashed border-border p-3 text-left text-sm font-medium text-primary transition-colors hover:border-primary/40"
        >
          + Usar otra dirección
        </button>
      </div>
      {onCancelar && (
        <button
          type="button"
          onClick={onCancelar}
          className="min-h-[44px] text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Cancelar
        </button>
      )}
    </div>
  );
}
