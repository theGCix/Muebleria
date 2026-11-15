// src/components/home/CotizarMedida.tsx
// «Calidad que se adapta a ti» (mockup azul marino): franja arena con foto del taller (src/assets/portada/taller.jpg, opcional) y «Solicitar presupuesto». El botón despliega el formulario de siempre
// (FormularioMedida: mismos campos, mismo lead con origen «web»). Conserva id="a-medida" y se abre solo si la URL trae #a-medida
// (portada, armador de presupuesto y menú apuntan a ese ancla).
import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { FormularioMedida } from "@/components/MedidaCTA";
import { fotosPortada } from "@/lib/portadaFotos";

export function CotizarMedida() {
  const hash = useLocation({ select: (l) => l.hash });
  const [abierto, setAbierto] = useState(false);
  const foto = fotosPortada("taller")[0];

  useEffect(() => {
    if (hash === "a-medida") setAbierto(true);
  }, [hash]);

  return (
    <section id="a-medida" aria-labelledby="medida-titulo" className="scroll-mt-28 overflow-hidden bg-gradient-to-r from-gm-tan to-gm-arena text-gm-bosque">
      <div className="container relative mx-auto max-w-6xl px-4 py-9 md:py-12">
        {foto && (
          <img
            src={foto}
            alt=""
            loading="lazy"
            className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[45%] object-cover md:block [mask-image:linear-gradient(to_right,transparent,black_35%)]"
          />
        )}
        <div className="relative flex flex-col gap-5 md:max-w-[55%] md:items-start">
          <div>
            <h2 id="medida-titulo" className="font-display text-[1.625rem] font-bold leading-tight md:text-[2rem]">
              Calidad que se adapta a ti
            </h2>
            <p className="mt-1 text-sm md:text-base">
              El taller fabrica a medida.<span className="hidden md:inline"> Cuéntanos tu espacio y un asesor te contacta.</span>
            </p>
          </div>
          <button
            type="button"
            aria-expanded={abierto}
            aria-controls="medida-formulario"
            onClick={() => setAbierto((v) => !v)}
            className="inline-flex min-h-12 w-fit items-center justify-center rounded-full bg-gm-bosque px-8 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gm-bosque"
          >
            {abierto ? "Ocultar formulario" : "Solicitar presupuesto"}
          </button>
        </div>

        {abierto && (
          <div id="medida-formulario" className="relative mx-auto mt-8 max-w-2xl rounded-2xl bg-card p-4 text-foreground shadow-sm md:p-6">
            <FormularioMedida />
          </div>
        )}
      </div>
    </section>
  );
}
