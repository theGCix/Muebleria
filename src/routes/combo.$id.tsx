// src/routes/combo.$id.tsx
import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useCombo, precioNormalCombo } from "@/hooks/useCombos";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Loader2, ShoppingBag, PackageCheck, Image as ImageIcon, ArrowLeft } from "lucide-react";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fmtPEN } from "@/lib/pricing";
import { useCartStore } from "@/stores/cartStore";
import { trackEvent } from "@/hooks/useEventTracking";
import { toast } from "sonner";

export const Route = createFileRoute("/combo/$id")({
  head: ({ params }) => ({ meta: [{ title: `Combo — G&M Mueblería` }] }),
  component: ComboPage,
});

function ComboPage() {
  const { id } = Route.useParams();
  const { data: combo, isLoading, isError } = useCombo(id);
  const addItems = useCartStore((s) => s.addItems);
  const items = useCartStore((s) => s.items);
  const [adding, setAdding] = useState(false);
  const [activeThumb, setActiveThumb] = useState(0);

  useEffect(() => {
    if (combo) trackEvent({ tipo: "producto_visto", path: `/combo/${combo.id}` });
  }, [combo]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  if (isError || !combo) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4 py-24">
          <div className="text-center max-w-md">
            <h1 className="font-display text-3xl mb-2">Combo no encontrado</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Puede que este combo ya no esté disponible.
            </p>
            <Button asChild className="rounded-full">
              <Link to="/">Volver al inicio</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const precioNormal = precioNormalCombo(combo);
  const ahorro = precioNormal - combo.precio_combo;
  const factor = precioNormal > 0 ? combo.precio_combo / precioNormal : 1;
  const agotado = combo.combo_items.some((it) => (it.products.stock ?? 1) <= 0);
  const yaEnCarrito = combo.combo_items.every((it) =>
    items.some((c) => c.id === it.product_id && c.comboId === combo.id)
  );

  const galeria = combo.imagen_public_id || combo.imagen_url
    ? [combo.imagen_public_id ? cloudinaryUrl(combo.imagen_public_id, { w: 800, h: 600 }) : combo.imagen_url!]
    : combo.combo_items.map((it) =>
        it.products.imagen_public_id
          ? cloudinaryUrl(it.products.imagen_public_id, { w: 800, h: 600 })
          : it.products.imagen_url
      ).filter((s): s is string => !!s);

  const handleAdd = () => {
    setAdding(true);
    const nuevos = combo.combo_items.map((it) => ({
      id: it.product_id,
      title: it.products.nombre,
      price: Math.round(it.products.precio * factor * 100) / 100,
      image: it.products.imagen_public_id
        ? cloudinaryUrl(it.products.imagen_public_id, { w: 400, h: 300 })
        : it.products.imagen_url ?? "",
      sku: it.products.sku ?? undefined,
      qty: it.cantidad,
      comboId: combo.id,
      comboLabel: combo.nombre,
    }));
    addItems(nuevos);
    toast.success(`Combo "${combo.nombre}" agregado al carrito`);
    setTimeout(() => setAdding(false), 1200);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto max-w-7xl px-4 pt-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link to="/">Inicio</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link to="/" hash="combos">Combos</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>{combo.nombre}</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Link
            to="/"
            hash="combos"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mt-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a combos
          </Link>
        </div>

        <div className="container mx-auto max-w-7xl px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* ── Galería ── */}
          <div>
            <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted relative border border-border/50">
              <span className="absolute top-3 left-3 z-10 rounded-full bg-accent text-accent-foreground text-xs font-bold px-2.5 py-1 shadow-sm flex items-center gap-1">
                <PackageCheck className="h-3 w-3" /> Combo
              </span>
              {galeria[activeThumb] ? (
                <img src={galeria[activeThumb]} alt={combo.nombre} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-16 w-16" />
                </div>
              )}
            </div>
            {galeria.length > 1 && (
              <div className="flex gap-2 mt-3">
                {galeria.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveThumb(i)}
                    className={`h-16 w-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      activeThumb === i ? "border-accent" : "border-transparent"
                    }`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Info ── */}
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold">{combo.nombre}</h1>
            {combo.descripcion && (
              <p className="text-muted-foreground mt-3">{combo.descripcion}</p>
            )}

            <div className="mt-5 flex items-baseline gap-3 flex-wrap">
              <span className="font-display font-bold text-3xl text-accent">{fmtPEN(combo.precio_combo)}</span>
              <span className="text-lg text-muted-foreground line-through">{fmtPEN(precioNormal)}</span>
            </div>
            {ahorro > 0 && (
              <span className="inline-block mt-2 text-sm font-medium bg-accent/10 text-accent rounded-full px-3 py-1">
                Ahorras {fmtPEN(ahorro)}
              </span>
            )}

            <Button
              size="lg"
              onClick={handleAdd}
              disabled={adding || agotado || yaEnCarrito}
              className="rounded-full w-full mt-6"
            >
              {agotado ? (
                "Un producto del combo está agotado"
              ) : yaEnCarrito ? (
                "Combo en el carrito"
              ) : (
                <><ShoppingBag className="h-4 w-4 mr-2" /> Agregar combo al carrito</>
              )}
            </Button>

            {/* ── Productos incluidos ── */}
            <div className="mt-8 pt-6 border-t border-border/50">
              <h2 className="font-semibold mb-4">Este combo incluye</h2>
              <div className="space-y-3">
                {combo.combo_items.map((it) => {
                  const thumb = it.products.imagen_public_id
                    ? cloudinaryUrl(it.products.imagen_public_id, { w: 120, h: 120 })
                    : it.products.imagen_url;
                  return (
                    <Link
                      key={it.id}
                      to="/product/$handle"
                      params={{ handle: it.product_id }}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {thumb ? (
                          <img src={thumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{it.products.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {it.cantidad > 1 ? `${it.cantidad} unidades · ` : ""}{fmtPEN(it.products.precio)} c/u
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}