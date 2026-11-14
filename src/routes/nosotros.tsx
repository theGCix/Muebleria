// src/routes/nosotros.tsx
// "Nuestro taller": cómo se fabrica un mueble G&M, paso a paso. El contenido y las fotos
// se editan en src/lib/taller.ts (los pasos salen del flujo real de fabricación).
import { useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Armchair, Clock, Hammer, MapPin, MessageCircle, PackageCheck, Paintbrush, Ruler, ShieldCheck, Sparkles, TreeDeciduous,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { gsap, useGSAP, MQ } from "@/lib/gsap";
import { EMPRESA, HORARIO, WHATSAPP_NUMBER } from "@/config";
import { MapaTaller } from "@/components/taller/MapaTaller";
import { VideoTaller } from "@/components/taller/VideoTaller";
import { trackEvent } from "@/hooks/useEventTracking";
import {
  TALLER_EQUIPO, TALLER_GALERIA, TALLER_PASOS, TALLER_PORTADA, TALLER_PORTADA_ALT, TALLER_VIDEO, fotoUrl, videoFuente,
} from "@/lib/taller";

export const Route = createFileRoute("/nosotros")({
  head: () => ({
    meta: [
      { title: "Nuestro taller — G&M Mueblería" },
      {
        name: "description",
        content:
          "Conoce cómo fabricamos cada mueble en nuestro taller de Lima: madera tornillo seca y tratada, acabado a mano y control de calidad pieza por pieza.",
      },
      { property: "og:title", content: "Nuestro taller — G&M Mueblería" },
      { property: "og:description", content: "Así se hace un mueble G&M, paso a paso." },
    ],
  }),
  component: NosotrosPage,
});

const ICONOS: Record<string, LucideIcon> = {
  corte: Ruler,
  lijado: Sparkles,
  armado: Hammer,
  acabado: Paintbrush,
  tapizado: Armchair,
  calidad: ShieldCheck,
  embalaje: PackageCheck,
};

// Lo mismo que ya prometen las fichas de producto y sus preguntas frecuentes
const DATOS = ["Fabricado a pedido, en Lima", "Madera tornillo seca y tratada", "2 años de garantía en la estructura"];

const COMPROMISOS = [
  {
    icon: TreeDeciduous,
    titulo: "Madera que dura",
    texto: "Estructuras en madera tornillo seca y tratada, trabajadas a mano por nuestros carpinteros.",
  },
  {
    icon: Ruler,
    titulo: "Hecho para ti",
    texto:
      "Cada pieza se fabrica a pedido. Entregamos en Lima Metropolitana en 5–7 días hábiles y en provincias en 10–15; la fecha exacta la coordinamos al confirmar tu compra.",
  },
  {
    icon: ShieldCheck,
    titulo: "Garantía en la estructura",
    texto:
      "2 años de garantía. Si hay un defecto de fabricación, reparamos o reponemos sin costo dentro del período de garantía.",
  },
];

function NosotrosPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const portada = fotoUrl(TALLER_PORTADA, 1200);
  const galeria = TALLER_GALERIA.map((f) => ({ src: fotoUrl(f.foto, 800), alt: f.alt })).filter(
    (f): f is { src: string; alt: string | undefined } => !!f.src,
  );
  const equipo = TALLER_EQUIPO.filter((m) => m.nombre.trim() && m.rol.trim());
  const hayVideo = !!TALLER_VIDEO && !!videoFuente(TALLER_VIDEO.url);
  const direccionTienda = EMPRESA.direccion;

  useEffect(() => {
    trackEvent({ tipo: "pagina_vista", path: "/nosotros" });
  }, []);

  // Entrada suave al hacer scroll (respeta "reducir movimiento")
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.ok, () => {
        gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
          gsap.from(el, {
            y: 28,
            opacity: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          });
        });
      });
      return () => mm.revert();
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="min-h-screen bg-background">
      <Header />
      <main>
        {/* Portada */}
        <section className="px-4 pb-10 pt-14 md:pt-20">
          <div className="container mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2">
            <div className="reveal">
              <p className="mb-3 text-sm font-medium text-muted-foreground">Nuestro taller · Lima</p>
              <h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
                Hecho a mano, pieza por pieza
              </h1>
              <p className="mt-5 max-w-lg text-muted-foreground">
                Cada mueble G&amp;M nace en nuestro taller. Del corte de la madera al embalaje, estos son los pasos que
                sigue tu pieza antes de llegar a casa.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {DATOS.map((d) => (
                  <li key={d} className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium">
                    {d}
                  </li>
                ))}
              </ul>
            </div>

            {portada && (
              <div className="reveal aspect-[4/3] overflow-hidden rounded-3xl border border-border/60 bg-card">
                <img src={portada} alt={TALLER_PORTADA_ALT ?? "Taller de G&M Mueblería"} className="h-full w-full object-cover" />
              </div>
            )}
          </div>
        </section>

        {/* Proceso */}
        <section className="px-4 py-12 md:py-16">
          <div className="container mx-auto max-w-5xl">
            <div className="reveal mb-10 max-w-2xl">
              <h2 className="font-display text-3xl font-semibold">Cómo nace tu mueble</h2>
              <p className="mt-2 text-muted-foreground">Siete etapas, cada una revisada antes de pasar a la siguiente.</p>
            </div>

            <ol className="relative space-y-12 before:absolute before:bottom-2 before:left-[21px] before:top-2 before:w-px before:bg-border">
              {TALLER_PASOS.map((paso, i) => {
                const Icono = ICONOS[paso.id] ?? Hammer;
                const foto = fotoUrl(paso.foto, 1000);
                return (
                  <li key={paso.id} className="reveal relative flex gap-5 md:gap-8">
                    <div className="relative z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground ring-8 ring-background">
                      {i + 1}
                    </div>
                    <div className={`grid flex-1 items-center gap-6 ${foto ? "md:grid-cols-[1.1fr_1fr] md:gap-10" : ""}`}>
                      <div>
                        <div className="flex items-center gap-2 text-accent">
                          <Icono className="h-4 w-4" aria-hidden="true" />
                          <span className="text-xs font-medium">Paso {i + 1}</span>
                        </div>
                        <h3 className="mt-1 font-display text-2xl font-semibold">{paso.titulo}</h3>
                        <p className="mt-2 max-w-xl text-muted-foreground">{paso.descripcion}</p>
                        {paso.nota && (
                          <p className="mt-3 inline-block rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                            {paso.nota}
                          </p>
                        )}
                      </div>
                      {foto && (
                        <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border/60 bg-card">
                          <img src={foto} alt={paso.alt ?? `Paso ${i + 1}: ${paso.titulo}`} loading="lazy" className="h-full w-full object-cover" />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Video (solo si hay uno válido; el reproductor carga al pulsar) */}
        {hayVideo && TALLER_VIDEO && (
          <section className="px-4 py-12">
            <div className="container mx-auto max-w-4xl">
              <h2 className="reveal mb-6 font-display text-3xl font-semibold">Míralo en acción</h2>
              <div className="reveal">
                <VideoTaller video={TALLER_VIDEO} />
              </div>
            </div>
          </section>
        )}

        {/* Compromisos */}
        <section className="px-4 py-12">
          <div className="container mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
            {COMPROMISOS.map(({ icon: Icono, titulo, texto }) => (
              <div key={titulo} className="reveal rounded-2xl border border-border/60 bg-card p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Icono className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-display text-xl font-semibold">{titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* El equipo (solo si hay integrantes cargados en taller.ts) */}
        {equipo.length > 0 && (
          <section className="px-4 py-12">
            <div className="container mx-auto max-w-6xl">
              <h2 className="reveal mb-6 font-display text-3xl font-semibold">El equipo</h2>
              <ul className="grid grid-cols-2 gap-5 md:grid-cols-4">
                {equipo.map((m) => {
                  const foto = fotoUrl(m.foto, 500);
                  const iniciales = m.nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
                  return (
                    <li key={m.nombre} className="reveal text-center">
                      <div className="mx-auto aspect-square w-full max-w-[200px] overflow-hidden rounded-full border border-border/60 bg-secondary/50">
                        {foto ? (
                          <img src={foto} alt={`${m.nombre}, ${m.rol}`} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center font-display text-3xl text-muted-foreground" aria-hidden="true">
                            {iniciales}
                          </span>
                        )}
                      </div>
                      <p className="mt-3 font-medium">{m.nombre}</p>
                      <p className="text-sm text-muted-foreground">{m.rol}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {/* Galería (solo si hay fotos) */}
        {galeria.length > 0 && (
          <section className="px-4 py-12">
            <div className="container mx-auto max-w-6xl">
              <h2 className="reveal mb-6 font-display text-3xl font-semibold">Dentro del taller</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {galeria.map((f, i) => (
                  <div key={f.src + i} className="reveal aspect-square overflow-hidden rounded-xl border border-border/60 bg-card">
                    <img
                      src={f.src}
                      alt={f.alt ?? `Foto ${i + 1} de ${galeria.length} del taller de G&M Mueblería`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Visítanos: la dirección y el horario salen de config.ts (los mismos del pie de página) */}
        {direccionTienda && (
          <section className="px-4 py-12" aria-labelledby="visitanos-titulo">
            <div className="container mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2 md:gap-12">
              <div className="reveal">
                <h2 id="visitanos-titulo" className="font-display text-3xl font-semibold">Visita nuestra tienda</h2>
                <p className="mt-3 max-w-md text-muted-foreground">
                  Ven a ver los muebles en persona, tocar los acabados y conversar con nosotros.
                </p>
                <ul className="mt-6 space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-strong">
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Dirección</p>
                      <p className="font-medium">{direccionTienda}</p>
                    </div>
                  </li>
                  {HORARIO && (
                    <li className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-strong">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Horario</p>
                        <p className="font-medium">{HORARIO}</p>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
              <div className="reveal">
                <MapaTaller direccion={`${direccionTienda}, Lima, Perú`} />
              </div>
            </div>
          </section>
        )}

        {/* Cierre */}
        <section className="px-4 pb-20 pt-6">
          <div className="reveal container mx-auto max-w-4xl rounded-3xl bg-secondary/50 px-6 py-12 text-center md:px-12">
            <h2 className="font-display text-3xl font-semibold">¿Lo quieres a tu medida?</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Cuéntanos qué necesitas y te enviamos una cotización, sin compromiso de compra.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/" hash="a-medida">
                  <Ruler className="mr-2 h-4 w-4" /> Pedir cotización
                </Link>
              </Button>
              {WHATSAPP_NUMBER && (
                <Button asChild size="lg" variant="outline" className="rounded-full">
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hola G&M 👋 Quisiera cotizar un mueble a medida.")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" /> Escribir por WhatsApp
                  </a>
                </Button>
              )}
              <Button asChild size="lg" variant="ghost" className="rounded-full">
                <Link to="/catalogo">Ver el catálogo</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}