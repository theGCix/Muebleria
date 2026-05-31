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
import { Loader2, Plus, Minus, Trash2, Search, UserPlus, Image } from "lucide-react";
import { toast } from "sonner";
import { createSale, searchCustomers, upsertCustomer } from "@/lib/pos.functions";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { printComprobante } from "@/lib/comprobante-pdf";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [{ title: "Terminal POS — G&M" }] }),
  component: POSPage,
});

type CartLine = {
  product_id: string;
  sku?: string;
  title: string;
  qty: number;
  unit_price: number;
  imagen_url?: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

function CustomerDialog({ onSelect }: { onSelect: (c: any) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"search" | "new">("search");
  const [newForm, setNewForm] = useState({
    doc_tipo: "DNI", doc_numero: "", nombre: "", email: "", telefono: "", direccion: "",
  });

  const { data: cData } = useQuery({
    queryKey: ["customers", q],
    queryFn: () => searchCustomers({ data: { q } }),
    enabled: open && mode === "search",
  });

  const upsertMut = useMutation({
    mutationFn: () => upsertCustomer({ data: newForm }),
    onSuccess: ({ customer }) => {
      onSelect(customer);
      setOpen(false);
      toast.success("Cliente registrado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-3.5 w-3.5 mr-1" /> Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Buscar / Registrar cliente</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-3">
          <Button size="sm" variant={mode === "search" ? "default" : "outline"} onClick={() => setMode("search")}>
            Buscar
          </Button>
          <Button size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>
            Nuevo
          </Button>
        </div>

        {mode === "search" ? (
          <div className="space-y-3">
            <Input placeholder="Nombre o doc…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {(cData?.customers ?? []).map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => { onSelect(c); setOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded hover:bg-accent text-sm"
                >
                  <p className="font-medium">{c.nombre}</p>
                  <p className="text-muted-foreground text-xs">{c.doc_tipo} {c.doc_numero}</p>
                </button>
              ))}
              {(cData?.customers ?? []).length === 0 && q && (
                <p className="text-sm text-muted-foreground p-2">Sin resultados</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo doc</Label>
                <Select value={newForm.doc_tipo} onValueChange={(v) => setNewForm((f) => ({ ...f, doc_tipo: v }))}>
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
                <Input value={newForm.doc_numero} onChange={(e) => setNewForm((f) => ({ ...f, doc_numero: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Nombre / Razón social *</Label>
              <Input value={newForm.nombre} onChange={(e) => setNewForm((f) => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Correo</Label>
                <Input type="email" value={newForm.email} onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={newForm.telefono} onChange={(e) => setNewForm((f) => ({ ...f, telefono: e.target.value }))} />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => upsertMut.mutate()}
              disabled={upsertMut.isPending || !newForm.nombre || !newForm.doc_numero}
            >
              {upsertMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar y seleccionar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function POSPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tipo, setTipo] = useState<"boleta" | "factura" | "nota">("boleta");
  const [metodo, setMetodo] = useState<"efectivo" | "tarjeta" | "transferencia" | "yape_plin">("efectivo");
  const [notas, setNotas] = useState("");
  const [customer, setCustomer] = useState<any | null>(null);

  const { data: products = [], isLoading } = useProducts(50, search || undefined);

  const total = cart.reduce((s, l) => s + l.unit_price * l.qty, 0);

  const addToCart = (p: any) => {
    setCart((c) => {
      const ex = c.find((l) => l.product_id === p.id);
      if (ex) return c.map((l) => l.product_id === p.id ? { ...l, qty: l.qty + 1 } : l);
      return [...c, {
        product_id: p.id,
        sku: p.sku ?? undefined,
        title: p.nombre,
        qty: 1,
        unit_price: Number(p.precio),
        imagen_url: p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 60 }) : p.imagen_url,
      }];
    });
  };

  const saleMut = useMutation({
    mutationFn: () =>
      createSale({
        data: {
          tipo,
          customer_id: customer?.id ?? null,
          metodo,
          notas: notas || null,
          items: cart.map((l) => ({
            product_id: l.product_id,
            sku: l.sku ?? null,
            title: l.title,
            qty: l.qty,
            unit_price: l.unit_price,
          })),
        },
      }),
    onSuccess: ({ saleId }: any) => {
      toast.success("Venta registrada");
      printComprobante({
        tipo,
        numero: "Generando…",
        fechaEmision: format(new Date(), "dd/MM/yyyy"),
        moneda: "PEN",
        emisorRuc: "00000000000",
        emisorRazon: "G&M MUEBLERIA",
        emisorDireccion: "Lima, Perú",
        receptorDoc: customer ? `${customer.doc_tipo}: ${customer.doc_numero}` : "Sin documento",
        receptorNombre: customer?.nombre ?? "Consumidor final",
        items: cart.map((l) => ({
          codigo: l.sku ?? "PROD",
          descripcion: l.title,
          unidad: "NIU",
          cantidad: l.qty,
          precioUnitario: l.unit_price,
          total: l.unit_price * l.qty,
        })),
        subtotal: Math.round(total / 1.18 * 100) / 100,
        igv: Math.round((total - total / 1.18) * 100) / 100,
        total,
      });
      setCart([]);
      setCustomer(null);
      setNotas("");
      navigate({ to: "/ventas" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-display font-semibold mb-4">Terminal POS</h1>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="text-left bg-card border rounded-lg p-3 hover:bg-accent transition-colors"
                >
                  {p.imagen_url ? (
                    <img
                      src={p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 120 }) : p.imagen_url}
                      alt=""
                      className="w-full aspect-square object-cover rounded mb-2"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-muted rounded mb-2 flex items-center justify-center">
                      <Image className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-sm font-medium line-clamp-1">{p.nombre}</p>
                  <p className="text-sm font-bold text-primary">{fmt(Number(p.precio))}</p>
                  {p.sku && <p className="text-xs text-muted-foreground">{p.sku}</p>}
                </button>
              ))}
              {products.length === 0 && (
                <p className="col-span-3 text-center py-10 text-muted-foreground">
                  Sin productos. Agrega productos en el menú "Productos".
                </p>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Carrito</h2>
              <CustomerDialog onSelect={setCustomer} />
            </div>
            {customer && (
              <div className="flex items-center justify-between bg-muted/40 rounded px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{customer.nombre}</p>
                  <p className="text-xs text-muted-foreground">{customer.doc_tipo} {customer.doc_numero}</p>
                </div>
                <button onClick={() => setCustomer(null)} className="text-muted-foreground hover:text-foreground">✕</button>
              </div>
            )}

            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carrito vacío</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cart.map((l) => (
                  <div key={l.product_id} className="flex items-center gap-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{l.title}</p>
                      <p className="text-xs text-muted-foreground">{fmt(l.unit_price)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCart((c) => c.map((x) => x.product_id === l.product_id ? { ...x, qty: Math.max(0, x.qty - 1) } : x).filter((x) => x.qty > 0))}
                        className="w-6 h-6 rounded bg-muted flex items-center justify-center"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center">{l.qty}</span>
                      <button
                        onClick={() => setCart((c) => c.map((x) => x.product_id === l.product_id ? { ...x, qty: x.qty + 1 } : x))}
                        className="w-6 h-6 rounded bg-muted flex items-center justify-center"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setCart((c) => c.filter((x) => x.product_id !== l.product_id))}
                        className="w-6 h-6 rounded text-destructive flex items-center justify-center"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="w-20 text-right font-medium">{fmt(l.unit_price * l.qty)}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-2 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{fmt(Math.round(total / 1.18 * 100) / 100)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>IGV 18%</span><span>{fmt(Math.round((total - total / 1.18) * 100) / 100)}</span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span>TOTAL</span><span>{fmt(total)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Comprobante</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boleta">Boleta</SelectItem>
                    <SelectItem value="factura">Factura</SelectItem>
                    <SelectItem value="nota">Nota crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pago</Label>
                <Select value={metodo} onValueChange={(v) => setMetodo(v as any)}>
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
              <Label>Notas (opcional)</Label>
              <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones..." />
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={() => saleMut.mutate()}
              disabled={cart.length === 0 || saleMut.isPending}
            >
              {saleMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar venta
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
