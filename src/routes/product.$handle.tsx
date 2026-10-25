import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/context/WishlistContext";
import { LoginModal } from "@/components/LoginModal";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useProduct, useProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Loader2, ArrowLeft, Heart, ShoppingBag, ChevronRight, Shield, Truck, Hammer, Star, MessageCircle } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { trackEvent } from "@/hooks/useEventTracking";
import { ProductRecomendaciones } from "@/components/ProductRecomendaciones";
import { ModelViewer3D } from "@/components/ModelViewer3D";
import { ofertaInfo } from "@/lib/pricing";
import { LeadFormDialog } from "@/components/LeadFormDialog";
import { WHATSAPP_NUMBER } from "@/config";
import { resolveProfile, type ProductProfile } from "@/lib/productProfiles";
import { LivePrice } from "@/components/product/LivePrice";
import { DeliveryPromise } from "@/components/product/DeliveryPromise";
import { SignatureModule } from "@/components/product/SignatureModules";
import { BundleBuilder } from "@/components/product/BundleBuilder";
import { StickyBuyBar } from "@/components/product/StickyBuyBar";
import "@/components/product/product-experience.css";
import { fetchProductReviews, fetchProductRating } from "@/lib/resenas.functions";

export const Route = createFileRoute("/product/$handle")({
  head: ({ params }) => ({
    meta: [{ title: `${params.handle} — G&M Mueblería` }],
  }),
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
        <div className="gm-tab-list">
          {TABS.map((t, i) => (
            <button key={t} className={`gm-tab-btn${active === i ? " active" : ""}`} onClick={() => setActive(i)}>{t}</button>
          ))}
        </div>

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
                          <img key={i} src={url} alt="" className="gm-review-photo" />
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
                    ["Lima Metropolitana", "5–7 días hábiles"],
                    ["Provincias", "10–15 días hábiles"],
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
  );
}


const PAGE_CSS = `
        :root {
          --gm-cream: #F7F4EF;
          --gm-warm: #FDFAF6;
          --gm-walnut: #3B2B1F;
          --gm-walnut-mid: #6B4C38;
          --gm-gold: #C9A96E;
          --gm-gold-light: #E8D5B0;
          --gm-blush: #E8D5CC;
          --gm-dark: #1C1410;
          --gm-mid: #5A4035;
          --gm-muted: #9A8070;
          --gm-border: rgba(59,43,31,0.12);
          --gm-save: #EBF4E8;
          --gm-save-text: #3A6B2A;
        }
        .gm-container { max-width: 1300px; margin: 0 auto; padding: 0 48px; }
        @media(max-width:768px){ .gm-container{ padding: 0 20px; } }

        /* breadcrumb */
        .gm-breadcrumb {
          display: flex; align-items: center; gap: 8px;
          padding: 16px 48px; font-size: 12px;
          color: var(--gm-muted); letter-spacing: .04em;
        }
        .gm-breadcrumb a { color: var(--gm-muted); text-decoration: none; transition: color .2s; }
        .gm-breadcrumb a:hover { color: var(--gm-walnut); }
        @media(max-width:768px){ .gm-breadcrumb{ padding: 12px 20px; } }

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
          background: rgba(247,244,239,.9); backdrop-filter:blur(8px);
          font-size:10px; letter-spacing:.18em; text-transform:uppercase;
          color:var(--gm-walnut-mid); padding:5px 12px;
          border-radius:20px; border:1px solid var(--gm-gold-light);
        }
        .gm-badge-new {
          position:absolute; top:20px; right:20px;
          background:var(--gm-walnut); font-size:10px;
          letter-spacing:.1em; text-transform:uppercase;
          color:#fff; padding:5px 12px; border-radius:20px;
        }
        .gm-badge-discount {
          position:absolute; top:20px; right:20px;
          background:#c0392b; font-size:13px; font-weight:700;
          letter-spacing:.02em;
          color:#fff; padding:6px 14px; border-radius:20px;
          box-shadow: 0 4px 12px rgba(192,57,43,.35);
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
          padding:7px 18px; font-size:12px; letter-spacing:.06em;
          text-transform:uppercase; border:none; cursor:pointer;
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
        .gm-sku { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--gm-muted); margin-bottom:10px; }
        .gm-product-title { font-family:var(--font-display); font-size:38px; font-weight:400; line-height:1.15; color:var(--gm-dark); margin-bottom:6px; }
        .gm-product-sub { font-size:14px; color:var(--gm-muted); letter-spacing:.04em; margin-bottom:24px; }

        .gm-stars-row { display:flex; gap:3px; margin-bottom:4px; }
        .gm-rating-row { display:flex; align-items:center; gap:10px; margin-bottom:24px; }
        .gm-rating-text { font-size:13px; color:var(--gm-muted); }

        .gm-price-block { display:flex; align-items:baseline; gap:12px; margin-bottom:8px; flex-wrap:wrap; }
        .gm-price-main { font-family:var(--font-display); font-size:34px; color:var(--gm-walnut); }
        .gm-price-old { font-size:18px; color:var(--gm-muted); text-decoration:line-through; }
        .gm-price-save { font-size:12px; background:var(--gm-save); color:var(--gm-save-text); padding:3px 10px; border-radius:20px; letter-spacing:.04em; }
        .gm-price-note { font-size:12px; color:var(--gm-muted); margin-bottom:24px; }

        .gm-divider { height:1px; background:var(--gm-border); margin:24px 0; }

        /* specs */
        .gm-specs-label { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--gm-muted); margin-bottom:12px; }
        .gm-specs-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:24px; }
        .gm-spec-pill {
          display:flex; align-items:flex-start; gap:10px;
          background:var(--gm-cream); border-radius:2px; padding:12px 14px;
          border:1px solid transparent; transition:border-color .2s;
        }
        .gm-spec-pill:hover { border-color:var(--gm-gold-light); }
        .gm-spec-icon { font-size:18px; color:var(--gmx-accent, var(--gm-gold)); flex-shrink:0; margin-top:1px; }
        .gm-spec-pill-label { font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--gm-muted); margin-bottom:2px; }
        .gm-spec-pill-val { font-size:13px; font-weight:500; color:var(--gm-dark); }

        /* color picker */
        .gm-color-label { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--gm-muted); margin-bottom:12px; }
        .gm-color-row { display:flex; gap:10px; margin-bottom:24px; flex-wrap:wrap; }
        .gm-swatch {
          width:32px; height:32px; border-radius:50%; cursor:pointer;
          transition:transform .2s, box-shadow .2s; border:3px solid transparent;
        }
        .gm-swatch.active { border-color:var(--gm-walnut); transform:scale(1.1); }
        .gm-swatch:hover { transform:scale(1.1); }

        /* includes */
        .gm-includes-label { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--gm-muted); margin-bottom:12px; }
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
        .gm-btn-primary.adding { background:#3A6B2A; }
        .gm-btn-wish {
          width:52px; height:52px; border:1px solid var(--gm-border);
          background:transparent; border-radius:2px;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:border-color .2s, color .2s; flex-shrink:0;
        }
        .gm-btn-wish:hover,.gm-btn-wish.active { border-color:var(--gm-gold); color:var(--gm-gold); }
        .gm-btn-quote {
          flex:1; background:transparent; color:var(--gm-walnut);
          border:1px solid var(--gm-walnut); padding:15px;
          border-radius:2px; font-size:14px; letter-spacing:.06em;
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
        .gm-tab-list { display:flex; border-bottom:1px solid var(--gm-border); margin-bottom:40px; }
        .gm-tab-btn {
          background:none; border:none; padding:14px 24px;
          font-size:13px; letter-spacing:.06em; text-transform:uppercase;
          color:var(--gm-muted); cursor:pointer; position:relative; transition:color .2s;
        }
        .gm-tab-btn.active { color:var(--gm-walnut); }
        .gm-tab-btn.active::after {
          content:''; position:absolute; bottom:-1px; left:0; right:0;
          height:2px; background:var(--gm-walnut);
        }
        .gm-details-grid { display:grid; grid-template-columns:1fr 1fr; gap:40px; }
        @media(max-width:768px){ .gm-details-grid{ grid-template-columns:1fr; } }
        .gm-section-h3 { font-family:var(--font-display); font-size:20px; font-weight:400; color:var(--gm-walnut); margin-bottom:16px; }
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
        .gm-rating-avg-num { font-family:var(--font-display,inherit); font-size:42px; font-weight:600; color:var(--gm-walnut); line-height:1; }
        .gm-rating-count { font-size:12px; color:var(--gm-muted); }
        .gm-rating-bars { flex:1; min-width:220px; max-width:360px; display:flex; flex-direction:column; gap:6px; }
        .gm-rating-bar-row { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--gm-muted); }
        .gm-rating-bar-track { flex:1; height:6px; border-radius:3px; background:var(--gm-border); overflow:hidden; }
        .gm-rating-bar-fill { height:100%; background:var(--gm-gold); border-radius:3px; }
        .gm-rating-bar-count { width:20px; text-align:right; }

        /* recommended */
        .gm-recommended { background:var(--gm-cream); padding:80px 0; }
        @media(max-width:768px){ .gm-recommended{ padding:60px 0; } }
        .gm-eyebrow { font-size:11px; letter-spacing:.2em; text-transform:uppercase; color:var(--gm-gold); margin-bottom:10px; }
        .gm-section-title { font-family:var(--font-display); font-size:30px; font-weight:400; color:var(--gm-walnut); margin-bottom:6px; }
        .gm-section-sub { font-size:14px; color:var(--gm-muted); margin-bottom:40px; }
        .gm-rec-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }
        @media(max-width:1100px){ .gm-rec-grid{ grid-template-columns:repeat(2,1fr); } }
        @media(max-width:600px){ .gm-rec-grid{ grid-template-columns:1fr 1fr; gap:12px; } }
        .gm-rec-card {
          background:#FDFAF6; border-radius:6px; overflow:hidden;
          cursor:pointer; transition:transform .3s ease, box-shadow .3s ease;
          border:1px solid transparent; text-decoration:none; display:block;
        }
        .gm-rec-card:hover { transform:translateY(-4px); box-shadow:0 16px 40px rgba(59,43,31,.10); border-color:var(--gm-gold-light); }
        .gm-rec-img { aspect-ratio:4/3; background:var(--gm-cream); overflow:hidden; position:relative; }
        .gm-rec-img img { width:100%; height:100%; object-fit:cover; transition:transform .6s ease; }
        .gm-rec-card:hover .gm-rec-img img { transform:scale(1.06); }
        .gm-rec-img-placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:40px; }
        .gm-rec-tag {
          position:absolute; bottom:10px; left:10px; font-size:10px;
          letter-spacing:.12em; text-transform:uppercase;
          background:rgba(253,250,246,.9); color:var(--gm-walnut-mid);
          padding:4px 10px; border-radius:20px; backdrop-filter:blur(4px);
        }
        .gm-rec-body { padding:16px 18px 18px; }
        .gm-rec-name { font-family:var(--font-display); font-size:16px; font-weight:400; color:var(--gm-dark); margin-bottom:4px; }
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
type ProductExtra = { imagenes?: { url: string; public_id?: string }[] | null; modelo_3d_url?: string | null };

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
  const { toggleWishlist, isWishlisted } = useWishlist();
  const [wishPending, setWishPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [vista, setVista] = useState<"foto" | "3d">("foto");
  const [leadOpen, setLeadOpen] = useState(false);
  const [ambient, setAmbient] = useState(false);
  const [finishIdx, setFinishIdx] = useState(0);
  const [modPrefs, setModPrefs] = useState<Record<string, string>>({});
  const [showSticky, setShowSticky] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  const profile = useMemo(() => resolveProfile(product), [product]);

  useEffect(() => {
    trackEvent({
      tipo: "producto_visto",
      path: window.location.pathname,
      product_id: product.id,
      valor: product.precio,
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

  const { activa: enOferta, precioFinal: precioMostrado, venceEl } = ofertaInfo(product);
  const outOfStock = (product.stock ?? 1) <= 0;
  const has3D = !!product.modelo_3d_url;
  const esNuevo = Date.now() - new Date(product.created_at).getTime() < 30 * 24 * 60 * 60 * 1000;
  const tieneLed = profile.key === "tv";

  // Opciones elegidas → viajan en el título del ítem (el checkout no cambia) y en cotización / WhatsApp
  const acabado = profile.acabados[finishIdx];
  const prefs: Record<string, string> = { [profile.acabadoLabel]: acabado.name, ...modPrefs };
  const prefsLista = Object.entries(prefs);
  const prefsTexto = prefsLista.map(([k, v]) => `${k}: ${v}`).join(" · ");

  const handleAdd = () => {
    setAdding(true);
    addItem({
      id: product.id,
      title: `${product.nombre} (${Object.values(prefs).join(", ")})`,
      price: precioMostrado,
      image: mainImg ?? "",
      sku: product.sku ?? undefined,
    });
    toast.success("Agregado al carrito", { description: `${product.nombre} · ${Object.values(prefs).join(" · ")}`, position: "top-center" });
    setTimeout(() => setAdding(false), 2000);
  };

  const waHref = WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        `Hola G&M 👋 Me interesa "${product.nombre}"${product.sku ? ` (SKU ${product.sku})` : ""}.\n${prefsTexto}\n${window.location.href}`,
      )}`
    : null;

  const onZoomMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--zx", `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty("--zy", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <>
      <style>{PAGE_CSS}</style>

      <div
        className="min-h-screen bg-background gmx-page"
        style={{ "--gmx-accent": profile.accent, "--gmx-accent-soft": profile.accentSoft } as React.CSSProperties}
      >
        <Header />

        {/* ── breadcrumb ── */}
        <div className="gm-breadcrumb">
          <Link to="/"><ArrowLeft size={12} style={{ marginRight: 4 }} />Volver al catálogo</Link>
          <ChevronRight size={10} />
          {product.categoria && <><span>{product.categoria}</span><ChevronRight size={10} /></>}
          <span style={{ color: "var(--gm-dark)" }}>{product.nombre}</span>
        </div>

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
                <div
                  className={`gm-main-img-wrap gmx-stage${ambient && tieneLed ? " is-night" : ""}`}
                  onMouseMove={onZoomMove}
                >
                  {displayImg
                    ? <img src={displayImg} alt={product.nombre} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>🪑</div>
                  }
                  <div className="gmx-glow" />
                  {product.categoria && <div className="gm-badge-cat">{product.categoria}</div>}
                  {enOferta
                    ? <div className="gm-badge-discount">-{product.descuento_porcentaje}%</div>
                    : esNuevo && <div className="gm-badge-new">Nuevo</div>}
                  <div className="gmx-hint">Pasa el cursor para ampliar</div>
                  {allImgs.length > 1 && <div className="gmx-counter">{activeImg + 1} / {allImgs.length}</div>}
                </div>
              )}

              {vista === "foto" && allImgs.length > 1 && (
                <div className="gm-thumbs">
                  {allImgs.map((src, i) => (
                    <button key={i} type="button" aria-label={`Ver foto ${i + 1}`}
                      className={`gm-thumb${activeImg === i ? " active" : ""}`} onClick={() => setActiveImg(i)}>
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
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
              precioOriginal={product.precio}
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
            <SignatureModule
              profile={profile}
              nombre={product.nombre}
              subcategoria={product.subcategoria}
              setPref={setPref}
              ambient={ambient}
              setAmbient={setAmbient}
            />

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

            {/* acabado */}
            <div className="gm-color-label">
              {profile.acabadoLabel} — <span style={{ color: "var(--gm-dark)", fontWeight: 500 }}>{acabado.name}</span>
            </div>
            <div className="gm-color-row" role="radiogroup" aria-label={profile.acabadoLabel}>
              {profile.acabados.map((c, i) => (
                <button key={c.hex} type="button" role="radio" aria-checked={finishIdx === i} aria-label={c.name}
                  className="gmx-swatch" style={{ background: c.hex }} title={c.name} onClick={() => setFinishIdx(i)} />
              ))}
            </div>

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
                className={`gm-btn-primary${adding ? " adding" : ""}${!adding && !outOfStock ? " gmx-btn-pulse" : ""}`}
                style={{ flex: 1 }}
                onClick={handleAdd}
                disabled={outOfStock}
              >
                <ShoppingBag size={16} />
                {adding ? "¡Agregado!" : outOfStock ? "Agotado" : "Agregar al carrito"}
              </button>
              <button
                type="button"
                className={`gm-btn-wish${isWishlisted(product.id) ? " active" : ""}`}
                disabled={wishPending}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setWishPending(true);
                  const added = await toggleWishlist(product.id);
                  toast.success(added ? `"${product.nombre}" guardado en favoritos` : `"${product.nombre}" eliminado de favoritos`);
                  setWishPending(false);
                }}
                title={isWishlisted(product.id) ? "Quitar de favoritos" : "Guardar en favoritos"}
                aria-label={isWishlisted(product.id) ? "Quitar de favoritos" : "Guardar en favoritos"}
              >
                <Heart size={18} fill={isWishlisted(product.id) ? "var(--gm-gold)" : "none"} />
              </button>
            </div>
            <div className="gm-cta-row">
              <button className="gm-btn-quote" onClick={() => setLeadOpen(true)}>Solicitar cotización personalizada</button>
            </div>
            {waHref && (
              <a className="gmx-wa" href={waHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={17} /> Hablar con un asesor por WhatsApp
              </a>
            )}
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
          base={{ id: product.id, nombre: product.nombre, precio: precioMostrado, image: mainImg, sku: product.sku, categoria: product.categoria }}
        />

        <Footer />

        <StickyBuyBar
          visible={showSticky}
          image={mainImg}
          nombre={product.nombre}
          resumen={Object.values(prefs).join(" · ")}
          precio={precioMostrado}
          disabled={outOfStock}
          adding={adding}
          onAdd={handleAdd}
        />
      </div>
    </>
  );
}
