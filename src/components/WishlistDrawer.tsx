// src/components/WishlistDrawer.tsx
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Heart, Trash2, ShoppingBag, LogIn, Loader2 } from "lucide-react";
import { useWishlist } from "@/hooks/useWishlist";
import { useCartStore } from "@/stores/cartStore";
import { useAuth } from "@/hooks/useAuth";
import { LoginModal } from "./LoginModal";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { toast } from "sonner";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

export function WishlistDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const { user } = useAuth();
  const { items, loading, removeFromWishlist } = useWishlist();
  const addItem = useCartStore((s) => s.addItem);

  const handleAddToCart = (item: typeof items[0]) => {
    const imgSrc = item.product.imagen_public_id
      ? cloudinaryUrl(item.product.imagen_public_id, { w: 400, h: 300 })
      : item.product.imagen_url;
    addItem({
      id: item.product.id,
      title: item.product.nombre,
      price: item.product.precio,
      image: imgSrc ?? "",
      sku: item.product.sku ?? undefined,
    });
    toast.success(`"${item.product.nombre}" añadido al carrito`);
  };

  const handleRemove = async (productId: string, nombre: string) => {
    await removeFromWishlist(productId);
    toast.success(`"${nombre}" eliminado de favoritos`);
  };

  // Si no hay sesión, el botón abre el login
  const handleOpenDrawer = () => {
    if (!user) {
      setLoginOpen(true);
    } else {
      setIsOpen(true);
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="relative rounded-full border-border/60"
            onClick={handleOpenDrawer}
            // evita que el Sheet se abra directamente si no hay sesión
            onPointerDown={(e) => { if (!user) e.preventDefault(); }}
          >
            <Heart className="h-5 w-5" />
            {user && items.length > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-destructive text-destructive-foreground">
                {items.length}
              </Badge>
            )}
          </Button>
        </SheetTrigger>

        <SheetContent className="w-full sm:max-w-lg flex flex-col h-full bg-background">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="font-display text-2xl flex items-center gap-2">
              <Heart className="h-5 w-5 text-destructive fill-destructive" />
              Mis favoritos
            </SheetTitle>
            <SheetDescription>
              {loading
                ? "Cargando..."
                : items.length === 0
                ? "Aún no tienes productos guardados"
                : `${items.length} producto${items.length !== 1 ? "s" : ""} guardado${items.length !== 1 ? "s" : ""}`}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col flex-1 pt-6 min-h-0">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Heart className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">Sin favoritos todavía</p>
                  <p className="text-sm text-muted-foreground">
                    Toca el corazón en cualquier producto para guardarlo aquí
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2 min-h-0">
                <div className="space-y-4">
                  {items.map((item) => {
                    const imgSrc = item.product.imagen_public_id
                      ? cloudinaryUrl(item.product.imagen_public_id, { w: 200, h: 200 })
                      : item.product.imagen_url;
                    return (
                      <div
                        key={item.id}
                        className="flex gap-4 p-3 rounded-lg bg-card border border-border/50"
                      >
                        {/* Imagen */}
                        <Link
                          to="/product/$handle"
                          params={{ handle: item.product_id }}
                          onClick={() => setIsOpen(false)}
                          className="w-20 h-20 bg-secondary/40 rounded-md overflow-hidden flex-shrink-0"
                        >
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={item.product.nombre}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </Link>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <Link
                            to="/product/$handle"
                            params={{ handle: item.product_id }}
                            onClick={() => setIsOpen(false)}
                            className="font-medium truncate text-foreground hover:underline block"
                          >
                            {item.product.nombre}
                          </Link>
                          {item.product.categoria && (
                            <p className="text-xs text-muted-foreground capitalize">
                              {item.product.categoria}
                            </p>
                          )}
                          <p className="font-semibold mt-1">{fmt(item.product.precio)}</p>
                        </div>

                        {/* Acciones */}
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemove(item.product_id, item.product.nombre)}
                            title="Eliminar de favoritos"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full text-xs"
                            disabled={(item.product.stock ?? 1) <= 0}
                            onClick={() => handleAddToCart(item)}
                          >
                            <ShoppingBag className="h-3 w-3 mr-1" />
                            {(item.product.stock ?? 1) <= 0 ? "Agotado" : "Al carrito"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}