// src/components/ComboCard.tsx
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingBag, Image as ImageIcon, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { useCartStore } from "@/stores/cartStore";
import { fmtPEN } from "@/lib/pricing";
import { precioNormalCombo, type Combo } from "@/hooks/useCombos";

interface Props { combo: Combo; }

export function ComboCard({ combo }: Props) {
  const addItems = useCartStore((s) => s.addItems);
  const items = useCartStore((s) => s.items);
  const [adding, setAdding] = useState(false);

  const precioNormal = precioNormalCombo(combo);
  const ahorro = precioNormal - combo.precio_combo;
  const factor = precioNormal > 0 ? combo.precio_combo / precioNormal : 1;

  const yaEnCarrito = combo.combo_items.every((it) =>
    items.some((c) => c.id === it.product_id && c.comboId === combo.id)
  );

  const agotado = combo.combo_items.some((it) => (it.products.stock ?? 1) <= 0);

  const thumbs = combo.combo_items.slice(0, 3).map((it) =>
    it.products.imagen_public_id
      ? cloudinaryUrl(it.products.imagen_public_id, { w: 200, h: 200 })
      : it.products.imagen_url
  );

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAdding(true);
    // Reparte el precio del combo entre los productos, proporcional al
    // precio individual de cada uno, para que cada línea del carrito
    // siga apuntando a un product_id real (necesario para el checkout).
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
    <Link
      to="/combo/$id"
      params={{ id: combo.id }}
      className="bg-card rounded-xl border-2 border-accent/30 overflow-hidden hover:shadow-lg transition-all duration-300 relative block group"
    >
      <span className="absolute top-3 left-3 z-10 rounded-full bg-accent text-accent-foreground text-xs font-bold px-2.5 py-1 shadow-sm flex items-center gap-1">
        <PackageCheck className="h-3 w-3" /> Combo
      </span>

      <div className="aspect-[4/3] bg-muted relative flex">
        {thumbs.length > 0 ? (
          thumbs.map((src, i) => (
            <div key={i} className="flex-1 overflow-hidden border-r border-background last:border-r-0">
              {src ? (
                <img src={src} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageIcon className="h-12 w-12" />
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold line-clamp-2">{combo.nombre}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Incluye: {combo.combo_items.map((it) => it.products.nombre).join(" + ")}
        </p>

        <div className="mt-3 flex items-baseline gap-2 flex-wrap">
          <span className="font-bold text-xl text-accent">{fmtPEN(combo.precio_combo)}</span>
          <span className="text-sm text-muted-foreground line-through">{fmtPEN(precioNormal)}</span>
        </div>
        {ahorro > 0 && (
          <span className="inline-block mt-1 text-xs font-medium bg-accent/10 text-accent rounded-full px-2 py-0.5">
            Ahorras {fmtPEN(ahorro)}
          </span>
        )}

        <Button
          size="sm"
          onClick={handleAdd}
          disabled={adding || agotado || yaEnCarrito}
          className="rounded-full w-full mt-3"
        >
          {agotado ? (
            "Un producto del combo está agotado"
          ) : yaEnCarrito ? (
            "Combo en el carrito"
          ) : (
            <><ShoppingBag className="h-3.5 w-3.5 mr-1" /> Agregar combo</>
          )}
        </Button>
      </div>
    </Link>
  );
}