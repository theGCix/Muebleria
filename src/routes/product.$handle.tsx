import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/context/WishlistContext";
import { LoginModal } from "@/components/LoginModal";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useProduct, useProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Loader2, Camera, Heart, ShoppingBag, Check, ChevronLeft, ChevronRight, Shield, Truck, Hammer, Star, MessageCircle, Share2 } from "lucide-react";
import { calcLineId, useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { avisoCarrito } from "@/lib/avisoCarrito";
import { avisoFavorito } from "@/lib/avisoFavorito";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { trackEvent } from "@/hooks/useEventTracking";
import { useSeo, absolutizar, migasJsonLd } from "@/lib/seo";
import { trackLead, trackShare } from "@/lib/analytics";
import { urlCompartir } from "@/lib/share";
import { getCategoria } from "@/lib/categories";
import { ProductRecomendaciones } from "@/components/ProductRecomendaciones";
import { ModelViewer3D } from "@/components/ModelViewer3D";
import { ofertaInfo } from "@/lib/pricing";
import { textoPlazoLima, textoPlazoProvincias } from "@/lib/entrega";
import { LeadFormDialog } from "@/components/LeadFormDialog";
import { WHATSAPP_NUMBER } from "@/config";
import { resolveProfile, type ProductProfile } from "@/lib/productProfiles";
import { LivePrice } from "@/components/product/LivePrice";
import { DeliveryPromise } from "@/components/product/DeliveryPromise";
import { SignatureModule } from "@/components/product/SignatureModules";
import { OpcionesProducto } from "@/components/product/OpcionesProducto";
import { useOpcionesProducto, resolverSeleccion, type SeleccionOpciones, type OpcionGrupo, type OpcionValor } from "@/hooks/useOpcionesProducto";
import { BundleBuilder } from "@/components/product/BundleBuilder";
import { StickyBuyBar, SeguirComprandoLink } from "@/components/product/StickyBuyBar";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductBreadcrumb } from "@/components/product/ProductBreadcrumb";
import { MedidasPiezas } from "@/components/product/MedidasPiezas";
import type { AcabadoEspacio } from "@/components/product/ProbarEnTuEspacio";

// «Pruébalo en tu espacio» se descarga solo cuando el cliente lo abre
const ProbarEnTuEspacio = lazy(() =>
  import("@/components/product/ProbarEnTuEspacio").then((m) => ({ default: m.ProbarEnTuEspacio })),
);
import { piezasDeProducto } from "@/lib/piezas";
import "@/components/product/product-experience.css";
import { fetchProductReviews, fetchProductRating } from "@/lib/resenas.functions";

export const Route = createFileRoute("/product/$handle")({
  component: ProductPage,
  errorComponent: ({ error, reset }) => <ProductError error={error} reset={reset} />,
  notFoundComponent: () => <ProductNotFound />,
});

/* ─── helpers ─────────────────────────────────────── */
const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

/* ─── sub-pages ───────────────────────────────────── */
function ProductError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="font-display text-3xl mb-2">Error al cargar</h1>
        <p className="text-sm text-muted-foreground mb-6">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="gm-btn-primary"
        >Reintentar</button>
      </div>
    </div>
  );
}

function ProductNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-display text-3xl mb-2">Producto no encontrado</h1>
        <Link to="/" className="gm-btn-primary inline-block mt-4">Volver al inicio</Link>
      </div>
    </div>
  );
}

/* ─── accordion item ──────────────────────────────── */
function AccordionItem({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="gm-accordion-item">
      <button className="gm-accordion-btn" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span style={{ transition: "transform .3s", transform: open ? "rotate(45deg)" : "none", fontSize: 22, color: "var(--gm-muted)" }}>+</span>
      </button>
      <div style={{ maxHeight: open ? 300 : 0, overflow: "hidden", transition: "max-height .35s ease" }}>
        <div className="gm-accordion-body">{children}</div>
      </div>
    </div>
  );
}

/* ─── tab panel ───────────────────────────────────── */
const TABS = ["Especificaciones", "Reseñas", "Entrega y pagos"] as const;

/* M1b: lista de pestañas con indicador (degradado + flecha) cuando hay más pestañas fuera de pantalla */
function TabList({ active, onChange }: { active: number; onChange: (i: number) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const primera = useRef(true);
  const [hay, setHay] = useState({ izq: false, der: false });

  const medir = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setHay({ izq: el.scrollLeft > 2, der: el.scrollLeft < max - 2 });
  }, []);

  useEffect(() => {
    medir();
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [medir]);

  // Al cambiar de pestaña, se centra la activa dentro de la lista (sin mover la página)
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    const el = listRef.current;
    const btn = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !btn) return;
    el.scrollTo({ left: btn.offsetLeft - (el.clientWidth - btn.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  return (
    <div className="gm-tab-wrap">
      <div className="gm-tab-list" role="tablist" aria-label="Información del producto" ref={listRef} onScroll={medir}>
        {TABS.map((t, i) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`gm-tab-${i}`}
            aria-selected={active === i}
            aria-controls="gm-tabpanel"
            className={`gm-tab-btn${active === i ? " active" : ""}`}
            onClick={() => onChange(i)}
          >
            {t}
          </button>
        ))}
      </div>
      <span className={`gm-tab-more izq${hay.izq ? " on" : ""}`} aria-hidden><ChevronLeft size={16} /></span>
      <span className={`gm-tab-more der${hay.der ? " on" : ""}`} aria-hidden><ChevronRight size={16} /></span>
    </div>
  );
}

function Tabs({ product, profile }: { product: ReturnType<typeof useProduct>["data"]; profile: ProductProfile }) {
  const [active, setActive] = useState(0);

  const specs: [string, string][] = [
    ["Modelo", product?.nombre ?? "—"],
    ["Categoría", product?.categoria ?? "—"],
    ...(product?.subcategoria ? [["Subcategoría", product.subcategoria] as [string, string]] : []),
    ...(product?.material_base ? [["Base", product.material_base] as [string, string]] : []),
    ["SKU", product?.sku ?? "—"],
    ["Fabricación", "A pedido, en Lima"],
    ["Garantía", "2 años en estructura"],
  ];

  // D7: piezas con medidas/plazas y esquema (columnas opcionales de products)
  const medidas = useMemo(() => piezasDeProducto(product), [product]);

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ["resenas-producto", product?.id],
    queryFn: () => fetchProductReviews(product!.id),
    enabled: !!product?.id,
    staleTime: 60_000,
  });
  const { data: ratingData } = useQuery({
    queryKey: ["rating-producto", product?.id],
    queryFn: () => fetchProductRating(product!.id),
    enabled: !!product?.id,
    staleTime: 60_000,
  });
  const reviews = reviewsData?.resenas ?? [];
  const rating = ratingData?.rating ?? null;
  const ratingBars = rating
    ? [
        [5, rating.cinco_estrellas],
        [4, rating.cuatro_estrellas],
        [3, rating.tres_estrellas],
        [2, rating.dos_estrellas],
        [1, rating.una_estrella],
      ] as const
    : [];

  return (
    <div className="gm-tabs-section">
      <div className="gm-container">
        <TabList active={active} onChange={setActive} />

        <div id="gm-tabpanel" role="tabpanel" aria-labelledby={`gm-tab-${active}`}>
        {active === 0 && (
          <div className="gm-details-grid">
            <div>
              <h3 className="gm-section-h3">Ficha técnica</h3>
              <table className="gm-detail-table">
                <tbody>
                  {specs.map(([k, v]) => (
                    <tr key={k}>
                      <td className="gm-dt-label">{k}</td>
                      <td className="gm-dt-val">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="gm-section-h3">Características</h3>
              <ul className="gm-detail-list">
                {profile.features.map(item => (
                  <li key={item} className="gm-dl-item">
                    <span className="gm-dl-dot" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <MedidasPiezas piezas={medidas.piezas} esquemaUrl={medidas.esquemaUrl} producto={product?.nombre ?? ""} />
          </div>
        )}

        {active === 1 && (
          <div>
            {rating && rating.total_resenas > 0 && (
              <div className="gm-rating-summary">
                <div className="gm-rating-avg">
                  <div className="gm-rating-avg-num">{rating.calificacion_promedio.toFixed(1)}</div>
                  <div className="gm-stars-row" style={{ justifyContent: "center", margin: "6px 0" }}>
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={15} fill={i < Math.round(rating.calificacion_promedio) ? "var(--gm-gold)" : "none"} color={i < Math.round(rating.calificacion_promedio) ? "var(--gm-gold)" : "var(--gm-border)"} />
                    ))}
                  </div>
                  <div className="gm-rating-count">{rating.total_resenas} reseña{rating.total_resenas === 1 ? "" : "s"}</div>
                </div>
                <div className="gm-rating-bars">
                  {ratingBars.map(([stars, count]) => {
                    const pct = rating.total_resenas > 0 ? Math.round((count / rating.total_resenas) * 100) : 0;
                    return (
                      <div key={stars} className="gm-rating-bar-row">
                        <span>{stars}★</span>
                        <div className="gm-rating-bar-track"><div className="gm-rating-bar-fill" style={{ width: `${pct}%` }} /></div>
                        <span className="gm-rating-bar-count">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {reviewsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                <Loader2 className="animate-spin" size={20} color="var(--gm-muted)" />
              </div>
            ) : reviews.length === 0 ? (
              <p style={{ textAlign: "center", padding: "32px 0", color: "var(--gm-muted)", fontSize: 14 }}>
                Este producto aún no tiene reseñas. ¡Sé el primero en comprarlo y contarnos qué te pareció!
              </p>
            ) : (
              <div className="gm-reviews-grid">
                {reviews.map(r => (
                  <div key={r.id} className="gm-review-card">
                    <div className="gm-stars-row">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={13} fill={i < r.calificacion ? "var(--gm-gold)" : "none"} color={i < r.calificacion ? "var(--gm-gold)" : "var(--gm-border)"} />
                      ))}
                    </div>
                    {r.titulo && <div className="gm-review-title">{r.titulo}</div>}
                    {r.comentario && <p className="gm-review-text">"{r.comentario}"</p>}
                    {r.fotos?.length > 0 && (
                      <div className="gm-review-photos">
                        {r.fotos.slice(0, 4).map((url, i) => (
                          <img key={i} src={url} alt="Foto enviada por el cliente" className="gm-review-photo" />
                        ))}
                      </div>
                    )}
                    <div className="gm-review-author">— {r.autor_nombre}</div>
                    {r.respuesta_tienda && (
                      <div className="gm-review-reply">
                        <span>Respuesta de la tienda:</span> {r.respuesta_tienda}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {active === 2 && (
          <div className="gm-details-grid">
            <div>
              <h3 className="gm-section-h3">Métodos de pago</h3>
              <ul className="gm-detail-list">
                {["Transferencia bancaria (BCP, Interbank, BBVA)", "Tarjeta de crédito / débito vía Niubiz", "Yape o Plin", "Pago en 3 o 6 cuotas sin intereses", "Efectivo en tienda física"].map(item => (
                  <li key={item} className="gm-dl-item"><span className="gm-dl-dot" />{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="gm-section-h3">Cobertura de entrega</h3>
              <table className="gm-detail-table">
                <tbody>
                  {[
                    ["Lima Metropolitana", textoPlazoLima()],
                    ["Provincias", textoPlazoProvincias()],
                    ["Armado e instalación", "Incluido en Lima"],
                    ["Envío Lima", "Gratis en pedidos +S/ 800"],
                    ["Seguimiento", "WhatsApp en tiempo real"],
                  ].map(([k, v]) => (
                    <tr key={k}><td className="gm-dt-label">{k}</td><td className="gm-dt-val">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}


const PAGE_CSS = `
        :root {
          --gm-cream: var(--muted);
          --gm-warm: var(--card);
          --gm-walnut: var(--primary);
          --gm-walnut-mid: var(--primary);
          --gm-gold: var(--detail);
          --gm-gold-light: var(--secondary);
          --gm-blush: var(--secondary);
          --gm-dark: var(--foreground);
          --gm-mid: var(--muted-foreground);
          --gm-muted: var(--muted-foreground);
          --gm-border: var(--border);
          --gm-save: var(--accent-soft);
          --gm-save-text: var(--accent-strong);
        }
        .gm-container { max-width: 1300px; margin: 0 auto; padding: 0 48px; }
        @media(max-width:768px){ .gm-container{ padding: 0 20px; } }

        /* product layout */
        .gm-product-layout {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 0; max-width: 1300px; margin: 0 auto;
          padding: 0 48px 80px;
        }
        @media(max-width:900px){
          .gm-product-layout{ grid-template-columns:1fr; padding: 0 20px 60px; }
          .gm-gallery-col{ padding-right:0; margin-bottom:32px; }
          .gm-info-col{ padding-left:0; }
        }

        /* gallery */
        .gm-gallery-col { padding-right: 48px; }
        .gm-main-img-wrap {
          position: relative; background: var(--gm-cream);
          border-radius: 6px; overflow: hidden;
          aspect-ratio: 1/1; cursor: zoom-in;
        }
        .gm-main-img-wrap img {
          width:100%; height:100%; object-fit:cover;
          transition: transform .6s ease;
        }
        .gm-main-img-wrap:hover img { transform: scale(1.04); }
        .gm-badge-cat {
          position:absolute; top:20px; left:20px;
          background: color-mix(in oklab, var(--background) 90%, transparent); backdrop-filter:blur(8px);
          font-size:12px; font-weight:500;
          color:var(--gm-walnut-mid); padding:5px 12px;
          border-radius:20px; border:1px solid var(--gm-gold-light);
        }
        .gm-badge-new {
          position:absolute; top:20px; right:20px;
          background:var(--gm-walnut); font-size:12px;
          font-weight:500;
          color:#fff; padding:5px 12px; border-radius:20px;
        }
        .gm-badge-discount {
          position:absolute; top:20px; right:20px;
          background:var(--accent-strong); font-size:13px; font-weight:700;
          letter-spacing:.02em;
          color:#fff; padding:6px 14px; border-radius:20px;
          box-shadow: 0 4px 12px rgba(130,57,31,.3);
        }
        .gm-thumbs { display:flex; gap:10px; margin-top:12px; }
        .gm-thumb {
          width:72px; height:72px; border-radius:2px; overflow:hidden;
          cursor:pointer; border:2px solid transparent;
          transition:border-color .2s; background:var(--gm-cream); flex-shrink:0;
        }
        .gm-thumb.active { border-color:var(--gm-walnut); }
        .gm-thumb img { width:100%; height:100%; object-fit:cover; }

        /* vista toggle */
        .gm-vista-toggle {
          display:flex; gap:0; margin-bottom:12px;
          border:1px solid var(--gm-border); border-radius:4px;
          overflow:hidden; width:fit-content;
        }
        .gm-vista-btn {
          padding:7px 18px; font-size:12px; font-weight:500; border:none; cursor:pointer;
          background:transparent; color:var(--gm-muted);
          transition:background .2s, color .2s;
        }
        .gm-vista-btn.active {
          background:var(--gm-walnut); color:#fff;
        }
        .gm-vista-btn:not(.active):hover {
          background:var(--gm-cream); color:var(--gm-walnut);
        }

        /* info col */
        .gm-info-col { padding-left:16px; min-width:0; }
        .gm-sku { font-size:12px; font-weight:500; color:var(--gm-muted); margin-bottom:10px; }
        .gm-product-title { font-family:var(--font-display); font-size:26px; font-weight:400; line-height:1.15; color:var(--gm-dark); margin-bottom:6px; }
        .gm-product-sub { font-size:14px; color:var(--gm-muted); letter-spacing:.04em; margin-bottom:24px; }

        .gm-stars-row { display:flex; gap:3px; margin-bottom:4px; }
        .gm-rating-row { display:flex; align-items:center; gap:10px; margin-bottom:24px; }
        .gm-rating-text { font-size:13px; color:var(--gm-muted); }

        .gm-price-block { display:flex; align-items:baseline; gap:12px; margin-bottom:8px; flex-wrap:wrap; }
        .gm-price-main { font-family:var(--font-body); font-weight:700; font-size:24px; font-variant-numeric:tabular-nums; color:var(--gm-walnut); }
        @media(min-width:640px){ .gm-product-title{ font-size:32px; } .gm-price-main{ font-size:28px; } .gm-section-title{ font-size:32px; } }
        .gm-price-old { font-size:18px; color:var(--gm-muted); text-decoration:line-through; }
        .gm-price-save { font-size:12px; background:var(--gm-save); color:var(--gm-save-text); padding:3px 10px; border-radius:20px; letter-spacing:.04em; }
        .gm-price-note { font-size:12px; color:var(--gm-muted); margin-bottom:24px; }

        .gm-divider { height:1px; background:var(--gm-border); margin:24px 0; }

        /* specs */
        .gm-specs-label { font-size:12px; font-weight:500; color:var(--gm-muted); margin-bottom:12px; }
        .gm-specs-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:24px; }
        .gm-spec-pill {
          display:flex; align-items:flex-start; gap:10px;
          background:var(--gm-cream); border-radius:2px; padding:12px 14px;
          border:1px solid transparent; transition:border-color .2s;
        }
        .gm-spec-pill:hover { border-color:var(--gm-gold-light); }
        .gm-spec-icon { font-size:18px; color:var(--gmx-accent, var(--gm-gold)); flex-shrink:0; margin-top:1px; }
        .gm-spec-pill-label { font-size:12px; font-weight:500; color:var(--gm-muted); margin-bottom:2px; }
        .gm-spec-pill-val { font-size:13px; font-weight:500; color:var(--gm-dark); }

        /* color picker */
        .gm-color-label { font-size:12px; font-weight:500; color:var(--gm-muted); margin-bottom:12px; }
        .gm-color-row { display:flex; gap:10px; margin-bottom:24px; flex-wrap:wrap; }
        .gm-swatch {
          width:32px; height:32px; border-radius:50%; cursor:pointer;
          transition:transform .2s, box-shadow .2s; border:3px solid transparent;
        }
        .gm-swatch.active { border-color:var(--gm-walnut); transform:scale(1.1); }
        .gm-swatch:hover { transform:scale(1.1); }

        /* includes */
        .gm-includes-label { font-size:12px; font-weight:500; color:var(--gm-muted); margin-bottom:12px; }
        .gm-includes-grid { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:28px; }
        .gm-includes-tag {
          font-size:12px; color:var(--gm-mid);
          background:var(--gm-cream); border:1px solid var(--gm-border);
          padding:5px 14px; border-radius:20px;
          display:flex; align-items:center; gap:6px;
        }
        .gm-tag-dot { width:6px; height:6px; background:var(--gm-gold); border-radius:50%; flex-shrink:0; }

        /* CTA */
        .gm-cta-row { display:flex; gap:12px; margin-bottom:12px; }
        .gm-btn-primary {
          background:var(--gm-walnut); color:#fff; border:none;
          padding:15px 24px; border-radius:2px; font-size:14px;
          letter-spacing:.06em; cursor:pointer; display:flex;
          align-items:center; justify-content:center; gap:8px;
          transition:background .2s, transform .15s;
        }
        .gm-btn-primary:hover { background:var(--gm-walnut-mid); }
        .gm-btn-primary:active { transform:scale(.99); }
        .gm-btn-primary.adding { background:color-mix(in oklab, var(--primary) 82%, black); }
        .gm-btn-primary.in-cart { background:var(--card); color:var(--gm-walnut); box-shadow:inset 0 0 0 1.5px var(--gm-walnut); }
        .gm-btn-primary.in-cart:hover { background:var(--gm-cream); }
        .gm-btn-wish {
          width:52px; height:52px; border:1px solid var(--gm-border);
          background:transparent; border-radius:2px;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:border-color .2s, color .2s; flex-shrink:0;
        }
        .gm-btn-wish:hover,.gm-btn-wish.active { border-color:var(--gm-gold); color:var(--gm-gold); }
        .gm-btn-quote {
          flex:1; background:transparent; color:var(--gm-walnut);
          border:none; min-height:44px; padding:10px 12px;
          font-size:14px; font-weight:500; letter-spacing:.04em;
          text-decoration:underline; text-underline-offset:3px;
          cursor:pointer; transition:background .2s;
        }
        .gm-btn-quote:hover { background:var(--gm-cream); }

        /* trust */
        .gm-trust-strip {
          display:flex; gap:0; border:1px solid var(--gm-border);
          border-radius:2px; overflow:hidden;
        }
        .gm-trust-item {
          flex:1; display:flex; align-items:center; gap:10px;
          padding:12px 14px; border-right:1px solid var(--gm-border);
          font-size:12px; color:var(--gm-mid);
        }
        .gm-trust-item:last-child { border-right:none; }

        /* accordion */
        .gm-accordion-item { border-bottom:1px solid var(--gm-border); }
        .gm-accordion-btn {
          width:100%; background:none; border:none; padding:16px 0;
          display:flex; align-items:center; justify-content:space-between;
          font-size:14px; font-weight:500; color:var(--gm-dark);
          cursor:pointer; text-align:left; letter-spacing:.02em;
        }
        .gm-accordion-body { padding:0 0 18px; font-size:13px; color:var(--gm-mid); line-height:1.75; }

        /* tabs section */
        .gm-tabs-section { max-width:1300px; margin:0 auto; padding:48px 48px 80px; }
        @media(max-width:768px){ .gm-tabs-section{ padding:32px 20px 60px; } }
        .gm-tab-wrap { position:relative; margin-bottom:40px; }
        .gm-tab-list { display:flex; border-bottom:1px solid var(--gm-border); overflow-x:auto; scrollbar-width:none; }
        .gm-tab-more { position:absolute; top:0; bottom:1px; width:44px; display:flex; align-items:center; pointer-events:none; opacity:0; transition:opacity .2s; color:var(--gm-walnut); }
        .gm-tab-more.on { opacity:1; }
        .gm-tab-more.der { right:0; justify-content:flex-end; background:linear-gradient(to left, var(--background) 35%, transparent); }
        .gm-tab-more.izq { left:0; background:linear-gradient(to right, var(--background) 35%, transparent); }
        .gm-tab-list::-webkit-scrollbar { display:none; }
        @media(max-width:640px){ .gm-tab-list{ justify-content:space-between; } .gm-tab-btn{ padding:14px 6px !important; font-size:12px !important; letter-spacing:.02em !important; } }
        .gm-tab-btn {
          flex:none; white-space:nowrap;
          background:none; border:none; padding:14px 24px;
          font-size:13px; font-weight:500;
          color:var(--gm-muted); cursor:pointer; position:relative; transition:color .2s;
        }
        .gm-tab-btn.active { color:var(--gm-walnut); }
        .gm-tab-btn.active::after {
          content:''; position:absolute; bottom:-1px; left:0; right:0;
          height:2px; background:var(--gm-walnut);
        }
        .gm-details-grid { display:grid; grid-template-columns:1fr 1fr; gap:40px; }
        @media(max-width:768px){ .gm-details-grid{ grid-template-columns:1fr; } }
        .gm-section-h3 { font-family:var(--font-body); font-size:20px; font-weight:500; color:var(--gm-walnut); margin-bottom:16px; }
        .gm-detail-table { width:100%; border-collapse:collapse; }
        .gm-detail-table tr { border-bottom:1px solid var(--gm-border); }
        .gm-detail-table tr:last-child { border-bottom:none; }
        .gm-dt-label { padding:10px 0; font-size:13px; color:var(--gm-muted); width:44%; vertical-align:top; }
        .gm-dt-val { padding:10px 0; font-size:13px; color:var(--gm-dark); font-weight:500; vertical-align:top; }
        .gm-detail-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:0; }
        .gm-dl-item { font-size:13px; color:var(--gm-mid); display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--gm-border); }
        .gm-dl-item:last-child { border-bottom:none; }
        .gm-dl-dot { width:4px; height:4px; background:var(--gm-gold); border-radius:50%; flex-shrink:0; }

        /* reviews */
        .gm-reviews-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
        @media(max-width:768px){ .gm-reviews-grid{ grid-template-columns:1fr; } }
        .gm-review-card { background:var(--gm-cream); padding:22px 24px; border-radius:6px; border:1px solid var(--gm-border); }
        .gm-review-text { font-size:13px; color:var(--gm-mid); line-height:1.7; margin:10px 0 12px; }
        .gm-review-author { font-size:12px; color:var(--gm-muted); }
        .gm-review-title { font-size:14px; font-weight:600; color:var(--gm-walnut); margin:2px 0 4px; }
        .gm-review-photos { display:flex; gap:6px; margin:8px 0; }
        .gm-review-photo { width:52px; height:52px; border-radius:5px; object-fit:cover; border:1px solid var(--gm-border); }
        .gm-review-reply { margin-top:10px; padding:10px 12px; background:var(--gm-warm); border-radius:5px; font-size:12px; color:var(--gm-mid); line-height:1.6; }
        .gm-review-reply span { font-weight:600; color:var(--gm-walnut); }
        .gm-rating-summary { display:flex; gap:40px; align-items:center; padding:24px 0 36px; border-bottom:1px solid var(--gm-border); margin-bottom:28px; flex-wrap:wrap; }
        .gm-rating-avg { text-align:center; min-width:120px; }
        .gm-rating-avg-num { font-family:var(--font-body); font-size:42px; font-weight:700; color:var(--gm-walnut); line-height:1; }
        .gm-rating-count { font-size:12px; color:var(--gm-muted); }
        .gm-rating-bars { flex:1; min-width:220px; max-width:360px; display:flex; flex-direction:column; gap:6px; }
        .gm-rating-bar-row { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--gm-muted); }
        .gm-rating-bar-track { flex:1; height:6px; border-radius:3px; background:var(--gm-border); overflow:hidden; }
        .gm-rating-bar-fill { height:100%; background:var(--gm-gold); border-radius:3px; }
        .gm-rating-bar-count { width:20px; text-align:right; }

        /* recommended */
        .gm-recommended { background:var(--gm-cream); padding:80px 0; }
        @media(max-width:768px){ .gm-recommended{ padding:60px 0; } }
        .gm-eyebrow { font-size:12px; font-weight:500; color:var(--gm-muted); margin-bottom:10px; }
        .gm-section-title { font-family:var(--font-display); font-size:26px; font-weight:400; color:var(--gm-walnut); margin-bottom:6px; }
        .gm-section-sub { font-size:14px; color:var(--gm-muted); margin-bottom:40px; }
        .gm-rec-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }
        @media(max-width:1100px){ .gm-rec-grid{ grid-template-columns:repeat(2,1fr); } }
        @media(max-width:600px){ .gm-rec-grid{ grid-template-columns:1fr 1fr; gap:12px; } }
        .gm-rec-card {
          background:var(--card); border-radius:6px; overflow:hidden;
          cursor:pointer; transition:transform .3s ease, box-shadow .3s ease;
          border:1px solid transparent; text-decoration:none; display:block;
        }
        .gm-rec-card:hover { transform:translateY(-4px); box-shadow:0 16px 40px rgba(41,40,36,.10); border-color:var(--gm-gold-light); }
        .gm-rec-img { aspect-ratio:4/3; background:var(--gm-cream); overflow:hidden; position:relative; }
        .gm-rec-img img { width:100%; height:100%; object-fit:cover; transition:transform .6s ease; }
        .gm-rec-card:hover .gm-rec-img img { transform:scale(1.06); }
        .gm-rec-img-placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:40px; }
        .gm-rec-tag {
          position:absolute; bottom:10px; left:10px; font-size:12px;
          font-weight:500;
          background:color-mix(in oklab, var(--card) 90%, transparent); color:var(--gm-walnut-mid);
          padding:4px 10px; border-radius:20px; backdrop-filter:blur(4px);
        }
        .gm-rec-body { padding:16px 18px 18px; }
        .gm-rec-name { font-family:var(--font-body); font-size:16px; font-weight:600; color:var(--gm-dark); margin-bottom:4px; }
        .gm-rec-desc { font-size:12px; color:var(--gm-muted); margin-bottom:12px; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .gm-rec-footer { display:flex; align-items:center; justify-content:space-between; }
        .gm-rec-price { font-size:16px; font-weight:500; color:var(--gm-walnut); }
        .gm-rec-btn {
          width:32px; height:32px; border-radius:50%;
          background:var(--gm-walnut); color:#fff; border:none;
          font-size:18px; display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:background .2s, transform .15s; flex-shrink:0;
        }
        .gm-rec-btn:hover { background:var(--gm-walnut-mid); transform:scale(1.1); }
      `;

type ProductData = NonNullable<ReturnType<typeof useProduct>["data"]>;
/** Columnas opcionales de products que aún no están en el tipo Product */
type ProductExtra = {
  imagenes?: { url: string; public_id?: string; color?: { name: string; hex: string } | null }[] | null;
  modelo_3d_url?: string | null;
};

/* ─── page shell: carga y estados vacíos ──────────── */
function ProductPage() {
  const { handle } = Route.useParams();
  const { data: product, isLoading } = useProduct(handle);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }
  if (!product) return <ProductNotFound />;

  // key => al cambiar de producto se reinician selecciones, galería y módulos
  return <ProductView key={product.id} product={product} />;
}

/* ─── vista de producto (adaptativa por categoría) ── */
function ProductView({ product: base }: { product: ProductData }) {
  const product = base as ProductData & ProductExtra;
  const addItem = useCartStore((s) => s.addItem);
  const itemsCarrito = useCartStore((s) => s.items);
  const { toggleWishlist, addToWishlist, removeFromWishlist, isWishlisted } = useWishlist();
  const [wishPending, setWishPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [vista, setVista] = useState<"foto" | "3d">("foto");
  const [leadOpen, setLeadOpen] = useState(false);
  const [espacioOpen, setEspacioOpen] = useState(false);
  const [espacioMontado, setEspacioMontado] = useState(false);
  const [ambient, setAmbient] = useState(false);
  const [finishIdx, setFinishIdx] = useState(0);
  const [fotoColor, setFotoColor] = useState(0);
  const [modPrefs, setModPrefs] = useState<Record<string, string>>({});
  const [showSticky, setShowSticky] = useState(false);
  // Tras agregar: la ficha y la barra ofrecen «Ir a pagar» / «Seguir comprando»
  const [postAdd, setPostAdd] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  const profile = useMemo(() => resolveProfile(product), [product]);

  // Opciones de la BD (color, tapizado, firmeza, patas). Si el producto no tiene, se usan las listas fijas de siempre.
  const { grupos: gruposBD, cargando: cargandoOpciones } = useOpcionesProducto(product.id);
  const hayOpcionesBD = gruposBD.length > 0;
  const [selOpciones, setSelOpciones] = useState<SeleccionOpciones>({});
  const { elegidos, ajuste: ajusteOpciones, ids: idsOpciones } = useMemo(
    () => resolverSeleccion(gruposBD, selOpciones),
    [gruposBD, selOpciones],
  );
  // Firmeza/patas de BD reemplazan a las fichas fijas del módulo "comfort"
  const comfortEnBD = gruposBD.some((g) => ["firmeza", "patas"].includes(g.tipo.toLowerCase()));

  useEffect(() => {
    trackEvent({
      tipo: "producto_visto",
      path: window.location.pathname,
      product_id: product.id,
      valor: product.precio,
      nombre: product.nombre,
      categoria: product.categoria,
    });
  }, [product.id]);

  // Rating REAL (antes la ficha mostraba "4.0 · 38 reseñas" fijo para todos los productos)
  const { data: ratingData } = useQuery({
    queryKey: ["rating-producto", product.id],
    queryFn: () => fetchProductRating(product.id),
    staleTime: 60_000,
  });
  const rating = ratingData?.rating ?? null;
  const hayRating = !!rating && rating.total_resenas > 0;

  // La barra de compra aparece cuando el botón principal sale de pantalla (hacia arriba)
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const setPref = useCallback((k: string, v: string | null) => {
    setModPrefs((prev) => {
      if (v == null) {
        if (!(k in prev)) return prev;
        const { [k]: _omit, ...rest } = prev;
        return rest;
      }
      return prev[k] === v ? prev : { ...prev, [k]: v };
    });
  }, []);

  // Las preferencias del módulo que ya cubre una opción de BD (firmeza, patas) no se duplican
  const setPrefModulo = useCallback(
    (k: string, v: string | null) => {
      if (gruposBD.some((g) => g.tipo.toLowerCase() === k.toLowerCase())) return;
      setPref(k, v);
    },
    [gruposBD, setPref],
  );

  // Galería: array `imagenes` con fallback al campo legacy
  const allImgs: string[] = (() => {
    const gallery = product.imagenes;
    if (Array.isArray(gallery) && gallery.length > 0) {
      return gallery.map((img) => (img.public_id ? cloudinaryUrl(img.public_id, { w: 900, h: 900 }) : img.url));
    }
    if (product.imagen_public_id) return [cloudinaryUrl(product.imagen_public_id, { w: 900, h: 900 })];
    if (product.imagen_url) return [product.imagen_url];
    return [];
  })();
  const mainImg = allImgs[0] ?? null;
  const displayImg = allImgs[activeImg] ?? mainImg;

  // Colores definidos por foto (los asigna el admin): cada color único apunta a su primera foto.
  // Si hay al menos uno, reemplazan a los acabados genéricos de la categoría.
  const fotoColores = useMemo(() => {
    const out: { name: string; hex: string; imgIdx: number }[] = [];
    (product.imagenes ?? []).forEach((img, i) => {
      const c = img.color;
      if (!c?.hex) return;
      if (out.some((o) => o.hex.toLowerCase() === c.hex.toLowerCase())) return;
      out.push({ name: c.name || c.hex, hex: c.hex, imgIdx: i });
    });
    return out;
  }, [product.imagenes]);
  const hayColoresFoto = fotoColores.length > 0;

  const piezasProducto = useMemo(() => piezasDeProducto(product).piezas, [product]);

  // «Pruébalo en tu espacio»: cada color por foto es un acabado; sin colores, la foto que se está viendo
  const acabadosEspacio: AcabadoEspacio[] = useMemo(() => {
    if (hayColoresFoto) {
      return fotoColores
        .filter((c) => allImgs[c.imgIdx])
        .map((c) => ({ id: c.hex, nombre: c.name, hex: c.hex, img: allImgs[c.imgIdx] }));
    }
    return displayImg ? [{ id: "foto", nombre: "Original", hex: null, img: displayImg }] : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotoColores, hayColoresFoto, displayImg, allImgs.join("|")]);

  // Al pasar de foto en la galería, el color seleccionado sigue a la foto
  useEffect(() => {
    const hex = product.imagenes?.[activeImg]?.color?.hex?.toLowerCase();
    if (!hex) return;
    const i = fotoColores.findIndex((c) => c.hex.toLowerCase() === hex);
    if (i >= 0) setFotoColor(i);
  }, [activeImg, fotoColores, product.imagenes]);

  // Color de BD → foto: se empareja por nombre o hex con los colores por foto que carga el admin
  const elegirOpcion = (g: OpcionGrupo, v: OpcionValor) => {
    setSelOpciones((prev) => ({ ...prev, [g.id]: v.id }));
    if (g.tipo.toLowerCase() === "color") {
      const m = fotoColores.find(
        (c) => c.name.toLowerCase() === v.valor.toLowerCase() || (!!v.hex && c.hex.toLowerCase() === v.hex.toLowerCase()),
      );
      if (m) { setActiveImg(m.imgIdx); setVista("foto"); }
    }
  };

  const elegirColor = (i: number) => {
    if (hayColoresFoto) {
      setFotoColor(i);
      setActiveImg(fotoColores[i].imgIdx);
      setVista("foto");
    } else {
      setFinishIdx(i);
    }
  };

  // Precio: (lista + ajustes de opciones) con la oferta aplicada al total — la misma regla del servidor
  const precioLista = product.precio + (hayOpcionesBD ? ajusteOpciones : 0);
  const { activa: enOferta, precioFinal: precioMostrado, venceEl } = ofertaInfo({ ...product, precio: precioLista });
  const precioSinOpciones = ofertaInfo(product).precioFinal; // los combos usan el precio propio de la pieza
  const outOfStock = (product.stock ?? 1) <= 0;
  const has3D = !!product.modelo_3d_url;
  const esNuevo = Date.now() - new Date(product.created_at).getTime() < 30 * 24 * 60 * 60 * 1000;
  const tieneLed = profile.key === "tv";

  // SEO: título/description reales, canonical, Open Graph y datos estructurados (JSON-LD Product)
  const seoPath = `/product/${product.id}`;
  const catProducto = product.categoria ? getCategoria(product.categoria) : undefined;
  useSeo({
    title: [product.nombre, (product.categoria && getCategoria(product.categoria)?.nombre) || product.categoria, product.material_base].filter(Boolean).join(" · "),
    description:
      product.descripcion ||
      `${product.nombre}${product.categoria ? ` — ${product.categoria}` : ""} fabricado a pedido en Lima por G&M Mueblería. Entrega a domicilio y 2 años de garantía en estructura.`,
    image: absolutizar(mainImg),
    path: seoPath,
    type: "product",
    jsonLd: [{
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.nombre,
      description: product.descripcion || undefined,
      sku: product.sku || product.id,
      category: product.categoria || undefined,
      material: product.material_base || undefined,
      image: allImgs.map((u) => absolutizar(u)).filter(Boolean),
      brand: { "@type": "Brand", name: "G&M Mueblería" },
      offers: {
        "@type": "Offer",
        url: `${window.location.origin}${seoPath}`,
        priceCurrency: "PEN",
        price: Number(precioMostrado).toFixed(2),
        availability: outOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: "G&M Mueblería" },
      },
      ...(hayRating
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: Number(rating!.calificacion_promedio).toFixed(1),
              reviewCount: rating!.total_resenas,
            },
          }
        : {}),
    },
    migasJsonLd([
      { nombre: "Inicio", path: "/" },
      ...(catProducto ? [{ nombre: catProducto.nombre, path: `/categoria/${catProducto.slug}` }] : []),
      { nombre: product.nombre, path: seoPath },
    ])],
  });

  // Opciones elegidas → viajan en el título del ítem (el checkout no cambia) y en cotización / WhatsApp
  const swatches: { name: string; hex: string }[] = hayColoresFoto ? fotoColores : profile.acabados;
  const swatchSel = hayColoresFoto ? Math.min(fotoColor, fotoColores.length - 1) : finishIdx;
  const acabado = swatches[swatchSel];
  const acabadoLabel = hayColoresFoto ? "Color" : profile.acabadoLabel;
  const prefs: Record<string, string> = hayOpcionesBD
    ? { ...Object.fromEntries(elegidos.map((x) => [x.grupo.etiqueta, x.valor.valor])), ...modPrefs }
    : { [acabadoLabel]: acabado.name, ...modPrefs };

  // Línea del carrito que corresponde a la selección actual (mismos ids → misma línea)
  const lineIdActual = calcLineId(product.id, hayOpcionesBD ? idsOpciones : undefined);
  // Cantidad real de ESTA selección en el carrito: el botón refleja el estado del carrito, no un temporizador
  const qtyEnCarrito = itemsCarrito.find((i) => i.lineId === lineIdActual)?.qty ?? 0;
  // Unidades de este producto en el carrito (todas las selecciones), para el enlace "Ir a pagar"
  const qtyProductoTotal = itemsCarrito.filter((i) => i.id === product.id && !i.comboId).reduce((s, i) => s + i.qty, 0);

  // Foto del color elegido (de BD): la del color por foto o, si no hay, la del propio valor
  const imgOpcion = (() => {
    const v = elegidos.find((x) => x.grupo.tipo.toLowerCase() === "color")?.valor;
    if (!v) return null;
    const m = fotoColores.find((c) => c.name.toLowerCase() === v.valor.toLowerCase() || (!!v.hex && c.hex.toLowerCase() === v.hex.toLowerCase()));
    return (m ? allImgs[m.imgIdx] : null) ?? v.image_url;
  })();
  const prefsLista = Object.entries(prefs);
  const prefsTexto = prefsLista.map(([k, v]) => `${k}: ${v}`).join(" · ");

  const handleAdd = () => {
    setAdding(true);
    setPostAdd(true);
    addItem({
      id: product.id,
      title: `${product.nombre} (${Object.values(prefs).join(", ")})`,
      price: precioMostrado,
      // Con colores por foto, el carrito muestra la foto del color elegido
      image: hayOpcionesBD
        ? imgOpcion ?? mainImg ?? ""
        : (hayColoresFoto ? allImgs[fotoColores[swatchSel]?.imgIdx ?? 0] : null) ?? mainImg ?? "",
      sku: product.sku ?? undefined,
      // Solo los ids: el servidor valida, suma el ajuste y arma el título. Sin opciones en BD → formato antiguo.
      opciones: hayOpcionesBD ? idsOpciones : undefined,
    });
    avisoCarrito("Agregado al carrito", `${product.nombre} · ${Object.values(prefs).join(" · ")}`);
    // Solo el destello verde es temporal; después el botón queda en "En tu carrito" (qtyEnCarrito)
    setTimeout(() => setAdding(false), 1600);
  };

  // Compartir con vista previa (imagen + precio) vía /share/product/:id de la API
  const compartir = async () => {
    const url = urlCompartir("product", product.id);
    trackShare(product.id, product.nombre);
    try {
      if (navigator.share) {
        await navigator.share({ title: product.nombre, text: `${product.nombre} — G&M Mueblería`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado", { description: "Pégalo en WhatsApp, Instagram o donde quieras.", position: "top-center" });
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("No pudimos copiar el enlace");
    }
  };

  const waHref = WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        `Hola G&M 👋 Me interesa "${product.nombre}"${product.sku ? ` (SKU ${product.sku})` : ""}.\n${prefsTexto}\n${window.location.href}`,
      )}`
    : null;

  return (
    <>
      <style>{PAGE_CSS}</style>

      <div
        className="min-h-screen bg-background gmx-page"
        style={{ "--gmx-accent": profile.accent, "--gmx-accent-soft": profile.accentSoft } as React.CSSProperties}
      >
        <Header />

        {/* ── ruta de compra (migas de pan) ── */}
        <ProductBreadcrumb productId={product.id} productName={product.nombre} categoria={product.categoria} />

        {/* ── product layout ── */}
        <div className="gm-product-layout">

          {/* gallery */}
          <div className="gm-gallery-col">
            <div className="gmx-gallery-sticky">
              {has3D && (
                <div className="gm-vista-toggle">
                  <button className={`gm-vista-btn${vista === "foto" ? " active" : ""}`} onClick={() => setVista("foto")}>Foto</button>
                  <button className={`gm-vista-btn${vista === "3d" ? " active" : ""}`} onClick={() => setVista("3d")}>Vista 3D</button>
                </div>
              )}

              {vista === "3d" && has3D ? (
                <div style={{ borderRadius: 6, overflow: "hidden", aspectRatio: "1/1", background: "var(--gm-cream)" }}>
                  <ModelViewer3D src={product.modelo_3d_url ?? ""} alt={product.nombre} poster={displayImg ?? undefined} />
                </div>
              ) : (
                <ProductGallery
                  images={allImgs}
                  alt={product.nombre}
                  index={activeImg}
                  onIndexChange={setActiveImg}
                  night={ambient && tieneLed}
                >
                  {product.categoria && <div className="gm-badge-cat">{product.categoria}</div>}
                  {enOferta
                    ? <div className="gm-badge-discount">-{product.descuento_porcentaje}%</div>
                    : esNuevo && <div className="gm-badge-new">Nuevo</div>}
                </ProductGallery>
              )}

              {acabadosEspacio.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setEspacioMontado(true);
                    setEspacioOpen(true);
                  }}
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Camera size={16} aria-hidden /> Pruébalo en tu espacio
                </button>
              )}
            </div>
          </div>

          {/* info */}
          <div className="gm-info-col">
            <div className="gmx-eyebrow">{profile.eyebrow}</div>
            <h1 className="gm-product-title">{product.nombre}</h1>
            <p className="gmx-pitch">{profile.pitch}</p>

            {/* rating real */}
            {hayRating && rating && (
              <div className="gm-rating-row">
                <div className="gm-stars-row">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14}
                      fill={i < Math.round(rating.calificacion_promedio) ? "var(--gm-gold)" : "none"}
                      color={i < Math.round(rating.calificacion_promedio) ? "var(--gm-gold)" : "var(--gm-border)"} />
                  ))}
                </div>
                <span className="gm-rating-text">{rating.calificacion_promedio.toFixed(1)} · {rating.total_resenas} reseña{rating.total_resenas === 1 ? "" : "s"}</span>
              </div>
            )}

            <LivePrice
              precioOriginal={precioLista}
              precioFinal={precioMostrado}
              enOferta={enOferta}
              descuento={product.descuento_porcentaje}
              venceEl={venceEl}
              stock={product.stock}
              agotado={outOfStock}
            />

            <ul className="gmx-ideal" style={{ padding: 0 }}>
              {profile.idealFor.map((t) => <li key={t}>{t}</li>)}
            </ul>

            {/* herramienta firma de la categoría */}
            {!(hayOpcionesBD && comfortEnBD && profile.module === "comfort") && (
            <SignatureModule
              profile={profile}
              nombre={product.nombre}
              subcategoria={product.subcategoria}
              setPref={setPrefModulo}
              ambient={ambient}
              setAmbient={setAmbient}
            />
            )}

            {/* materiales (por categoría) */}
            <div className="gm-specs-label">Materiales y construcción</div>
            <div className="gm-specs-grid">
              {profile.specs.map((s) => (
                <div key={s.label} className="gm-spec-pill">
                  <s.icon size={18} className="gmx-spec-icon" />
                  <div>
                    <div className="gm-spec-pill-label">{s.label}</div>
                    <div className="gm-spec-pill-val">{s.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* opciones: de la BD si el producto las tiene; si no, acabados fijos de la categoría / colores por foto */}
            {hayOpcionesBD ? (
              <OpcionesProducto grupos={gruposBD} seleccion={selOpciones} onElegir={elegirOpcion} />
            ) : (
              swatches.length > 1 ? (
                <>
                  <div className="gm-color-label">
                    {acabadoLabel} — <span style={{ color: "var(--gm-dark)", fontWeight: 500 }}>{acabado.name}</span>
                  </div>
                  <div className="gm-color-row" role="radiogroup" aria-label={acabadoLabel}>
                    {swatches.map((c, i) => (
                      <button key={c.hex} type="button" role="radio" aria-checked={swatchSel === i} aria-label={c.name}
                        className="gmx-swatch" style={{ background: c.hex }} title={c.name} onClick={() => elegirColor(i)} />
                    ))}
                  </div>
                </>
              ) : (
                // D8: con un único color no hay nada que elegir → texto, sin selector
                <div className="gm-color-label">
                  {acabadoLabel}: <span style={{ color: "var(--gm-dark)", fontWeight: 500 }}>{acabado.name}</span>
                </div>
              )
            )}

            {/* descripción */}
            {product.descripcion && (
              <>
                <div className="gm-specs-label" style={{ marginBottom: 8 }}>Descripción</div>
                <p style={{ fontSize: 13, color: "var(--gm-mid)", lineHeight: 1.75, marginBottom: 20, whiteSpace: "pre-line" }}>
                  {product.descripcion}
                </p>
              </>
            )}

            <DeliveryPromise />

            {/* resumen de lo elegido */}
            <p className="gmx-prefs">Tu selección: <b>{prefsLista.map(([k, v]) => `${k} ${v}`).join(" · ")}</b></p>

            {/* CTA */}
            <div className="gm-cta-row" ref={ctaRef}>
              <button
                className={`gm-btn-primary${adding ? " adding" : ""}${!adding && qtyEnCarrito > 0 ? " in-cart" : ""}${!adding && !outOfStock && qtyEnCarrito === 0 ? " gmx-btn-pulse" : ""}`}
                style={{ flex: 1 }}
                onClick={handleAdd}
                disabled={outOfStock || cargandoOpciones}
              >
                {adding || qtyEnCarrito > 0 ? <Check size={16} /> : <ShoppingBag size={16} />}
                {adding
                  ? "¡Agregado!"
                  : outOfStock
                    ? "Agotado"
                    : qtyEnCarrito > 0
                      ? `En tu carrito (${qtyEnCarrito}) · Agregar otro`
                      : "Agregar al carrito"}
              </button>
              <button
                type="button"
                className={`gm-btn-wish${isWishlisted(product.id) ? " active" : ""}`}
                disabled={wishPending}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setWishPending(true);
                  const estaba = isWishlisted(product.id);
                  const added = await toggleWishlist(product.id);
                  if (!estaba && !added) toast.error("No pudimos guardar el favorito");
                  else avisoFavorito(product.nombre, added, () => (added ? removeFromWishlist(product.id) : addToWishlist(product.id)));
                  setWishPending(false);
                }}
                title={isWishlisted(product.id) ? "Quitar de favoritos" : "Guardar en favoritos"}
                aria-label={isWishlisted(product.id) ? "Quitar de favoritos" : "Guardar en favoritos"}
              >
                <Heart size={18} fill={isWishlisted(product.id) ? "var(--gm-gold)" : "none"} />
              </button>
            </div>
            {postAdd && qtyProductoTotal > 0 && (
              <div className="gmx-postadd" role="status">
                <p className="gmx-postadd-msg">
                  <Check size={16} aria-hidden /> Agregado al carrito ({qtyProductoTotal} {qtyProductoTotal === 1 ? "unidad" : "unidades"})
                </p>
                <div className="gmx-postadd-btns">
                  <Link to="/checkout" className="gmx-postadd-pay">Ir a pagar</Link>
                  <SeguirComprandoLink categoria={product.categoria} className="gmx-postadd-more">Seguir comprando</SeguirComprandoLink>
                </div>
              </div>
            )}
            {!postAdd && qtyProductoTotal > 0 && (
              <Link to="/checkout" className="gmx-gopay">
                Ir a pagar ({qtyProductoTotal} {qtyProductoTotal === 1 ? "unidad" : "unidades"}) <ChevronRight size={14} />
              </Link>
            )}
            <div className="gm-cta-row">
              <button className="gm-btn-quote" onClick={() => setLeadOpen(true)}>Solicitar cotización personalizada</button>
            </div>
            {waHref && (
              <a
                className="gmx-wa"
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackLead("whatsapp", { id: product.id, nombre: product.nombre, precio: precioMostrado, categoria: product.categoria })}
              >
                <MessageCircle size={17} /> Hablar con un asesor por WhatsApp
              </a>
            )}
            <button type="button" className="gmx-share" onClick={compartir}>
              <Share2 size={15} /> Compartir este mueble
            </button>
            <LeadFormDialog
              open={leadOpen}
              onOpenChange={setLeadOpen}
              productoId={product.id}
              productoNombre={product.nombre}
              mensajeInicial={`Mi selección — ${prefsTexto}.`}
            />

            <div className="gm-divider" />

            {/* trust */}
            <div className="gm-trust-strip">
              <div className="gm-trust-item"><Hammer size={16} color="var(--gmx-accent)" />Hecho a mano</div>
              <div className="gm-trust-item"><Shield size={16} color="var(--gmx-accent)" />Garantía 2 años</div>
              <div className="gm-trust-item"><Truck size={16} color="var(--gmx-accent)" />Envío a domicilio</div>
            </div>

            {/* preguntas frecuentes (por categoría) */}
            <div style={{ marginTop: 24 }}>
              {profile.faqs.map((f) => <AccordionItem key={f.q} title={f.q}>{f.a}</AccordionItem>)}
            </div>
          </div>

          {/* recomendaciones de la misma categoría */}
          <div style={{ gridColumn: "1 / -1" }}>
            <ProductRecomendaciones productId={product.id} categoria={product.categoria} />
          </div>
        </div>

        <Tabs product={product} profile={profile} />

        <BundleBuilder
          profile={profile}
          base={{ id: product.id, nombre: product.nombre, precio: precioSinOpciones, image: mainImg, sku: product.sku, categoria: product.categoria }}
        />

        {espacioMontado && (
          <Suspense fallback={null}>
            <ProbarEnTuEspacio
              open={espacioOpen}
              onOpenChange={setEspacioOpen}
              nombre={product.nombre}
              piezas={piezasProducto}
              acabados={acabadosEspacio}
              acabadoInicial={hayColoresFoto ? Math.min(fotoColor, Math.max(0, acabadosEspacio.length - 1)) : 0}
            />
          </Suspense>
        )}

        <Footer />
        {/* En móvil la barra de compra es fija: este espacio evita que tape el final de la página */}
        <div className="gmx-sticky-spacer" aria-hidden />

        <StickyBuyBar
          visible={showSticky}
          image={mainImg}
          nombre={product.nombre}
          resumen={Object.values(prefs).join(" · ")}
          precio={precioMostrado}
          disabled={outOfStock || cargandoOpciones}
          adding={adding}
          qtyEnCarrito={qtyEnCarrito}
          postAdd={postAdd && qtyProductoTotal > 0}
          categoria={product.categoria}
          onAdd={handleAdd}
        />
      </div>
    </>
  );
}