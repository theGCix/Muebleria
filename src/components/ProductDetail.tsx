// src/components/ProductDetail.tsx
// G&M Mueblería — Bloque principal de detalle de producto
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/context/WishlistContext";
import { LoginModal } from "./LoginModal";
import { useCartStore } from "@/stores/cartStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShoppingCart, Heart, ChevronDown, Star,
  Package, Truck, Shield, Wrench,
} from "lucide-react";
import type { Product, ProductVariant } from "@/routes/product.$handle";

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

// ── Subcomponentes ────────────────────────────────────────────

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${
              i <= Math.round(rating)
                ? "fill-[var(--color-gold)] text-[var(--color-gold)]"
                : "text-border"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {rating.toFixed(1)} · {count} reseñas
      </span>
    </div>
  );
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-4 text-sm font-medium text-left hover:text-foreground/80 transition-colors"
      >
        {title}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-64 pb-4" : "max-h-0"
        }`}
      >
        <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export function ProductDetail({ product }: { product: Product }) {
  const [activeImg, setActiveImg] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants?.[0] ?? null
  );
  const { user } = useAuth();
  const { toggleWishlist, isWishlisted } = useWishlist();
  const [loginOpen, setLoginOpen] = useState(false);
  const [wishPending, setWishPending] = useState(false);
  const { addItem } = useCartStore();

  const wishlisted = isWishlisted(product.id);

  const price = selectedVariant?.price ?? product.price;
  const compareAt = product.compareAtPrice;
  const savings = compareAt ? compareAt - price : null;

  const handleAddToCart = () => {
    addItem({
      id: selectedVariant?.id ?? product.id,
      title: `${product.title}${selectedVariant ? ` — ${selectedVariant.title}` : ""}`,
      price,
      image: product.images[0]?.url ?? "",
      quantity: 1,
    });
    toast.success("Agregado al carrito", {
      description: product.title,
    });
  };

  return (
    <section className="container mx-auto px-4 md:px-12 pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">

        {/* ── GALERÍA ──────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Imagen principal */}
          <div className="relative overflow-hidden rounded-xl bg-[var(--color-cream)] aspect-square group cursor-zoom-in">
            <img
              src={product.images[activeImg]?.url}
              alt={product.images[activeImg]?.alt ?? product.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <Badge
              className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm text-[var(--color-walnut-mid)] border-[var(--color-gold-light)] text-[10px] tracking-widest uppercase rounded-full px-3"
            >
              {product.category}
            </Badge>
            {savings && savings > 0 && (
              <Badge className="absolute top-4 right-4 bg-[var(--color-walnut)] text-white text-[10px] tracking-wider uppercase rounded-full px-3 border-0">
                Nuevo
              </Badge>
            )}
          </div>

          {/* Miniaturas */}
          {product.images.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`flex-shrink-0 w-[72px] h-[72px] rounded-md overflow-hidden border-2 transition-all duration-200 ${
                    i === activeImg
                      ? "border-[var(--color-walnut)]"
                      : "border-transparent hover:border-[var(--color-gold-light)]"
                  }`}
                >
                  <img
                    src={img.url}
                    alt={img.alt ?? `Vista ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── INFO ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">

          {/* Encabezado */}
          <div>
            <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground mb-2">
              SKU: {product.sku}
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-normal leading-tight text-foreground mb-2">
              {product.title}
            </h1>
            {product.subtitle && (
              <p className="text-sm text-muted-foreground tracking-wide">
                {product.subtitle}
              </p>
            )}
          </div>

          {/* Rating */}
          {product.rating && product.reviewCount && (
            <StarRating rating={product.rating} count={product.reviewCount} />
          )}

          {/* Precio */}
          <div>
            <div className="flex items-baseline gap-3 mb-1">
              <span className="font-display text-3xl text-[var(--color-walnut)]">
                {fmt(price)}
              </span>
              {compareAt && (
                <span className="text-lg text-muted-foreground line-through">
                  {fmt(compareAt)}
                </span>
              )}
              {savings && savings > 0 && (
                <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full">
                  Ahorras {fmt(savings)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Precio incluye IGV · Entrega a domicilio disponible
            </p>
          </div>

          <div className="h-px bg-border/40" />

          {/* Specs pills */}
          {Object.keys(product.specs).length > 0 && (
            <div>
              <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground mb-3">
                Materiales y construcción
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {Object.entries(product.specs).map(([key, val]) => (
                  <div
                    key={key}
                    className="bg-[var(--color-cream)] rounded-sm px-3.5 py-3 border border-transparent hover:border-[var(--color-gold-light)] transition-colors"
                  >
                    <p className="text-[10px] tracking-[0.1em] uppercase text-muted-foreground mb-0.5">
                      {key}
                    </p>
                    <p className="text-[13px] font-medium text-foreground leading-snug">
                      {val}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selector de color/variante */}
          {product.variants?.length > 0 && (
            <div>
              <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground mb-3">
                Color —{" "}
                <span className="text-foreground font-medium normal-case tracking-normal">
                  {selectedVariant?.title}
                </span>
              </p>
              <div className="flex gap-2.5 flex-wrap">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    title={v.title}
                    disabled={!v.available}
                    className={`w-8 h-8 rounded-full border-[3px] transition-all duration-200 disabled:opacity-40 ${
                      selectedVariant?.id === v.id
                        ? "border-[var(--color-walnut)] scale-110"
                        : "border-transparent hover:scale-110"
                    }`}
                    style={{ backgroundColor: v.color ?? "#ccc" }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Incluye */}
          {product.includes?.length > 0 && (
            <div>
              <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground mb-3">
                Incluye en el juego
              </p>
              <div className="flex flex-wrap gap-2">
                {product.includes.map((item) => (
                  <span
                    key={item}
                    className="flex items-center gap-1.5 text-xs text-foreground/70 bg-[var(--color-cream)] border border-border/40 px-3 py-1.5 rounded-full"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] flex-shrink-0" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CTAs */}
          <div className="flex gap-3">
            <Button
              className="flex-1 h-13 bg-[var(--color-walnut)] hover:bg-[var(--color-walnut-mid)] text-white rounded-sm tracking-wide text-sm transition-all"
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Agregar al carrito
            </Button>
            <button
              type="button"
              disabled={wishPending}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!user) { setLoginOpen(true); return; }
                setWishPending(true);
                const added = await toggleWishlist(product.id);
                toast.success(added ? `"${product.title}" guardado en favoritos` : `"${product.title}" eliminado de favoritos`);
                setWishPending(false);
              }}
              className={`w-13 h-13 border rounded-sm flex items-center justify-center transition-all disabled:opacity-50 ${
                wishlisted
                  ? "border-[var(--color-gold)] text-[var(--color-gold)]"
                  : "border-border/60 text-muted-foreground hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
              }`}
              title={wishlisted ? "Quitar de favoritos" : "Guardar en favoritos"}
            >
              <Heart className={`h-5 w-5 ${wishlisted ? "fill-current" : ""}`} />
            </button>
            <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
          </div>
          <Button
            variant="outline"
            className="w-full rounded-sm border-[var(--color-walnut)] text-[var(--color-walnut)] hover:bg-[var(--color-cream)] tracking-wide text-sm"
          >
            Solicitar cotización personalizada
          </Button>

          {/* Trust strip */}
          <div className="grid grid-cols-3 divide-x divide-border/40 border border-border/40 rounded-sm overflow-hidden">
            {[
              { icon: <Wrench className="h-4 w-4" />, label: "Hecho a mano" },
              { icon: <Shield className="h-4 w-4" />, label: "Garantía 2 años" },
              { icon: <Truck className="h-4 w-4" />, label: "Envío a domicilio" },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2 px-3 py-3 text-xs text-foreground/60">
                <span className="text-[var(--color-gold)]">{icon}</span>
                {label}
              </div>
            ))}
          </div>

          {/* Acordeón */}
          <div className="border-t border-border/40 pt-2">
            <Accordion title="Cuidado y mantenimiento">
              Limpie con paño húmedo sin químicos agresivos. Evite exposición directa al sol.
              Para el velvet, use un cepillo suave en dirección del pelo del tejido.
              La estructura de madera puede aceitarse anualmente para mantener su durabilidad.
            </Accordion>
            <Accordion title="Tiempos de entrega">
              Lima Metropolitana: 5–7 días hábiles. Provincias: 10–15 días hábiles.
              Este modelo es fabricado a pedido — se coordina fecha de entrega al confirmar la compra.
            </Accordion>
            <Accordion title="Política de devoluciones">
              Al ser un producto fabricado a medida, no se aceptan cambios una vez confirmado el pedido.
              En caso de defecto de fabricación, realizamos la reparación o reposición sin costo dentro del período de garantía.
            </Accordion>
          </div>
        </div>
      </div>

      {/* ── TABS: Especificaciones / Reseñas / Entrega ───── */}
      <ProductTabs product={product} />
    </section>
  );
}

// ── Tabs ─────────────────────────────────────────────────────
function ProductTabs({ product }: { product: Product }) {
  const [tab, setTab] = useState<"specs" | "reviews" | "delivery">("specs");

  const tabs = [
    { id: "specs" as const, label: "Especificaciones" },
    { id: "reviews" as const, label: `Reseñas (${product.reviewCount ?? 0})` },
    { id: "delivery" as const, label: "Entrega y pagos" },
  ];

  return (
    <div className="mt-20">
      {/* Tab list */}
      <div className="flex border-b border-border/40 mb-10">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-6 py-3.5 text-[13px] tracking-wider uppercase relative transition-colors ${
              tab === t.id
                ? "text-[var(--color-walnut)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[var(--color-walnut)]" />
            )}
          </button>
        ))}
      </div>

      {/* Specs */}
      {tab === "specs" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h3 className="font-display text-xl font-normal text-[var(--color-walnut)] mb-5">
              Ficha técnica
            </h3>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(product.specs).map(([k, v]) => (
                  <tr key={k} className="border-b border-border/30">
                    <td className="py-2.5 text-muted-foreground w-[44%]">{k}</td>
                    <td className="py-2.5 font-medium text-foreground">{v}</td>
                  </tr>
                ))}
                <tr className="border-b border-border/30">
                  <td className="py-2.5 text-muted-foreground">SKU</td>
                  <td className="py-2.5 font-medium">{product.sku}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {product.includes?.length > 0 && (
            <div>
              <h3 className="font-display text-xl font-normal text-[var(--color-walnut)] mb-5">
                El juego incluye
              </h3>
              <ul className="space-y-0">
                {product.includes.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 py-2.5 border-b border-border/30 text-sm text-foreground/70"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Reviews — placeholder con reseñas de ejemplo */}
      {tab === "reviews" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { name: "María C.", location: "Lima", rating: 5, text: "Hermoso juego de sala, los cojines y el tapizado son de excelente calidad. La entrega fue puntual y el armado muy prolijo." },
            { name: "Pamela R.", location: "San Isidro", rating: 4, text: "El diseño es precioso y combina perfecto con mi sala. Solo le bajo una estrella porque tardó un poco más de lo esperado en llegar." },
            { name: "Lucía B.", location: "Miraflores", rating: 5, text: "El puff es divino y los cojines llegan incluidos tal como dice. Muy buena relación calidad-precio para ser hecho a mano en Perú." },
          ].map((r) => (
            <div
              key={r.name}
              className="bg-[var(--color-cream)] rounded-xl p-6 border border-border/30"
            >
              <div className="flex gap-0.5 mb-3">
                {[1,2,3,4,5].map((i) => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i <= r.rating ? "fill-[var(--color-gold)] text-[var(--color-gold)]" : "text-border"}`} />
                ))}
              </div>
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">"{r.text}"</p>
              <p className="text-xs text-muted-foreground">— {r.name} · {r.location}</p>
            </div>
          ))}
        </div>
      )}

      {/* Delivery */}
      {tab === "delivery" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h3 className="font-display text-xl font-normal text-[var(--color-walnut)] mb-5">Métodos de pago</h3>
            <ul className="space-y-0">
              {["Transferencia bancaria (BCP, Interbank, BBVA)", "Tarjeta de crédito / débito vía Niubiz", "Yape o Plin", "Pago en 3 o 6 cuotas sin intereses", "Efectivo en tienda física"].map(m => (
                <li key={m} className="flex items-center gap-3 py-2.5 border-b border-border/30 text-sm text-foreground/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] flex-shrink-0" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-display text-xl font-normal text-[var(--color-walnut)] mb-5">Cobertura de entrega</h3>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["Lima Metropolitana", "5–7 días hábiles"],
                  ["Provincias", "10–15 días hábiles"],
                  ["Armado e instalación", "Incluido en Lima"],
                  ["Envío Lima", "Gratis (pedidos +S/ 800)"],
                  ["Seguimiento", "WhatsApp en tiempo real"],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-border/30">
                    <td className="py-2.5 text-muted-foreground w-[54%]">{k}</td>
                    <td className="py-2.5 font-medium">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}