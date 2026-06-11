import { useState } from "react";
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
import { ShoppingBag, Minus, Plus, Trash2, LogIn } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { useAuth } from "@/hooks/useAuth";
import { LoginModal } from "./LoginModal";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

export const CartDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const { items, updateQty, removeItem, total, clearCart } = useCartStore();
  const { user } = useAuth();
  const totalItems = items.reduce((s, i) => s + i.qty, 0);

  const handleCheckout = () => {
    if (!user) {
      // Close cart drawer and open login modal
      setIsOpen(false);
      setLoginOpen(true);
      return;
    }
    setIsOpen(false);
    window.location.href = "/checkout";
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="relative rounded-full border-border/60">
            <ShoppingBag className="h-5 w-5" />
            {totalItems > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-accent text-accent-foreground">
                {totalItems}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-lg flex flex-col h-full bg-background">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="font-display text-2xl">Tu carrito</SheetTitle>
            <SheetDescription>
              {totalItems === 0
                ? "Aún no has agregado productos"
                : `${totalItems} producto${totalItems !== 1 ? "s" : ""} en tu carrito`}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col flex-1 pt-6 min-h-0">
            {items.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Carrito vacío</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto pr-2 min-h-0">
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex gap-4 p-3 rounded-lg bg-card border border-border/50">
                        <div className="w-20 h-20 bg-secondary/40 rounded-md overflow-hidden flex-shrink-0">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate text-foreground">{item.title}</h4>
                          {item.sku && (
                            <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                          )}
                          <p className="font-semibold mt-1 text-foreground">{fmt(item.price)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQty(item.id, item.qty - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm">{item.qty}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQty(item.id, item.qty + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 space-y-4 pt-4 border-t border-border bg-background">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Total</span>
                    <span className="text-2xl font-display font-semibold">{fmt(total())}</span>
                  </div>
                  {!user && (
                    <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                      <LogIn className="h-3 w-3" />
                      Debes iniciar sesión para comprar
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={clearCart}
                    >
                      Vaciar carrito
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleCheckout}
                    >
                      {user ? "Comprar ahora" : "Iniciar sesión"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Login modal — triggered when user tries to checkout without being logged in */}
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} onSuccess={() => { setLoginOpen(false); window.location.href = "/checkout"; }} />
    </>
  );
};