// src/components/admin/FiltrosEstado.tsx
// Filtros por estado en una sola fila con desplazamiento horizontal (sin saltar a varias filas en móvil).
// Un degradado en el borde avisa cuando hay botones fuera de la vista; el activo se centra al elegirlo.
import { useEffect, useRef, useState } from "react";

export function FiltrosEstado<K extends string>({
  opciones, valor, onChange, cuenta, etiqueta = "Filtrar por estado",
}: {
  opciones: { key: K; label: string }[];
  valor: K;
  onChange: (k: K) => void;
  cuenta?: Partial<Record<K, number>>;
  etiqueta?: string;
}) {
  const fila = useRef<HTMLDivElement>(null);
  const [borde, setBorde] = useState({ izq: false, der: false });

  useEffect(() => {
    const el = fila.current;
    if (!el) return;
    const medir = () =>
      setBorde({ izq: el.scrollLeft > 4, der: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", medir); ro.disconnect(); };
  }, []);

  const elegir = (key: K, btn: HTMLElement) => {
    onChange(key);
    const el = fila.current;
    if (el) el.scrollTo({ left: btn.offsetLeft - (el.clientWidth - btn.offsetWidth) / 2, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={fila}
        role="group"
        aria-label={etiqueta}
        className="flex flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {opciones.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={(e) => elegir(t.key, e.currentTarget)}
            aria-pressed={valor === t.key}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9 ${
              valor === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
            }`}
          >
            {t.label}
            {cuenta && (
              <span className={`text-xs ${valor === t.key ? "opacity-80" : "text-muted-foreground"}`}>{cuenta[t.key]}</span>
            )}
          </button>
        ))}
      </div>
      {borde.izq && <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent" />}
      {borde.der && <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" />}
    </div>
  );
}
