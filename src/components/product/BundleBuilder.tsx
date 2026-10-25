// src/components/product/BundleBuilder.tsx
// "Completa el ambiente": arma un conjunto con otras piezas y agrégalo de un toque.
// Sin descuentos inventados: el total es la suma real de precios vigentes.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCartStore } from "@/stores/cartStore";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { fmtPEN, ofertaInfo } from "@/lib/pricing";
import type { ProductProfile } from "@/lib/productProfiles";
import "./product-experience.css";

interface Base { id: string; nombre: string; precio: number; image: string | null; sku: string | null; categoria: string | null }

async function fetchComplementarios(currentId: string, categoria: string | null) {
  let q = supabase.from("products").select("*").eq("activo", true).neq("id", currentId).limit(3);
  if (categoria) q = q.neq("categoria", categoria);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function BundleBuilder({ base, profile }: { base: Base; profile: ProductProfile }) {
  const { data: others } = useQuery({
    queryKey: ["complementarios", base.id, base.categoria],
    queryFn: () => fetchComplementarios(base.id, base.categoria),
    staleTime: 300_000,
  });
  const addItems = useCartStore((s) => s.addItems);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const items = useMemo(
    () => (others ?? []).map((p) => {
      const img = p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 600, h: 450 }) : p.imagen_url;
      return { p, img: img as string | null, precio: ofertaInfo(p).precioFinal };
    }),
    [others],
  );

  if (!items.length) return null;

  const elegidos = items.filter((i) => sel.has(i.p.id));
  const total = base.precio + elegidos.reduce((s, i) => s + i.precio, 0);
  const toggle = (id: string) => setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const addAll = () => {
    addItems([
      { id: base.id, title: base.nombre, price: base.precio, image: base.image ?? "", sku: base.sku ?? undefined },
      ...elegidos.map((i) => ({ id: i.p.id, title: i.p.nombre, price: i.precio, image: i.img ?? "", sku: i.p.sku ?? undefined })),
    ]);
    toast.success(`${1 + elegidos.length} piezas agregadas al carrito`, { position: "top-center" });
  };

  return (
    <section className="gmx-bundle">
      <div className="gm-container">
        <p className="gm-eyebrow" style={{ color: "var(--gmx-accent)" }}>Completa el ambiente</p>
        <h2 className="gm-section-title">{profile.bundleTitle}</h2>
        <p className="gm-section-sub">{profile.bundleSub}</p>

        <div className="gmx-bundle-grid">
          <div className="gmx-bcard fixed" aria-label="Este producto, incluido">
            <span className="gmx-bcheck">✓</span>
            <div className="gmx-bimg">{base.image && <img src={base.image} alt="" />}</div>
            <div className="gmx-bbody">
              <div className="gmx-bname">{base.nombre}</div>
              <div style={{ fontSize: 11, color: "var(--gm-muted)" }}>Tu elección</div>
              <div className="gmx-bprice">{fmtPEN(base.precio)}</div>
            </div>
          </div>

          {items.map(({ p, img, precio }) => (
            <button key={p.id} type="button" className="gmx-bcard" aria-pressed={sel.has(p.id)} onClick={() => toggle(p.id)}>
              <span className="gmx-bcheck">{sel.has(p.id) ? "✓" : "+"}</span>
              <div className="gmx-bimg">{img && <img src={img} alt="" loading="lazy" />}</div>
              <div className="gmx-bbody">
                <div className="gmx-bname">{p.nombre}</div>
                {p.categoria && <div style={{ fontSize: 11, color: "var(--gm-muted)", textTransform: "capitalize" }}>{p.categoria}</div>}
                <div className="gmx-bprice">{fmtPEN(precio)}</div>
                <Link to="/product/$handle" params={{ handle: p.id }} onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: 11, color: "var(--gmx-accent)", textDecoration: "underline", marginTop: 2 }}>
                  Ver detalle
                </Link>
              </div>
            </button>
          ))}
        </div>

        <div className="gmx-bar">
          <div className="gmx-bar-total">
            {elegidos.length === 0 ? "Elige las piezas que quieras sumar" : `Conjunto de ${1 + elegidos.length} piezas`}
            <b>{fmtPEN(total)}</b>
          </div>
          <button className="gm-btn-primary" onClick={addAll} disabled={elegidos.length === 0} style={{ opacity: elegidos.length ? 1 : .5 }}>
            <ShoppingBag size={16} />
            {elegidos.length ? `Agregar las ${1 + elegidos.length} al carrito` : "Agregar conjunto"}
          </button>
        </div>
      </div>
    </section>
  );
}
