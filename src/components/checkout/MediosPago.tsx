// src/components/checkout/MediosPago.tsx
// Logos de los medios de pago habilitados (src/lib/mediosPago.ts). Si falta el archivo del logo en
// /public/pagos/, muestra el nombre en una etiqueta: nunca queda un ícono roto.
import { useState } from "react";
import { MEDIOS_PAGO, type GrupoMedio } from "@/lib/mediosPago";

export function LogoMedio({ nombre, logo, altura = "h-6" }: { nombre: string; logo?: string; altura?: string }) {
  const [fallo, setFallo] = useState(false);
  if (!logo || fallo) {
    return (
      <span className="inline-flex min-h-6 items-center rounded border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground">
        {nombre}
      </span>
    );
  }
  return (
    <img
      src={logo}
      alt={nombre}
      className={`${altura} w-auto object-contain`}
      loading="lazy"
      onError={() => setFallo(true)}
    />
  );
}

/** Lista de medios habilitados; con `grupo` solo los de ese grupo. No dibuja nada si no hay ninguno. */
export function MediosPago({ grupo, className = "" }: { grupo?: GrupoMedio; className?: string }) {
  const medios = MEDIOS_PAGO.filter((m) => m.habilitado && (!grupo || m.grupo === grupo));
  if (medios.length === 0) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Medios de pago aceptados">
      {medios.map((m) => (
        <li key={m.id}>
          <LogoMedio nombre={m.nombre} logo={m.logo} />
        </li>
      ))}
    </ul>
  );
}