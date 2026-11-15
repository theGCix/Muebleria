// src/components/home/HechoEnTaller.tsx
// «Hecho en nuestro taller» (boceto v3): 4 pasos (en móvil, tarjetas 2×2) y foto o video del taller. Los textos salen de lib/taller.ts (los del dueño):
// «Madera tornillo» ← corte, «Armado y lijado» ← lijado + armado, «Barniz y acabado» ← sellado y acabado, «Entrega a tu casa»
// ← embalaje y despacho (lib/seccionesHome.ts). Sin foto ni video no se dibuja el recuadro (nunca una foto de ejemplo).
// El video no carga ningún reproductor hasta que el cliente lo pide (regla 7.5).
import { useMemo } from "react";
import { fotosPortada } from "@/lib/portadaFotos";
import { pasosTallerHome } from "@/lib/seccionesHome";
import { TALLER_PASOS, TALLER_PORTADA, TALLER_PORTADA_ALT, TALLER_VIDEO, fotoUrl, videoFuente } from "@/lib/taller";
import { VideoTaller } from "@/components/taller/VideoTaller";

export function HechoEnTaller() {
  const pasos = useMemo(() => pasosTallerHome(TALLER_PASOS), []);
  const video = TALLER_VIDEO && videoFuente(TALLER_VIDEO.url) ? TALLER_VIDEO : null;
  const foto = fotosPortada("taller")[0] ?? fotoUrl(TALLER_PORTADA, 1200);
  const hayMedia = !!video || !!foto;

  if (pasos.length === 0) return null;

  return (
    <section id="taller" aria-labelledby="taller-titulo" className="scroll-mt-28 bg-gm-salvia">
      <div
        className={`container mx-auto grid max-w-6xl items-center gap-6 px-4 py-9 md:py-12 ${
          hayMedia ? "lg:grid-cols-[1.1fr_1fr] lg:gap-12" : ""
        }`}
      >
        <div>
          <h2 id="taller-titulo" className="font-display text-[1.625rem] font-normal leading-tight text-gm-bosque md:text-[2rem]">
            Hecho en nuestro taller
          </h2>
          <p className="mt-1 text-sm text-foreground/80 md:text-base">
            Mira cómo nace cada pieza, paso a paso.
          </p>

          {/* Móvil: los 4 pasos como tarjetas 2×2 (antes, una sola línea de texto) */}
          <ol className="mt-5 grid grid-cols-2 gap-2.5 md:hidden">
            {pasos.map((p) => (
              <li key={p.n} className="flex items-center gap-2.5 rounded-xl bg-card p-3">
                <span
                  aria-hidden
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gm-bosque text-sm font-semibold text-white"
                >
                  {p.n}
                </span>
                <span className="min-w-0 text-[0.8125rem] font-semibold leading-snug text-foreground">{p.titulo}</span>
                <span className="sr-only">{p.descripcion}</span>
              </li>
            ))}
          </ol>

          {/* PC: círculos numerados unidos por una línea punteada */}
          <ol className={`mt-8 hidden items-start md:flex ${hayMedia ? "" : "max-w-2xl"}`}>
            {pasos.map((p, i) => (
              <li key={p.n} className="flex flex-1 items-start last:flex-none">
                <span className="flex w-28 flex-col items-center text-center">
                  <span
                    aria-hidden
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gm-bosque text-base font-semibold text-white"
                  >
                    {p.n}
                  </span>
                  <span className="mt-2 text-sm font-semibold text-foreground">{p.titulo}</span>
                  <span className="text-xs text-foreground/75">{p.sub}</span>
                  <span className="sr-only">{p.descripcion}</span>
                </span>
                {i < pasos.length - 1 && (
                  <span aria-hidden className="mt-[22px] h-0 flex-1 border-t-2 border-dashed border-gm-bosque/40" />
                )}
              </li>
            ))}
          </ol>
        </div>

        {hayMedia &&
          (video ? (
            <VideoTaller video={video} />
          ) : (
            <img
              src={foto!}
              alt={TALLER_PORTADA_ALT ?? "Taller de G&M Mueblería"}
              width={1200}
              height={800}
              loading="lazy"
              className="aspect-[16/10] w-full rounded-3xl bg-gm-arena object-cover"
            />
          ))}
      </div>
    </section>
  );
}
