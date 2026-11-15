// src/components/BeneficiosFranja.tsx
// Franja de beneficios (5, como el mockup) antes del pie. Solo lo que el sitio ya ofrece y dice en otras pantallas:
// envíos a todo el Perú (checkout), medios de pago confirmados (src/lib/mediosPago.ts: tarjetas, Yape y Plin),
// pago procesado por Niubiz y atención por WhatsApp. No se anuncian cuotas: el cobro no las ofrece.
import { Hammer, Ruler, ShieldCheck, Truck, Wallet } from "lucide-react";

const BENEFICIOS = [
  { icono: Hammer, titulo: "Fabricación propia", detalle: "Hecho en nuestro taller" },
  { icono: Ruler, titulo: "A tu medida", detalle: "Cuéntanos tu espacio" },
  { icono: Truck, titulo: "Envíos a todo el Perú", detalle: "Lima y provincias" },
  { icono: Wallet, titulo: "Paga como prefieras", detalle: "Tarjeta, Yape o Plin" },
  { icono: ShieldCheck, titulo: "Compra segura", detalle: "Pago protegido con Niubiz" },
] as const;

export function BeneficiosFranja() {
  return (
    <section aria-label="Beneficios de comprar en G&M" className="border-y border-border/60 bg-card">
      <ul className="container mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-5 px-4 py-5 md:grid-cols-5 md:gap-0 md:py-6">
        {BENEFICIOS.map(({ icono: Icono, titulo, detalle }, i) => (
          <li
            key={titulo}
            className={`flex min-w-0 items-center gap-3 md:justify-center ${i > 0 ? "md:border-l md:border-border/60" : ""}`}
          >
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <Icono className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight text-foreground">{titulo}</span>
              <span className="block text-xs leading-snug text-muted-foreground">{detalle}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
