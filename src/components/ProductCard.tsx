import { Link } from "@tanstack/react-router";
import { useCartStore } from "@/stores/cartStore";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Image } from "lucide-react";
import { toast } from "sonner";
import { cloudinaryUrl } from "@/lib/cloudinary";
import type { Product } from "@/hooks/useProducts";
import { useEventTracking } from "@/hooks/useEventTracking";


interface Props { product: Product; }

export function ProductCard({ product: p }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

  const imgSrc = p.imagen_public_id
    ? cloudinaryUrl(p.imagen_public_id, { w: 400, h: 300 })
    : p.imagen_url;

  const { trackEvent } = useEventTracking();

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (addItem.length === 0) { // o maneja la lógica de "primer item" aquí
    trackEvent({ tipo: "carrito_iniciado", valor: p.precio });
  }
    addItem({
      id: p.id,
      title: p.nombre,
      price: p.precio,
      image: imgSrc ?? "",
      sku: p.sku ?? undefined,
    });
    toast.success(`"${p.nombre}" añadido al carrito`);
  };

  return (
    <Link to="/product/$handle" params={{ handle: p.id }} className="group block">
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden hover:shadow-lg transition-all duration-300">
        <div className="aspect-[4/3] overflow-hidden bg-muted">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={p.nombre}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Image className="h-12 w-12" />
            </div>
          )}
        </div>
        <div className="p-4">
          {p.categoria && (
            <span className="text-xs text-muted-foreground uppercase tracking-wider">{p.categoria}</span>
          )}
          <h3 className="font-semibold mt-1 line-clamp-2">{p.nombre}</h3>
          {p.descripcion && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.descripcion}</p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="font-bold text-lg">{fmt(p.precio)}</span>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={(p.stock ?? 1) <= 0}
              className="rounded-full"
            >
              <ShoppingBag className="h-3.5 w-3.5 mr-1" />
              {(p.stock ?? 1) <= 0 ? "Agotado" : "Agregar"}
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}