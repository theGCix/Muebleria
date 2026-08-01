// src/components/ProductCard.tsx
import { Link } from "@tanstack/react-router";
import { useCartStore } from "@/stores/cartStore";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Image, Heart, Check } from "lucide-react";
import { toast } from "sonner";
import { cloudinaryUrl } from "@/lib/cloudinary";
import type { Product } from "@/hooks/useProducts";
import { useWishlist } from "@/context/WishlistContext";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { LoginModal } from "./LoginModal";
import { fmtPEN, ofertaInfo, textoCuentaRegresiva } from "@/lib/pricing";

interface Props { product: Product; }

export function ProductCard({ product: p }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);
  const { user } = useAuth();
  const { toggleWishlist, isWishlisted } = useWishlist();
  const [loginOpen, setLoginOpen] = useState(false);
  const [wishPending, setWishPending] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const enCarrito = items.some((i) => i.id === p.id);

  const fmt = fmtPEN;
  const { activa: enOferta, precioFinal: precioOferta, venceEl } = ofertaInfo(p);
  const cuentaRegresiva = enOferta ? textoCuentaRegresiva(venceEl) : null;

  const imgSrc = p.imagen_public_id
    ? cloudinaryUrl(p.imagen_public_id, { w: 400, h: 300 })
    : p.imagen_url;

  const wishlisted = isWishlisted(p.id);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      id: p.id,
      title: p.nombre,
      price: precioOferta,
      image: imgSrc ?? "",
      sku: p.sku ?? undefined,
    });
    toast.success(`"${p.nombre}" añadido al carrito`);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setWishPending(true);
    const added = await toggleWishlist(p.id);
    toast.success(
      added ? `"${p.nombre}" guardado en favoritos` : `"${p.nombre}" eliminado de favoritos`
    );
    setWishPending(false);
  };

  return (
    <>
      <Link to="/product/$handle" params={{ handle: p.id }} className="group block">
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden hover:shadow-lg transition-all duration-300">
          <div className="aspect-[4/3] overflow-hidden bg-muted relative">
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

            {/* Badge de descuento */}
            {enOferta && (
              <span className="absolute top-2 left-2 rounded-full bg-destructive text-destructive-foreground text-xs font-bold px-2.5 py-1 shadow-sm">
                -{p.descuento_porcentaje}%
              </span>
            )}

            {/* Botón corazón — refleja estado en tiempo real desde el contexto compartido */}
            <button
              type="button"
              onClick={handleWishlist}
              disabled={wishPending}
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-background transition-colors disabled:opacity-50"
              title={wishlisted ? "Quitar de favoritos" : "Guardar en favoritos"}
            >
              <Heart
                className={`h-4 w-4 transition-all duration-200 ${
                  wishlisted
                    ? "fill-destructive text-destructive scale-110"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          </div>

          <div className="p-4">
            {p.categoria && (
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{p.categoria}</span>
            )}
            <h3 className="font-semibold mt-1 line-clamp-2">{p.nombre}</h3>
            {p.descripcion && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.descripcion}</p>
            )}
            <div className="mt-3 flex flex-col gap-2">
              {enOferta ? (
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-bold text-lg text-destructive">{fmt(precioOferta)}</span>
                  <span className="text-sm text-muted-foreground line-through">{fmt(p.precio)}</span>
                  {cuentaRegresiva && (
                    <span className="text-[11px] font-medium text-destructive/80">{cuentaRegresiva}</span>
                  )}
                </div>
              ) : (
                <span className="font-bold text-lg">{fmt(p.precio)}</span>
              )}
              <button
                type="button"
                onClick={handleAdd}
                disabled={(p.stock ?? 1) <= 0 || enCarrito}
                className={`group/btn relative w-full flex items-center gap-2.5 rounded-full pl-1.5 pr-4 py-1.5 transition-all duration-300 ${
                  (p.stock ?? 1) <= 0
                    ? "bg-muted text-muted-foreground cursor-default"
                    : enCarrito
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                    : "bg-primary text-primary-foreground shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                }`}
              >
                <span
                  className={`relative flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    (p.stock ?? 1) <= 0
                      ? "bg-muted-foreground/10"
                      : enCarrito
                      ? "bg-emerald-100"
                      : "bg-white/15 group-hover/btn:bg-white/25"
                  }`}
                >
                  {justAdded && (
                    <span className="absolute inset-0 rounded-full bg-white/50 animate-ping" />
                  )}
                  {(p.stock ?? 1) <= 0 ? (
                    <ShoppingBag className="h-3.5 w-3.5" />
                  ) : enCarrito ? (
                    <Check className="h-3.5 w-3.5 animate-in zoom-in-50 duration-300" />
                  ) : (
                    <ShoppingBag className="h-3.5 w-3.5 transition-transform duration-300 group-hover/btn:-rotate-12 group-hover/btn:scale-110" />
                  )}
                </span>
                <span className="text-sm font-medium">
                  {(p.stock ?? 1) <= 0 ? "Agotado" : enCarrito ? "En el carrito" : "Agregar al carrito"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </Link>

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}