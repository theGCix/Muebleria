// src/components/checkout/OpcionesEntrega.tsx
// Un solo selector de entrega con 3 opciones (antes eran dos preguntas seguidas con 4 tarjetas iguales):
// Delivery en Lima y Callao · Envío a provincia · Recojo en tienda.
// Es solo interfaz: el estado del checkout sigue siendo metodoEntrega + destino.
import { Check } from "lucide-react";

export type OpcionEntrega = "lima" | "provincia" | "recojo";

export function OpcionesEntrega({
  valor, onElegir, precioLima,
}: {
  valor: OpcionEntrega;
  onElegir: (o: OpcionEntrega) => void;
  /** Texto del costo de Lima: «S/ 25.00» si ya hay distrito, «Desde S/ 15.00» si no. */
  precioLima: string;
}) {
  const opciones: { key: OpcionEntrega; titulo: string; sub: string; precio: string; verde?: boolean }[] = [
    { key: "lima", titulo: "Delivery en Lima y Callao", sub: "Pagas el envío aquí, según tu distrito", precio: precioLima },
    { key: "provincia", titulo: "Envío a provincia", sub: "Te confirmamos el flete por WhatsApp", precio: "Por confirmar" },
    { key: "recojo", titulo: "Recojo en tienda", sub: "Te avisamos cuando esté listo", precio: "Gratis", verde: true },
  ];

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Cómo quieres recibir tu pedido">
      {opciones.map((o) => {
        const activa = valor === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={activa}
            onClick={() => onElegir(o.key)}
            className={`flex w-full min-h-[56px] items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
              activa ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            }`}
          >
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                activa ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
              }`}
              aria-hidden
            >
              {activa && <Check className="h-3 w-3" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{o.titulo}</span>
              <span className="block text-xs text-muted-foreground">{o.sub}</span>
            </span>
            <span className={`shrink-0 text-sm font-semibold ${o.verde ? "text-primary" : "text-foreground"}`}>
              {o.precio}
            </span>
          </button>
        );
      })}
    </div>
  );
}
