import { useEffect, useMemo, useState } from "react";
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
import { ShoppingBag, ShoppingCart, Minus, Plus, Trash2, PackageCheck } from "lucide-react";
import { useCartStore, type CartItem } from "@/stores/cartStore";
import { useAuth } from "@/hooks/useAuth";
import { LoginModal } from "./LoginModal";
import { useValidarCarrito } from "@/hooks/useValidarCarrito";
import { CarritoAvisos } from "./CarritoAvisos";
import { precalentarServidor } from "@/lib/precalentar";
import { useDistritoEnvio } from "@/hooks/useDistritoEnvio";
import { itemsDeCarrito, trackViewCart } from "@/lib/analytics";

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
    <div className="p-3 rounded-lg bg-card border border-border/50">
      <div className="flex gap-3">
        <div className="w-20 h-20 bg-secondary/40 rounded-md overflow-hidden flex-shrink-0">
          {item.image ? (
            <img src={item.image} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {/* Nombre completo (con sus opciones): se parte en varias líneas en vez de cortarse */}
          <h4 className="font-medium text-foreground break-words">{item.title}</h4>
          <p className="font-semibold mt-1 text-foreground">{fmt(item.price)}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1" role="group" aria-label="Cantidad">
          <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Quitar una unidad" onClick={() => onQty(item.qty - 1)}>
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-10 text-center text-sm" aria-live="polite">{item.qty}</span>
          <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Agregar una unidad" onClick={() => onQty(item.qty + 1)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" className="h-11 px-3 text-muted-foreground" onClick={onRemove}>
          <Trash2 className="mr-1.5 h-4 w-4" /> Quitar
        </Button>
      </div>
    </div>
  );
}

export const CartDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const { items, updateQty, removeItem, removeCombo, total, clearCart } = useCartStore();
  const { user } = useAuth();
  const { distrito, envio, desde } = useDistritoEnvio();
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);
  // Al abrir el carrito se revisa contra el servidor (precios vigentes, stock, combos)
  const { avisos, entendido } = useValidarCarrito(isOpen);
  // Despierta Render al abrir el carrito, antes de llegar al checkout
  useEffect(() => { if (isOpen) precalentarServidor(); }, [isOpen]);
  useEffect(() => { if (!isOpen) setConfirmarVaciar(false); }, [isOpen]);

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

  // view_cart: se dispara aquí (al abrir), no en un efecto, para que salga una sola vez por apertura.
  const handleOpenChange = (abierto: boolean) => {
    setIsOpen(abierto);
    if (abierto) trackViewCart(total(), itemsDeCarrito(items));
  };

  const handleCheckout = () => {
    setIsOpen(false);
    window.location.href = "/checkout";
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" data-cart-target className="relative rounded-full border-border/60">
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-accent-strong text-accent-foreground">
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
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Carrito vacío</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto pr-2 min-h-0">
                  <CarritoAvisos avisos={avisos} onEntendido={entendido} className="mb-4" />
                  <div className="space-y-4">
                    {grupos.map((g) =>
                      g.tipo === "combo" ? (
                        <div
                          key={g.comboId}
                          className="rounded-lg border-2 border-accent/30 bg-card p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="inline-flex items-center gap-1 rounded-full bg-accent-strong px-2 py-0.5 text-xs font-bold text-accent-foreground">
                                <PackageCheck className="h-3 w-3" /> Combo
                              </span>
                              <h4 className="mt-1 truncate text-base font-semibold text-foreground">
                                {tituloCombo(g.label || "armado")}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {g.items.length} pieza{g.items.length !== 1 ? "s" : ""} incluidas
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 flex-shrink-0"
                              aria-label="Quitar combo del carrito"
                              onClick={() => removeCombo(g.comboId)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <ul className="mt-3 space-y-2 border-t border-border/50 pt-3">
                            {g.items.map((it) => (
                              <li key={it.lineId} className="flex items-center gap-3">
                                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-secondary/40">
                                  {it.image ? (
                                    <img src={it.image} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <ShoppingBag className="m-auto mt-2.5 h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                                <p className="min-w-0 flex-1 truncate text-sm text-foreground">{it.title}</p>
                                {it.qty > 1 && (
                                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold">
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
                          key={g.item.lineId}
                          item={g.item}
                          onRemove={() => removeItem(g.item.lineId)}
                          onQty={(q) => updateQty(g.item.lineId, q)}
                        />
                      ),
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 space-y-3 pt-4 border-t border-border bg-background">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Total</span>
                    <span className="text-2xl font-display font-semibold">{fmt(total())}</span>
                  </div>
                  {/* Envío estimado: nunca se asume un distrito */}
                  <p className="text-xs text-muted-foreground">
                    {distrito && envio != null
                      ? <>Envío estimado a {distrito}: <b className="text-foreground">{fmt(envio)}</b>. Se suma al pagar.</>
                      : <>Envío desde <b className="text-foreground">{fmt(desde)}</b> según tu distrito. Se calcula al pagar.</>}
                  </p>
                  <Button className="h-12 w-full" onClick={handleCheckout}>
                    Comprar ahora
                  </Button>
                  {/* «Vaciar carrito» discreto y con confirmación, para que no se toque por error */}
                  {confirmarVaciar ? (
                    <div className="flex items-center justify-center gap-1 text-sm">
                      <span className="text-muted-foreground">¿Vaciar todo el carrito?</span>
                      <Button variant="ghost" className="h-11 px-3 text-destructive" onClick={() => { clearCart(); setConfirmarVaciar(false); }}>
                        Sí, vaciar
                      </Button>
                      <Button variant="ghost" className="h-11 px-3" onClick={() => setConfirmarVaciar(false)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="mx-auto block min-h-[44px] px-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      onClick={() => setConfirmarVaciar(true)}
                    >
                      Vaciar carrito
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};