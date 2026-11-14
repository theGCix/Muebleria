// src/components/checkout/MetodosPago.tsx
// «Método de pago» del checkout (Parte 8.4): tarjeta · Yape o Plin · efectivo.
// Tarjeta y Yape/Plin se cobran completos por Niubiz. El efectivo solo existe en recojo en tienda y en
// delivery Lima y Callao (contra entrega, con adelanto online). Es solo interfaz: el servidor decide el cobro.
import { Banknote, CreditCard, Smartphone, Check } from "lucide-react";
import { MediosPago, LogoMedio } from "@/components/checkout/MediosPago";
import { MEDIO_NIUBIZ } from "@/lib/mediosPago";
import type { MetodoPago, ModalidadPago } from "@/lib/pagoEfectivo";

export function MetodosPago({
  valor, onElegir, efectivoDisponible, modalidad, adelanto, saldo, fmt,
}: {
  valor: MetodoPago;
  onElegir: (m: MetodoPago) => void;
  efectivoDisponible: boolean;
  /** Modalidad que tendría el pedido si eligiera efectivo (para explicar cuánto se paga ahora). */
  modalidad: ModalidadPago;
  adelanto: number;
  saldo: number;
  fmt: (n: number) => string;
}) {
  const opciones: { key: MetodoPago; titulo: string; icono: typeof CreditCard; deshabilitada?: boolean; detalle: React.ReactNode }[] = [
    {
      key: "tarjeta", titulo: "Tarjeta de crédito o débito", icono: CreditCard,
      detalle: (
        <>
          <span className="block text-xs text-muted-foreground">Pago seguro procesado por Niubiz</span>
          <MediosPago grupo="tarjeta" className="mt-2" />
        </>
      ),
    },
    {
      key: "yape_plin", titulo: "Yape o Plin", icono: Smartphone,
      detalle: (
        <>
          <span className="block text-xs text-muted-foreground">Pagas el total desde tu celular, con Niubiz</span>
          <MediosPago grupo="billetera" className="mt-2" />
        </>
      ),
    },
    {
      key: "efectivo", titulo: "Efectivo", icono: Banknote, deshabilitada: !efectivoDisponible,
      detalle: !efectivoDisponible ? (
        <span className="block text-xs text-muted-foreground">Solo en recojo en tienda y delivery en Lima y Callao</span>
      ) : modalidad === "efectivo_recojo" ? (
        <span className="block text-xs text-muted-foreground">
          Pagas todo en la tienda al recoger. Confirmamos tu pedido y te avisamos cuando esté listo.
        </span>
      ) : (
        <span className="block text-xs text-muted-foreground">
          Contra entrega: pagas un adelanto de <b className="text-foreground">{fmt(adelanto)}</b> ahora y
          el saldo de <b className="text-foreground">{fmt(saldo)}</b> en efectivo al recibir.
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Método de pago">
      {opciones.map((o) => {
        const activa = valor === o.key && !o.deshabilitada;
        const Icono = o.icono;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={activa}
            aria-disabled={o.deshabilitada || undefined}
            disabled={o.deshabilitada}
            onClick={() => onElegir(o.key)}
            className={`flex w-full min-h-[56px] items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
              o.deshabilitada ? "cursor-not-allowed border-border opacity-60"
                : activa ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            }`}
          >
            <span
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                activa ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
              }`}
              aria-hidden
            >
              {activa && <Check className="h-3 w-3" />}
            </span>
            <Icono className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{o.titulo}</span>
              {o.detalle}
            </span>
            {o.key !== "efectivo" && (
              <LogoMedio nombre={MEDIO_NIUBIZ.nombre} logo={MEDIO_NIUBIZ.logo} altura="h-6" />
            )}
          </button>
        );
      })}
    </div>
  );
}
