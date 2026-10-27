// src/routes/proyectos.tsx
// Galería "Proyectos realizados": muebles G&M ya entregados, con las fotos reales de los clientes.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, ChevronLeft, ChevronRight, Images, Ruler, Star } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { MIN_PROYECTOS, useProyectos, type Proyecto } from "@/hooks/useProyectos";
import { getCategoria } from "@/lib/categories";
import { trackEvent } from "@/hooks/useEventTracking";

export const Route = createFileRoute("/proyectos")({
  head: () => ({
    meta: [
      { title: "Proyectos realizados — G&M Mueblería" },
      {
        name: "description",
        content: "Muebles G&M ya entregados, en las casas de nuestros clientes. Fotos reales enviadas por ellos.",
      },
      { property: "og:title", content: "Proyectos realizados — G&M Mueblería" },
      { property: "og:description", content: "Así se ven nuestros muebles en casa de quienes ya los tienen." },
    ],
  }),
  component: ProyectosPage,
});

const fechaCorta = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(new Date(iso));

// Formas variadas para que la cuadrícula se sienta como un álbum y no como una tabla
const FORMAS = ["aspect-[4/5]", "aspect-square", "aspect-[4/3]", "aspect-[3/4]"];

/** Pide a Cloudinary una versión más liviana de la foto (si la URL es de Cloudinary). */
function liviana(url: string, w: number) {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/") || /\/upload\/[a-z]_/.test(url)) return url;
  return url.replace("/upload/", `/upload/w_${w},q_auto,f_auto/`);
}

function Estrellas({ valor, size = 14 }: { valor: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${valor.toFixed(1)} de 5 estrellas`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={i < Math.round(valor) ? "fill-[var(--color-gold)] text-[var(--color-gold)]" : "text-border"}
        />
      ))}
    </span>
  );
}

function ProyectosPage() {
  const { data, isLoading } = useProyectos();
  const [cat, setCat] = useState<string | null>(null);
  const [sel, setSel] = useState<{ i: number; foto: number } | null>(null);

  useEffect(() => {
    trackEvent({ tipo: "pagina_vista", path: "/proyectos" });
  }, []);

  const todos = data ?? [];
  const categorias = useMemo(
    () => [...new Set(todos.map((p) => p.categoria).filter((c): c is string => !!c))],
    [todos],
  );
  const lista = useMemo(() => (cat ? todos.filter((p) => p.categoria === cat) : todos), [todos, cat]);
  const hayGaleria = todos.length >= MIN_PROYECTOS;
  const actual = sel ? lista[sel.i] : null;

  const mover = (d: number) =>
    setSel((s) => (s && lista.length ? { i: (s.i + d + lista.length) % lista.length, foto: 0 } : s));

  // Flechas del teclado dentro del visor (Esc ya lo maneja el diálogo)
  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <section className="px-4 pb-8 pt-14 md:pt-20">
          <div className="container mx-auto max-w-6xl">
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-muted-foreground">Proyectos realizados</p>
            <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight md:text-5xl">
              Así se ven nuestros muebles en casa de quienes ya los tienen
            </h1>
            <p className="mt-5 max-w-xl text-muted-foreground">
              Fotos reales que nuestros clientes nos envían después de recibir su pieza.
            </p>
          </div>
        </section>

        <section className="px-4 pb-20">
          <div className="container mx-auto max-w-6xl">
            {isLoading ? (
              <div className="columns-2 gap-4 md:columns-3">
                {FORMAS.concat(FORMAS).map((f, i) => (
                  <Skeleton key={i} className={`mb-4 w-full rounded-2xl ${f}`} />
                ))}
              </div>
            ) : !hayGaleria ? (
              <div className="rounded-3xl border border-border/60 bg-card px-6 py-16 text-center">
                <Images className="mx-auto mb-4 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <h2 className="font-display text-2xl font-semibold">Estamos reuniendo las fotos de nuestros clientes</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Muy pronto verás aquí muebles G&amp;M en casas reales. Mientras tanto, conoce el catálogo.
                </p>
                <Button asChild className="mt-6 rounded-full">
                  <Link to="/catalogo">Ver el catálogo</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  {categorias.length > 1 && (
                    <>
                      <FiltroChip activo={cat === null} onClick={() => setCat(null)}>Todos</FiltroChip>
                      {categorias.map((c) => (
                        <FiltroChip key={c} activo={cat === c} onClick={() => setCat(c)}>
                          {getCategoria(c)?.nombre ?? c}
                        </FiltroChip>
                      ))}
                    </>
                  )}
                  <span className="ml-auto text-sm text-muted-foreground">
                    {lista.length} {lista.length === 1 ? "proyecto" : "proyectos"}
                  </span>
                </div>

                <div className="columns-2 gap-4 md:columns-3">
                  {lista.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSel({ i, foto: 0 })}
                      className="group mb-4 block w-full break-inside-avoid overflow-hidden rounded-2xl border border-border/60 bg-card text-left transition-shadow hover:shadow-[var(--shadow-soft)]"
                    >
                      <div className={`relative overflow-hidden bg-muted ${FORMAS[i % FORMAS.length]}`}>
                        <img
                          src={liviana(p.fotos[0], 700)}
                          alt={`${p.producto_nombre ?? "Mueble"} en casa de ${p.autor_nombre}`}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                        {p.fotos.length > 1 && (
                          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[11px] font-medium shadow-sm">
                            <Images className="h-3 w-3" aria-hidden="true" /> {p.fotos.length}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        {p.calificacion > 0 && <Estrellas valor={p.calificacion} size={12} />}
                        <p className="mt-1.5 line-clamp-1 text-sm font-medium">{p.producto_nombre ?? "Mueble G&M"}</p>
                        <p className="text-xs text-muted-foreground">{p.autor_nombre}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-12 rounded-3xl bg-secondary/50 px-6 py-12 text-center md:px-12">
                  <h2 className="font-display text-3xl font-semibold">¿Quieres el tuyo?</h2>
                  <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                    Elige del catálogo o cuéntanos qué necesitas y te cotizamos tu pieza a medida.
                  </p>
                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                    <Button asChild size="lg" className="rounded-full">
                      <Link to="/catalogo">Ver el catálogo</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="rounded-full">
                      <Link to="/" hash="a-medida">
                        <Ruler className="mr-2 h-4 w-4" /> Pedir cotización
                      </Link>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />

      <Visor
        proyecto={actual}
        foto={sel?.foto ?? 0}
        total={lista.length}
        onFoto={(f) => setSel((s) => (s ? { ...s, foto: f } : s))}
        onMover={mover}
        onClose={() => setSel(null)}
      />
    </div>
  );
}

function FiltroChip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
        activo
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-card text-foreground/70 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Visor({
  proyecto: p,
  foto,
  total,
  onFoto,
  onMover,
  onClose,
}: {
  proyecto: Proyecto | null;
  foto: number;
  total: number;
  onFoto: (i: number) => void;
  onMover: (d: number) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-5xl gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {p && (
          <div className="grid max-h-[92vh] overflow-y-auto md:grid-cols-[1.3fr_1fr] md:overflow-hidden">
            <DialogTitle className="sr-only">{p.producto_nombre ?? "Proyecto realizado"}</DialogTitle>
            <DialogDescription className="sr-only">Foto y reseña de {p.autor_nombre}</DialogDescription>

            <div className="relative flex min-h-[280px] flex-col bg-black/90 md:min-h-[520px]">
              <div className="relative flex flex-1 items-center justify-center">
                <img
                  src={liviana(p.fotos[Math.min(foto, p.fotos.length - 1)], 1400)}
                  alt={`${p.producto_nombre ?? "Mueble"} en casa de ${p.autor_nombre}`}
                  className="max-h-[70vh] w-full object-contain"
                />
                {total > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => onMover(-1)}
                      aria-label="Proyecto anterior"
                      className="absolute left-3 grid h-10 w-10 place-items-center rounded-full bg-background/90 shadow transition-transform hover:scale-105"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMover(1)}
                      aria-label="Proyecto siguiente"
                      className="absolute right-3 grid h-10 w-10 place-items-center rounded-full bg-background/90 shadow transition-transform hover:scale-105"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
              {p.fotos.length > 1 && (
                <div className="flex justify-center gap-2 p-3">
                  {p.fotos.map((f, i) => (
                    <button
                      key={f + i}
                      type="button"
                      onClick={() => onFoto(i)}
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
              <div className="flex items-center justify-between gap-3">
                {p.calificacion > 0 ? <Estrellas valor={p.calificacion} size={16} /> : <span />}
                {p.origen === "resena" && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <BadgeCheck className="h-3.5 w-3.5" /> Compra verificada
                  </span>
                )}
              </div>
              {p.titulo && <h3 className="font-display text-2xl font-semibold leading-tight">{p.titulo}</h3>}
              {p.comentario && (
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{p.comentario}</p>
              )}
              {p.respuesta_tienda && (
                <div className="rounded-xl bg-secondary/60 p-4 text-sm">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-accent">Respuesta de G&amp;M</p>
                  <p className="whitespace-pre-line text-muted-foreground">{p.respuesta_tienda}</p>
                </div>
              )}
              <div className="mt-auto border-t border-border/50 pt-4">
                <p className="text-sm font-medium">{p.autor_nombre}</p>
                <p className="text-xs text-muted-foreground first-letter:uppercase">{fechaCorta(p.created_at)}</p>
                {p.producto_nombre && p.product_id && (
                  <Button asChild variant="outline" className="mt-4 w-full rounded-full" onClick={onClose}>
                    <Link to="/product/$handle" params={{ handle: p.product_id }}>
                      Ver {p.producto_nombre}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}