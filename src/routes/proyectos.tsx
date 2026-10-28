// src/routes/proyectos.tsx
// Proyectos: piezas especiales e innovaciones que fabricamos en G&M. Se cargan desde el panel (/gestionar-proyectos).
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Ruler, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useProyectos, type Proyecto } from "@/hooks/useProyectos";
import { trackEvent } from "@/hooks/useEventTracking";

export const Route = createFileRoute("/proyectos")({
  head: () => ({
    meta: [
      { title: "Proyectos — G&M Mueblería" },
      {
        name: "description",
        content: "Piezas especiales e ideas nuevas que fabricamos en nuestro taller de Lima.",
      },
      { property: "og:title", content: "Proyectos — G&M Mueblería" },
      { property: "og:description", content: "Lo que nace cuando una idea nueva llega al taller." },
    ],
  }),
  component: ProyectosPage,
});

/** Pide a Cloudinary una versión más liviana de la foto (si la URL es de Cloudinary). */
function liviana(url: string, w: number) {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/") || /\/upload\/[a-z]_/.test(url)) return url;
  return url.replace("/upload/", `/upload/w_${w},q_auto,f_auto/`);
}

function ProyectosPage() {
  const { data, isLoading } = useProyectos();
  const [sel, setSel] = useState<Proyecto | null>(null);
  const [foto, setFoto] = useState(0);
  const lista = data ?? [];

  useEffect(() => {
    trackEvent({ tipo: "pagina_vista", path: "/proyectos" });
  }, []);

  const abrir = (p: Proyecto) => {
    setSel(p);
    setFoto(0);
  };
  const mover = (d: number) => sel && setFoto((f) => (f + d + sel.fotos.length) % sel.fotos.length);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <section className="px-4 pb-8 pt-14 md:pt-20">
          <div className="container mx-auto max-w-6xl">
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-muted-foreground">Proyectos</p>
            <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight md:text-5xl">
              Lo que nace cuando una idea nueva llega al taller
            </h1>
            <p className="mt-5 max-w-xl text-muted-foreground">
              Piezas especiales, ideas distintas y soluciones que fabricamos a mano en Lima.
            </p>
          </div>
        </section>

        <section className="px-4 pb-20">
          <div className="container mx-auto max-w-6xl">
            {isLoading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="aspect-[4/3] w-full rounded-2xl" />
                ))}
              </div>
            ) : lista.length === 0 ? (
              <div className="rounded-3xl border border-border/60 bg-card px-6 py-16 text-center">
                <Sparkles className="mx-auto mb-4 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <h2 className="font-display text-2xl font-semibold">Muy pronto</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Estamos preparando la vitrina de nuestros proyectos. Mientras tanto, conoce el catálogo.
                </p>
                <Button asChild className="mt-6 rounded-full">
                  <Link to="/catalogo">Ver el catálogo</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {lista.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => abrir(p)}
                      className="group overflow-hidden rounded-2xl border border-border/60 bg-card text-left transition-shadow hover:shadow-[var(--shadow-soft)]"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                        <img
                          src={liviana(p.fotos[0], 800)}
                          alt={p.titulo}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                        {p.etiqueta && (
                          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-[11px] font-medium shadow-sm">
                            {p.etiqueta}
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="font-display text-xl font-semibold leading-tight">{p.titulo}</p>
                        {p.anio && <p className="mt-1 text-xs text-muted-foreground">{p.anio}</p>}
                        {p.descripcion && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.descripcion}</p>}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-12 rounded-3xl bg-secondary/50 px-6 py-12 text-center md:px-12">
                  <h2 className="font-display text-3xl font-semibold">¿Tienes una idea para tu espacio?</h2>
                  <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                    Cuéntanos qué necesitas y lo hacemos realidad a medida.
                  </p>
                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                    <Button asChild size="lg" className="rounded-full">
                      <Link to="/" hash="a-medida">
                        <Ruler className="mr-2 h-4 w-4" /> Pedir cotización
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="rounded-full">
                      <Link to="/catalogo">Ver el catálogo</Link>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-5xl gap-0 overflow-hidden p-0 sm:max-w-5xl">
          {sel && (
            <div className="grid max-h-[92vh] overflow-y-auto md:grid-cols-[1.3fr_1fr] md:overflow-hidden">
              <DialogTitle className="sr-only">{sel.titulo}</DialogTitle>
              <DialogDescription className="sr-only">Fotos y detalle del proyecto {sel.titulo}</DialogDescription>

              <div className="relative flex min-h-[280px] flex-col bg-black/90 md:min-h-[520px]">
                <div className="relative flex flex-1 items-center justify-center">
                  <img
                    src={liviana(sel.fotos[Math.min(foto, sel.fotos.length - 1)], 1400)}
                    alt={sel.titulo}
                    className="max-h-[70vh] w-full object-contain"
                  />
                  {sel.fotos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => mover(-1)}
                        aria-label="Foto anterior"
                        className="absolute left-3 grid h-10 w-10 place-items-center rounded-full bg-background/90 shadow transition-transform hover:scale-105"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => mover(1)}
                        aria-label="Foto siguiente"
                        className="absolute right-3 grid h-10 w-10 place-items-center rounded-full bg-background/90 shadow transition-transform hover:scale-105"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
                {sel.fotos.length > 1 && (
                  <div className="flex justify-center gap-2 p-3">
                    {sel.fotos.map((f, i) => (
                      <button
                        key={f + i}
                        type="button"
                        onClick={() => setFoto(i)}
                        aria-label={`Ver foto ${i + 1}`}
                        className={`h-12 w-12 overflow-hidden rounded-lg border-2 transition-opacity ${
                          i === foto ? "border-accent" : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img src={liviana(f, 120)} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 overflow-y-auto p-6 md:max-h-[92vh]">
                <div className="flex items-center gap-2">
                  {sel.etiqueta && (
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{sel.etiqueta}</span>
                  )}
                  {sel.anio && <span className="text-xs text-muted-foreground">{sel.anio}</span>}
                </div>
                <h3 className="font-display text-2xl font-semibold leading-tight">{sel.titulo}</h3>
                {sel.descripcion && (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{sel.descripcion}</p>
                )}
                <Button asChild className="mt-auto w-full rounded-full" onClick={() => setSel(null)}>
                  <Link to="/" hash="a-medida">
                    <Ruler className="mr-2 h-4 w-4" /> Quiero algo así
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}