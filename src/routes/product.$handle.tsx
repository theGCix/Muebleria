import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useProduct, useProducts } from "@/hooks/useProducts";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Loader2, ArrowLeft, Heart, ShoppingBag, ChevronRight, Shield, Truck, Hammer, Star } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { cloudinaryUrl } from "@/lib/cloudinary";

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

function Tabs({ product }: { product: ReturnType<typeof useProduct>["data"] }) {
  const [active, setActive] = useState(0);

  const specs = [
    ["Modelo", product?.nombre ?? "—"],
    ["Categoría", product?.categoria ?? "—"],
    ["Precio", product ? fmt(product.precio) : "—"],
    ["SKU", product?.sku ?? "—"],
    ["Garantía", "2 años en estructura"],
  ];

  const reviews = [
    { name: "María C.", loc: "Lima", stars: 5, text: "Hermoso juego de sala, los cojines y el tapizado son de excelente calidad. La entrega fue puntual y el armado muy prolijo." },
    { name: "Pamela R.", loc: "San Isidro", stars: 4, text: "El diseño es precioso y combina perfecto con mi sala. Solo le bajo una estrella porque tardó un poco más de lo esperado en llegar." },
    { name: "Lucía B.", loc: "Miraflores", stars: 5, text: "Muy buena relación calidad-precio para ser hecho a mano en Perú. El acabado premium se nota en cada detalle." },
  ];

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
                {["Fabricado artesanalmente en Perú", "Estructura de madera tornillo seca y tratada", "Tapizado en velvet importado + tela antifluida", "Relleno en espuma de alta densidad", "Patas de metal dorado o negro a elección", "Cojines decorativos incluidos", "Garantía de 2 años en estructura"].map(item => (
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
          <div className="gm-reviews-grid">
            {reviews.map(r => (
              <div key={r.name} className="gm-review-card">
                <div className="gm-stars-row">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={13} fill={i < r.stars ? "var(--gm-gold)" : "none"} color={i < r.stars ? "var(--gm-gold)" : "var(--gm-border)"} />
                  ))}
                </div>
                <p className="gm-review-text">"{r.text}"</p>
                <div className="gm-review-author">— {r.name} · {r.loc}</div>
              </div>
            ))}
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

/* ─── recommended products ────────────────────────── */
function Recommended({ currentId }: { currentId: string }) {
  const { data: products } = useProducts(8);
  const addItem = useCartStore((s) => s.addItem);

  const others = (products ?? []).filter(p => p.id !== currentId).slice(0, 4);
  if (!others.length) return null;

  return (
    <section className="gm-recommended">
      <div className="gm-container">
        <p className="gm-eyebrow">Colección seleccionada</p>
        <h2 className="gm-section-title">Te podría interesar</h2>
        <p className="gm-section-sub">Piezas que complementan perfectamente tu elección</p>

        <div className="gm-rec-grid">
          {others.map(p => {
            const img = p.imagen_public_id
              ? cloudinaryUrl(p.imagen_public_id, { w: 600, h: 450 })
              : p.imagen_url;

            return (
              <Link key={p.id} to="/product/$handle" params={{ handle: p.id }} className="gm-rec-card">
                <div className="gm-rec-img">
                  {img
                    ? <img src={img} alt={p.nombre} loading="lazy" />
                    : <div className="gm-rec-img-placeholder">🪑</div>
                  }
                  {p.categoria && <span className="gm-rec-tag">{p.categoria}</span>}
                </div>
                <div className="gm-rec-body">
                  <div className="gm-rec-name">{p.nombre}</div>
                  {p.descripcion && <p className="gm-rec-desc">{p.descripcion}</p>}
                  <div className="gm-rec-footer">
                    <span className="gm-rec-price">{fmt(p.precio)}</span>
                    <button
                      className="gm-rec-btn"
                      onClick={e => {
                        e.preventDefault();
                        addItem({ id: p.id, title: p.nombre, price: p.precio, image: img ?? "", sku: p.sku ?? undefined });
                        toast.success(`"${p.nombre}" añadido al carrito`);
                      }}
                    >+</button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── main product page ───────────────────────────── */
function ProductPage() {
  const { handle } = Route.useParams();
  const { data: product, isLoading } = useProduct(handle);
  const addItem = useCartStore((s) => s.addItem);
  const [wished, setWished] = useState(false);
  const [adding, setAdding] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

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

  const mainImg = product.imagen_public_id
    ? cloudinaryUrl(product.imagen_public_id, { w: 900, h: 900 })
    : product.imagen_url;

  // Generar variantes de imagen con distintas transformaciones
  const thumbImgs = product.imagen_public_id
    ? [
        cloudinaryUrl(product.imagen_public_id, { w: 900, h: 900 }),
        cloudinaryUrl(product.imagen_public_id, { w: 900, h: 900, q: 75 }),
        cloudinaryUrl(product.imagen_public_id, { w: 900, h: 900 }),
      ]
    : product.imagen_url
    ? [product.imagen_url]
    : [];

  const displayImg = thumbImgs[activeImg] ?? mainImg;

  const handleAdd = () => {
    setAdding(true);
    addItem({
      id: product.id,
      title: product.nombre,
      price: product.precio,
      image: mainImg ?? "",
      sku: product.sku ?? undefined,
    });
    toast.success("Agregado al carrito", { description: product.nombre, position: "top-center" });
    setTimeout(() => setAdding(false), 2000);
  };

  const outOfStock = (product.stock ?? 1) <= 0;

  return (
    <>
      {/* ── scoped styles ── */}
      <style>{`
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
        .gm-thumbs { display:flex; gap:10px; margin-top:12px; }
        .gm-thumb {
          width:72px; height:72px; border-radius:2px; overflow:hidden;
          cursor:pointer; border:2px solid transparent;
          transition:border-color .2s; background:var(--gm-cream); flex-shrink:0;
        }
        .gm-thumb.active { border-color:var(--gm-walnut); }
        .gm-thumb img { width:100%; height:100%; object-fit:cover; }

        /* info col */
        .gm-info-col { padding-left:16px; }
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
        .gm-spec-icon { font-size:18px; color:var(--gm-gold); flex-shrink:0; margin-top:1px; }
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
      `}</style>

      <div className="min-h-screen bg-background">
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
            <div className="gm-main-img-wrap">
              {displayImg
                ? <img src={displayImg} alt={product.nombre} />
                : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>🪑</div>
              }
              {product.categoria && <div className="gm-badge-cat">{product.categoria}</div>}
              <div className="gm-badge-new">Nuevo</div>
            </div>

            {thumbImgs.length > 1 && (
              <div className="gm-thumbs">
                {thumbImgs.map((src, i) => (
                  <div key={i} className={`gm-thumb${activeImg === i ? " active" : ""}`} onClick={() => setActiveImg(i)}>
                    <img src={src} alt="" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* info */}
          <div className="gm-info-col">
            {product.sku && <div className="gm-sku">SKU: {product.sku}</div>}
            <h1 className="gm-product-title">{product.nombre}</h1>
            {product.categoria && <p className="gm-product-sub">Colección {product.categoria} · 2025</p>}

            {/* rating */}
            <div className="gm-rating-row">
              <div className="gm-stars-row">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} fill={i < 4 ? "var(--gm-gold)" : "none"} color={i < 4 ? "var(--gm-gold)" : "var(--gm-border)"} />
                ))}
              </div>
              <span className="gm-rating-text">4.0 · 38 reseñas</span>
            </div>

            {/* price */}
            <div className="gm-price-block">
              <span className="gm-price-main">{fmt(product.precio)}</span>
              {outOfStock && <span style={{ fontSize: 13, background: "#fde8e8", color: "#b91c1c", padding: "3px 10px", borderRadius: 20 }}>Agotado</span>}
            </div>
            <p className="gm-price-note">Precio incluye IGV · Entrega a domicilio disponible</p>

            <div className="gm-divider" />

            {/* specs pills */}
            <div className="gm-specs-label">Materiales y construcción</div>
            <div className="gm-specs-grid">
              {[
                { icon: "🪵", label: "Estructura", val: "Madera tornillo seca y tratada" },
                { icon: "🧶", label: "Tapizado", val: "Velvet importado + antifluida" },
                { icon: "✨", label: "Relleno", val: "Espuma alta densidad + napa" },
                { icon: "🦵", label: "Patas", val: "Metal dorado/negro moderno" },
              ].map(s => (
                <div key={s.label} className="gm-spec-pill">
                  <span className="gm-spec-icon">{s.icon}</span>
                  <div>
                    <div className="gm-spec-pill-label">{s.label}</div>
                    <div className="gm-spec-pill-val">{s.val}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* color picker */}
            <div className="gm-color-label">Color</div>
            <ColorPicker />

            {/* includes */}
            <div className="gm-includes-label">El juego incluye</div>
            <div className="gm-includes-grid">
              {["Sofá 3 cuerpos", "Sofá 2 cuerpos", "Sillón butaca", "Puff redondo", "Cojines decorativos"].map(t => (
                <div key={t} className="gm-includes-tag"><div className="gm-tag-dot" />{t}</div>
              ))}
            </div>

            {/* description */}
            {product.descripcion && (
              <>
                <div className="gm-specs-label" style={{ marginBottom: 8 }}>Descripción</div>
                <p style={{ fontSize: 13, color: "var(--gm-mid)", lineHeight: 1.75, marginBottom: 24, whiteSpace: "pre-line" }}>
                  {product.descripcion}
                </p>
              </>
            )}

            {/* CTA */}
            <div className="gm-cta-row">
              <button
                className={`gm-btn-primary${adding ? " adding" : ""}`}
                style={{ flex: 1 }}
                onClick={handleAdd}
                disabled={outOfStock}
              >
                <ShoppingBag size={16} />
                {adding ? "¡Agregado!" : outOfStock ? "Agotado" : "Agregar al carrito"}
              </button>
              <button
                className={`gm-btn-wish${wished ? " active" : ""}`}
                onClick={() => setWished(!wished)}
                title="Guardar en favoritos"
              >
                <Heart size={18} fill={wished ? "var(--gm-gold)" : "none"} />
              </button>
            </div>
            <div className="gm-cta-row">
              <button className="gm-btn-quote">Solicitar cotización personalizada</button>
            </div>

            <div className="gm-divider" />

            {/* trust */}
            <div className="gm-trust-strip">
              <div className="gm-trust-item"><Hammer size={16} color="var(--gm-gold)" />Hecho a mano</div>
              <div className="gm-trust-item"><Shield size={16} color="var(--gm-gold)" />Garantía 2 años</div>
              <div className="gm-trust-item"><Truck size={16} color="var(--gm-gold)" />Envío a domicilio</div>
            </div>

            {/* accordion */}
            <div style={{ marginTop: 24 }}>
              <AccordionItem title="Cuidado y mantenimiento">
                Limpie con paño húmedo sin químicos agresivos. Evite exposición directa al sol. Para el velvet, use un cepillo suave en dirección del pelo del tejido. La estructura de madera puede aceitarse anualmente para mantener su durabilidad.
              </AccordionItem>
              <AccordionItem title="Tiempos de entrega">
                Lima Metropolitana: 5–7 días hábiles. Provincias: 10–15 días hábiles. Este modelo es fabricado a pedido — se coordina fecha de entrega al confirmar la compra.
              </AccordionItem>
              <AccordionItem title="Política de devoluciones">
                Al ser un producto fabricado a medida, no se aceptan cambios una vez confirmado el pedido. En caso de defecto de fabricación, realizamos la reparación o reposición sin costo dentro del período de garantía.
              </AccordionItem>
            </div>
          </div>
        </div>

        {/* ── tabs ── */}
        <Tabs product={product} />

        {/* ── recommended ── */}
        <Recommended currentId={product.id} />

        <Footer />
      </div>
    </>
  );
}

/* ─── color picker (controlled internally) ────────── */
const COLORS = [
  { hex: "#E8D5CC", name: "Rosado blush" },
  { hex: "#E8E0D0", name: "Beige arena" },
  { hex: "#C8BFB5", name: "Gris topo" },
  { hex: "#D4C5A9", name: "Crema marfil" },
  { hex: "#B8A898", name: "Mocha" },
];

function ColorPicker() {
  const [selected, setSelected] = useState(0);
  return (
    <>
      <div className="gm-color-label">
        Color — <span style={{ color: "var(--gm-dark)", fontWeight: 500 }}>{COLORS[selected].name}</span>
      </div>
      <div className="gm-color-row">
        {COLORS.map((c, i) => (
          <div
            key={c.hex}
            className={`gm-swatch${selected === i ? " active" : ""}`}
            style={{ background: c.hex }}
            title={c.name}
            onClick={() => setSelected(i)}
          />
        ))}
      </div>
    </>
  );
}