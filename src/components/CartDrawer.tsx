import { useMemo, useState } from "react";
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
import { ShoppingBag, Minus, Plus, Trash2, PackageCheck } from "lucide-react";
import { useCartStore, type CartItem } from "@/stores/cartStore";
import { useAuth } from "@/hooks/useAuth";
import { LoginModal } from "./LoginModal";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

type Grupo =
  | { tipo: "combo"; comboId: string; label: string; items: CartItem[] }
  | { tipo: "item"; item: CartItem };

/** "Combo mes morado" se muestra tal cual; "Sala moderna" pasa a "Combo Sala moderna". */
const tituloCombo = (label: string) => (/^combo\b/i.test(label.trim()) ? label.trim() : `Combo ${label.trim()}`);

function ItemFila({
  item,
  onRemove,
  onQty,
}: {
  item: CartItem;
  onRemove: () => void;
  onQty: (qty: number) => void;
}) {
  return (
    <div className="flex gap-4 p-3 rounded-lg bg-card border border-border/50">
      <div className="w-20 h-20 bg-secondary/40 rounded-md overflow-hidden flex-shrink-0">
        {item.image ? (
          <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium truncate text-foreground">{item.title}</h4>
        {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
        <p className="font-semibold mt-1 text-foreground">{fmt(item.price)}</p>
      </div>
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onQty(item.qty - 1)}>
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center text-sm">{item.qty}</span>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onQty(item.qty + 1)}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export const CartDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const { items, updateQty, removeItem, removeCombo, total, clearCart } = useCartStore();
  const { user } = useAuth();

  // Las piezas que entraron con un combo se agrupan en una sola tarjeta; el resto queda igual.
  const grupos = useMemo<Grupo[]>(() => {
    const out: Grupo[] = [];
    const idx = new Map<string, number>();
    for (const it of items) {
      if (it.comboId) {
        const pos = idx.get(it.comboId);
        if (pos === undefined) {
          idx.set(it.comboId, out.length);
          out.push({ tipo: "combo", comboId: it.comboId, label: it.comboLabel ?? "", items: [it] });
        } else {
          (out[pos] as Extract<Grupo, { tipo: "combo" }>).items.push(it);
        }
      } else {
        out.push({ tipo: "item", item: it });
      }
    }
    return out;
  }, [items]);

  // Un combo cuenta como 1 producto, no como cada una de sus piezas.
  const totalItems = grupos.reduce((s, g) => s + (g.tipo === "combo" ? 1 : g.item.qty), 0);

  const handleCheckout = () => {
    setIsOpen(false);
    window.location.href = "/checkout";
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" data-cart-target className="relative rounded-full border-border/60">
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
                    {grupos.map((g) =>
                      g.tipo === "combo" ? (
                        <div
                          key={g.comboId}
                          className="rounded-lg border-2 border-accent/30 bg-card p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
                                <PackageCheck className="h-3 w-3" /> Combo
                              </span>
                              <h4 className="mt-1 truncate font-display text-lg font-semibold text-foreground">
                                {tituloCombo(g.label || "armado")}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {g.items.length} pieza{g.items.length !== 1 ? "s" : ""} incluidas
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 flex-shrink-0"
                              aria-label="Quitar combo del carrito"
                              onClick={() => removeCombo(g.comboId)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <ul className="mt-3 space-y-2 border-t border-border/50 pt-3">
                            {g.items.map((it) => (
                              <li key={it.id} className="flex items-center gap-3">
                                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-secondary/40">
                                  {it.image ? (
                                    <img src={it.image} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <ShoppingBag className="m-auto mt-2.5 h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                                <p className="min-w-0 flex-1 truncate text-sm text-foreground">{it.title}</p>
                                {it.qty > 1 && (
                                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold">
                                    ×{it.qty}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>

                          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                            <span className="text-sm text-muted-foreground">Precio del combo</span>
                            <span className="font-semibold text-foreground">
                              {fmt(g.items.reduce((s, it) => s + it.price * it.qty, 0))}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <ItemFila
                          key={g.item.id}
                          item={g.item}
                          onRemove={() => removeItem(g.item.id)}
                          onQty={(q) => updateQty(g.item.id, q)}
                        />
                      ),
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 space-y-4 pt-4 border-t border-border bg-background">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Total</span>
                    <span className="text-2xl font-display font-semibold">{fmt(total())}</span>
                  </div>
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
                      Comprar ahora
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};