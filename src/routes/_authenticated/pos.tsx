import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useProducts } from "@/hooks/useProducts";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Minus, Trash2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createSale, searchCustomers, upsertCustomer } from "@/lib/pos.functions";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [{ title: "Terminal POS — G&M" }] }),
  component: POSPage,
});

type CartLine = {
  shopify_product_id?: string;
  shopify_variant_id?: string;
  sku?: string;
  title: string;
  qty: number;
  unit_price: number;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

function POSPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tipo, setTipo] = useState<"boleta" | "factura" | "nota">("boleta");
  const [metodo, setMetodo] = useState<"efectivo" | "tarjeta" | "transferencia" | "yape_plin">("efectivo");
  const [notas, setNotas] = useState("");
  const [customer, setCustomer] = useState<any | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");

  const { data: products, isLoading } = useProducts(20, search || undefined);
  const { data: customersData, refetch: refetchCustomers } = useQuery({
    queryKey: ["customers", customerSearch],
    queryFn: () => searchCustomers({ data: { q: customerSearch } }),
  });

  const addToCart = (p: any) => {
    const v = p.node.variants.edges[0]?.node;
    if (!v) return;
    const line: CartLine = {
      shopify_product_id: p.node.id,
      shopify_variant_id: v.id,
      title: p.node.title,
      qty: 1,
      unit_price: Number(v.price.amount),
    };
    setCart((prev) => {
      const i = prev.findIndex((x) => x.shopify_variant_id === v.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, line];
    });
  };

  const updateQty = (i: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      const q = next[i].qty + delta;
      if (q <= 0) return next.filter((_, x) => x !== i);
      next[i] = { ...next[i], qty: q };
      return next;
    });
  };

  const subtotal = useMemo(() => cart.reduce((a, l) => a + l.qty * l.unit_price, 0), [cart]);
  const igv = subtotal * 0.18;
  const total = subtotal + igv;

  const saleMut = useMutation({
    mutationFn: () =>
      createSale({
        data: {
          tipo,
          customer_id: customer?.id ?? null,
          metodo,
          notas: notas || null,
          items: cart,
        },
      }),
    onSuccess: ({ saleId }) => {
      toast.success("Venta registrada");
      setCart([]); setNotas(""); setCustomer(null);
      navigate({ to: "/ventas", search: { id: saleId } as any });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
      <div className="lg:col-span-2 space-y-4">
        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto en Shopify..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(products ?? []).map((p) => {
              const v = p.node.variants.edges[0]?.node;
              const img = p.node.images.edges[0]?.node.url;
              return (
                <button
                  key={p.node.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  className="text-left rounded-xl border bg-card hover:border-primary transition-colors overflow-hidden"
                >
                  {img ? (
                    <img src={img} alt={p.node.title} className="w-full h-28 object-cover" />
                  ) : (
                    <div className="w-full h-28 bg-muted" />
                  )}
                  <div className="p-2">
                    <div className="text-sm font-medium line-clamp-2">{p.node.title}</div>
                    <div className="text-sm text-primary font-semibold mt-1">
                      {v ? fmt(Number(v.price.amount)) : "—"}
                    </div>
                  </div>
                </button>
              );
            })}
            {(products ?? []).length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground text-center py-10">
                No hay productos. Carga productos en Shopify para venderlos.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold">Comprobante</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleta">Boleta</SelectItem>
                  <SelectItem value="factura">Factura</SelectItem>
                  <SelectItem value="nota">Guía de remisión</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Pago</Label>
              <Select value={metodo} onValueChange={(v: any) => setMetodo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="yape_plin">Yape / Plin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Cliente</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar nombre o doc."
                value={customer ? `${customer.nombre} (${customer.doc_numero})` : customerSearch}
                onChange={(e) => { setCustomer(null); setCustomerSearch(e.target.value); }}
              />
              <NewCustomerDialog onCreated={(c) => { setCustomer(c); refetchCustomers(); }} />
            </div>
            {!customer && customersData?.customers && customersData.customers.length > 0 && customerSearch && (
              <div className="mt-1 border rounded-md max-h-40 overflow-auto bg-popover">
                {customersData.customers.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setCustomer(c); setCustomerSearch(""); }}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                  >
                    {c.nombre} · {c.doc_tipo} {c.doc_numero}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} />
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Carrito ({cart.length})</h3>
          <div className="space-y-2 max-h-80 overflow-auto">
            {cart.length === 0 && <p className="text-sm text-muted-foreground">Sin productos.</p>}
            {cart.map((l, i) => (
              <div key={i} className="flex items-center gap-2 text-sm border-b pb-2">
                <div className="flex-1 min-w-0">
                  <div className="truncate">{l.title}</div>
                  <div className="text-xs text-muted-foreground">{fmt(l.unit_price)} c/u</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center">{l.qty}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i, 1)}><Plus className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setCart((p) => p.filter((_, x) => x !== i))}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-sm border-t pt-3">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>IGV (18%)</span><span>{fmt(igv)}</span></div>
            <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{fmt(total)}</span></div>
          </div>
          <Button
            className="w-full mt-4"
            size="lg"
            disabled={cart.length === 0 || saleMut.isPending}
            onClick={() => saleMut.mutate()}
          >
            {saleMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar venta
          </Button>
        </Card>
      </div>
    </div>
  );
}

function NewCustomerDialog({ onCreated }: { onCreated: (c: any) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ doc_tipo: "DNI", doc_numero: "", nombre: "", email: "", telefono: "", direccion: "" });
  const m = useMutation({
    mutationFn: () => upsertCustomer({ data: form as any }),
    onSuccess: ({ customer }) => { toast.success("Cliente guardado"); onCreated(customer); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="icon"><UserPlus className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo doc.</Label>
              <Select value={form.doc_tipo} onValueChange={(v) => setForm({ ...form, doc_tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DNI">DNI</SelectItem>
                  <SelectItem value="RUC">RUC</SelectItem>
                  <SelectItem value="CE">CE</SelectItem>
                  <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Número</Label>
              <Input value={form.doc_numero} onChange={(e) => setForm({ ...form, doc_numero: e.target.value })} />
            </div>
          </div>
          <div><Label>Nombre / Razón social</Label><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Teléfono</Label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
          <div><Label>Dirección</Label><Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></div>
          <Button className="w-full" onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar cliente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
