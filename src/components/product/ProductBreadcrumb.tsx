// src/components/product/ProductBreadcrumb.tsx
// "Ruta de compra" de la ficha de producto. Reemplaza la migaja de texto plano por una barra
// que además de ubicar al cliente le sirve para seguir explorando sin volver atrás:
//   1) Inicio › Categoría › Producto, con áreas táctiles de 36 px y el producto actual marcado,
//   2) la categoría abre un menú para saltar a otro ambiente (sala, comedor, recámara…),
//   3) "Pieza 3 de 8": flechas para pasar a la pieza anterior/siguiente de la MISMA categoría,
//      con vista previa (foto, nombre y precio) al pasar el mouse o enfocar con teclado,
//   4) en móvil colapsa a una sola línea: casa · categoría ▾ · ‹ 3/8 ›.
// Mantiene <nav aria-label> + <ol> + aria-current, y el JSON-LD de migas sigue saliendo de seo.ts.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Home } from "lucide-react";
import { CATEGORIAS, getCategoria } from "@/lib/categories";
import { useProductsByCategory, type Product } from "@/hooks/useProducts";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fmtPEN, ofertaInfo } from "@/lib/pricing";
import "./product-breadcrumb.css";

function miniatura(p: Product): string | null {
  if (p.imagen_public_id) return cloudinaryUrl(p.imagen_public_id, { w: 160, h: 160 });
  return p.imagen_url ?? null;
}

function Vecino({ p, sentido }: { p: Product; sentido: "anterior" | "siguiente" }) {
  const img = miniatura(p);
  const precio = ofertaInfo(p).precioFinal;
  return (
    <Link
      to="/product/$handle"
      params={{ handle: p.id }}
      className="gmb-step"
      aria-label={`Pieza ${sentido}: ${p.nombre}`}
    >
      {sentido === "anterior" ? <ChevronLeft size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
      <span className="gmb-peek" aria-hidden data-lado={sentido}>
        <span className="gmb-peek-img">{img && <img src={img} alt="" loading="lazy" />}</span>
        <span className="gmb-peek-txt">
          <span className="gmb-peek-eyebrow">{sentido === "anterior" ? "Pieza anterior" : "Pieza siguiente"}</span>
          <span className="gmb-peek-name">{p.nombre}</span>
          <span className="gmb-peek-price">{fmtPEN(precio)}</span>
        </span>
      </span>
    </Link>
  );
}

/** "Pieza 3 de 8": navegación entre las piezas de la misma categoría (misma consulta/caché que /categoria/$slug). */
function PiezasPager({ productId, categoria, nombreCategoria }: { productId: string; categoria: string; nombreCategoria?: string }) {
  const { data: piezas } = useProductsByCategory({ categoria });
  const { pos, total, anterior, siguiente } = useMemo(() => {
    const lista = piezas ?? [];
    const i = lista.findIndex((p) => p.id === productId);
    if (i < 0 || lista.length < 2) return { pos: 0, total: 0, anterior: null, siguiente: null };
    return {
      pos: i + 1,
      total: lista.length,
      anterior: lista[(i - 1 + lista.length) % lista.length],
      siguiente: lista[(i + 1) % lista.length],
    };
  }, [piezas, productId]);

  if (!anterior || !siguiente) return null;
  return (
    <div className="gmb-pager" role="group" aria-label={`Más piezas de ${nombreCategoria ?? "esta categoría"}`}>
      <Vecino p={anterior} sentido="anterior" />
      <span className="gmb-count" aria-live="polite">
        <span className="gmb-hide-sm">Pieza </span><b>{pos}</b> de {total}
      </span>
      <Vecino p={siguiente} sentido="siguiente" />
    </div>
  );
}

export function ProductBreadcrumb({
  productId, productName, categoria,
}: {
  productId: string;
  productName: string;
  /** Valor de products.categoria (slug) */
  categoria?: string | null;
}) {
  const cat = categoria ? getCategoria(categoria) : undefined;
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement | null>(null);

  // Cierra el menú al hacer clic fuera, con Escape o al cambiar de producto
  useEffect(() => { setAbierto(false); }, [productId]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto]);

  const CatIcon = cat?.icon;

  return (
    <div className="gmb" ref={raiz}>
      <nav className="gmb-nav" aria-label="Migas de pan">
        <ol className="gmb-trail">
          <li>
            <Link to="/" className="gmb-chip" aria-label="Inicio">
              <Home size={15} aria-hidden />
              <span className="gmb-hide-sm">Inicio</span>
            </Link>
          </li>

          {categoria && (
            <>
              <li className="gmb-sep" aria-hidden />
              <li className="gmb-cat">
                {cat ? (
                  <span className="gmb-split">
                    <Link to="/categoria/$slug" params={{ slug: cat.slug }} className="gmb-chip gmb-chip-cat">
                      {CatIcon && <CatIcon size={15} aria-hidden />}
                      <span className="gmb-cut">{cat.nombre}</span>
                    </Link>
                    <button
                      type="button"
                      className="gmb-caret"
                      aria-haspopup="true"
                      aria-expanded={abierto}
                      aria-controls="gmb-menu"
                      aria-label="Explorar otros ambientes"
                      onClick={() => setAbierto((v) => !v)}
                    >
                      <ChevronDown size={14} aria-hidden data-abierto={abierto} />
                    </button>
                  </span>
                ) : (
                  <span className="gmb-chip gmb-chip-plain">{categoria}</span>
                )}

                {abierto && (
                  <div className="gmb-menu" id="gmb-menu">
                    <p className="gmb-menu-title">Seguir explorando</p>
                    <ul>
                      {CATEGORIAS.map((c) => {
                        const Icono = c.icon;
                        const actual = c.slug === cat?.slug;
                        return (
                          <li key={c.slug}>
                            <Link
                              to="/categoria/$slug"
                              params={{ slug: c.slug }}
                              className="gmb-opt"
                              aria-current={actual ? "true" : undefined}
                              onClick={() => setAbierto(false)}
                            >
                              <Icono size={16} aria-hidden />
                              <span>{c.nombre}</span>
                              {actual && <Check size={14} aria-hidden className="gmb-opt-ok" />}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    <Link to="/catalogo" className="gmb-all" onClick={() => setAbierto(false)}>
                      Ver todo el catálogo
                    </Link>
                  </div>
                )}
              </li>
            </>
          )}

          <li className="gmb-sep gmb-sep-now" aria-hidden />
          <li className="gmb-now" aria-current="page">
            <span className="gmb-dot" aria-hidden />
            <span className="gmb-cut gmb-now-name">{productName}</span>
          </li>
        </ol>
      </nav>

      {categoria && <PiezasPager productId={productId} categoria={categoria} nombreCategoria={cat?.nombre} />}
    </div>
  );
}
