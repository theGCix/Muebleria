// src/components/home/CotizarMedida.tsx
// «¿No encuentras tu medida?» (boceto v3): franja bosque con «Cotizar a medida». El botón despliega el formulario de siempre
// (FormularioMedida: mismos campos, mismo lead con origen «web»). Conserva id="a-medida" y se abre solo si la URL trae #a-medida
// (portada, armador de presupuesto y menú apuntan a ese ancla).
import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { FormularioMedida } from "@/components/MedidaCTA";

export function CotizarMedida() {
  const hash = useLocation({ select: (l) => l.hash });
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (hash === "a-medida") setAbierto(true);
  }, [hash]);

  return (
    <section id="a-medida" aria-labelledby="medida-titulo" className="scroll-mt-28 border-t border-white/15 bg-gm-bosque text-white">
      <div className="container mx-auto max-w-6xl px-4 py-9 md:py-12">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-10">
          <div>
            <h2 id="medida-titulo" className="font-display text-[1.625rem] font-normal leading-tight md:text-[2rem]">
              ¿No encuentras tu medida?
            </h2>
            <p className="mt-1 text-sm text-white/90 md:text-base">
              El taller fabrica a medida.<span className="hidden md:inline"> Cuéntanos tu espacio y un asesor te contacta.</span>
            </p>
          </div>
          <button
            type="button"
            aria-expanded={abierto}
            aria-controls="medida-formulario"
            onClick={() => setAbierto((v) => !v)}
            className="inline-flex min-h-12 w-fit items-center justify-center rounded-full bg-white px-8 text-sm font-semibold text-gm-bosque transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gm-bosque"
          >
            {abierto ? "Ocultar formulario" : "Cotizar a medida"}
          </button>
        </div>

        {abierto && (
          <div id="medida-formulario" className="mx-auto mt-8 max-w-2xl">
            <FormularioMedida />
          </div>
        )}
      </div>
    </section>
  );
}
