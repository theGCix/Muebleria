import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useProducts } from "@/hooks/useProducts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Loader2, Search, UserPlus, Minus, Plus, Trash2, Image as ImageIcon,
  QrCode, Eye, ShoppingCart, X, ChevronDown, Pencil, Check,
  FileText, Printer, ArrowRight, User, CreditCard, Wallet, Smartphone,
  ArrowLeft, CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { createSale, searchCustomers, upsertCustomer } from "@/lib/pos.functions";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { printComprobante } from "@/lib/comprobante-pdf";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [{ title: "Realizar Venta — G&M" }] }),
  component: RealizarVentaPage,
});

type CartLine = {
  product_id: string;
  sku?: string;
  title: string;
  editedTitle?: string;
  qty: number;
  unit_price: number;
  discount?: number;
  imagen_url?: string;
  almacen?: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

// ── Customer Search Dialog ──────────────────────────────────────────────────
function CustomerDialog({ onSelect }: { onSelect: (c: any) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"search" | "new">("search");
  const [newForm, setNewForm] = useState({
    doc_tipo: "DNI", doc_numero: "", nombre: "", email: "", telefono: "", direccion: "",
  });
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // ── Auto-lookup por DNI (8 dígitos) o RUC (11 dígitos) ──────────────────
  const handleDocNumeroChange = async (value: string) => {
    const digits = value.replace(/\D/g, "");
    setNewForm((f) => ({ ...f, doc_numero: digits }));
    setLookupError(null);

    const isDNI = digits.length === 8 && newForm.doc_tipo === "DNI";
    const isRUC = digits.length === 11 && newForm.doc_tipo === "RUC";

    if (!isDNI && !isRUC) return;

    setLookupLoading(true);
    try {
      if (isRUC) {
        // API pública SUNAT vía apis.net.pe (sin token para RUC)
        const res = await fetch(`https://api.apis.net.pe/v2/sunat/ruc?numero=${digits}`, {
          headers: { Referer: "https://apis.net.pe" },
        });
        if (!res.ok) throw new Error("No se encontró el RUC");
        const data = await res.json();
        setNewForm((f) => ({
          ...f,
          doc_numero: digits,
          doc_tipo: "RUC",
          nombre: data.razonSocial ?? f.nombre,
          direccion: data.direccion ?? f.direccion,
        }));
        toast.success("Datos del RUC cargados automáticamente");
      } else {
        // DNI requiere token — usar apis.net.pe con token si está configurado
        const token = import.meta.env.VITE_APIS_NET_PE_TOKEN;
        if (!token) {
          setLookupError("Configura VITE_APIS_NET_PE_TOKEN para consultar DNI");
          return;
        }
        const res = await fetch(`https://api.apis.net.pe/v2/reniec/dni?numero=${digits}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("No se encontró el DNI");
        const data = await res.json();
        const nombre = [data.nombres, data.apellidoPaterno, data.apellidoMaterno]
          .filter(Boolean).join(" ");
        setNewForm((f) => ({ ...f, doc_numero: digits, doc_tipo: "DNI", nombre }));
        toast.success("Datos del DNI cargados automáticamente");
      }
    } catch (err: any) {
      setLookupError(err.message ?? "Error al consultar");
    } finally {
      setLookupLoading(false);
    }
  };

  // También auto-detectar tipo doc al cambiar
  const handleDocTipoChange = (tipo: string) => {
    setNewForm((f) => ({ ...f, doc_tipo: tipo }));
    setLookupError(null);
    // Re-trigger lookup si el número ya tiene la longitud correcta
    if (
      (tipo === "DNI" && newForm.doc_numero.length === 8) ||
      (tipo === "RUC" && newForm.doc_numero.length === 11)
    ) {
      handleDocNumeroChange(newForm.doc_numero);
    }
  };

  const { data: cData } = useQuery({
    queryKey: ["customers", q],
    queryFn: () => searchCustomers({ data: { q } }),
    enabled: open && mode === "search" && q.length >= 2,
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
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-sm text-muted-foreground group"
      >
        <User className="h-4 w-4 group-hover:text-primary transition-colors" />
        <span className="group-hover:text-foreground transition-colors">Seleccionar cliente (opcional)</span>
        <ChevronDown className="h-3 w-3 ml-auto" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Buscar / Registrar cliente</DialogTitle>
          </DialogHeader>

          <div className="flex rounded-lg border border-border overflow-hidden mb-4">
            <button
              onClick={() => setMode("search")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "search" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              Buscar
            </button>
            <button
              onClick={() => setMode("new")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "new" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              Nuevo
            </button>
          </div>

          {mode === "search" ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Nombre, DNI o RUC…"
                  className="pl-8 h-9"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1 -mx-1">
                {(cData?.customers ?? []).map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => { onSelect(c); setOpen(false); }}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent transition-colors"
                  >
                    <p className="text-sm font-medium leading-tight">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.doc_tipo} {c.doc_numero}</p>
                  </button>
                ))}
                {(cData?.customers ?? []).length === 0 && q.length >= 2 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin resultados para "{q}"</p>
                )}
                {q.length < 2 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Escribe al menos 2 caracteres</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">Tipo doc.</Label>
                  <Select value={newForm.doc_tipo} onValueChange={handleDocTipoChange}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DNI">DNI</SelectItem>
                      <SelectItem value="RUC">RUC</SelectItem>
                      <SelectItem value="CE">CE</SelectItem>
                      <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">
                    Número *
                    {lookupLoading && (
                      <span className="ml-1 text-muted-foreground">consultando…</span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      className="h-9 text-sm pr-7"
                      value={newForm.doc_numero}
                      onChange={(e) => handleDocNumeroChange(e.target.value)}
                      maxLength={newForm.doc_tipo === "RUC" ? 11 : newForm.doc_tipo === "DNI" ? 8 : 20}
                      inputMode="numeric"
                    />
                    {lookupLoading && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                    {!lookupLoading && newForm.nombre && newForm.doc_numero.length >= 8 && (
                      <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-500" />
                    )}
                  </div>
                  {lookupError && (
                    <p className="text-xs text-destructive mt-1">{lookupError}</p>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Nombre / Razón social *</Label>
                <Input
                  className="h-9 text-sm"
                  value={newForm.nombre}
                  onChange={(e) => setNewForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1 block">Correo</Label>
                  <Input
                    type="email"
                    className="h-9 text-sm"
                    value={newForm.email}
                    onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Teléfono</Label>
                  <Input
                    className="h-9 text-sm"
                    value={newForm.telefono}
                    onChange={(e) => setNewForm((f) => ({ ...f, telefono: e.target.value }))}
                  />
                </div>
              </div>
              <Button
                className="w-full h-9"
                onClick={() => upsertMut.mutate()}
                disabled={upsertMut.isPending || !newForm.nombre || !newForm.doc_numero}
              >
                {upsertMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Guardar y seleccionar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
}

// ── Cart Line with inline name edit ────────────────────────────────────────
function CartLineItem({
  line,
  onQtyChange,
  onRemove,
  onTitleChange,
  onDiscountChange,
}: {
  line: CartLine;
  onQtyChange: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onDiscountChange: (id: string, pct: number) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(line.editedTitle ?? line.title);
  const displayTitle = line.editedTitle ?? line.title;
  const discountedPrice = line.unit_price * (1 - (line.discount ?? 0) / 100);
  const lineTotal = discountedPrice * line.qty;

  return (
    <div className="group border border-border rounded-xl p-3 bg-background hover:border-primary/30 transition-all">
      <div className="flex items-start gap-2.5">
        {line.imagen_url ? (
          <img src={line.imagen_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex gap-1.5 mb-1">
              <Input
                autoFocus
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                className="h-7 text-sm py-0 px-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onTitleChange(line.product_id, tempTitle);
                    setEditingTitle(false);
                  }
                  if (e.key === "Escape") setEditingTitle(false);
                }}
              />
              <button
                onClick={() => { onTitleChange(line.product_id, tempTitle); setEditingTitle(false); }}
                className="text-primary hover:text-primary/80"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-1 mb-0.5">
              <p className="text-sm font-medium leading-tight line-clamp-2 flex-1">{displayTitle}</p>
              <button
                onClick={() => { setTempTitle(displayTitle); setEditingTitle(true); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all flex-shrink-0"
                title="Editar nombre"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-muted-foreground">{fmt(line.unit_price)}</span>
            {line.discount ? (
              <Badge variant="secondary" className="text-xs py-0 px-1.5 h-4">-{line.discount}%</Badge>
            ) : null}
          </div>
        </div>
        <button
          onClick={() => onRemove(line.product_id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onQtyChange(line.product_id, -1)}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-colors"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-8 text-center text-sm font-semibold">{line.qty}</span>
          <button
            onClick={() => onQtyChange(line.product_id, 1)}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <p className="text-sm font-bold text-foreground">{fmt(lineTotal)}</p>
      </div>
    </div>
  );
}

// ── Vista Previa (receipt preview) ─────────────────────────────────────────
function VistaPrevia({
  open,
  onClose,
  cart,
  customer,
  tipo,
  metodo,
  notas,
  total,
  onProcesar,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartLine[];
  customer: any;
  tipo: string;
  metodo: string;
  notas: string;
  total: number;
  onProcesar: () => void;
  isPending: boolean;
}) {
  const subtotal = Math.round((total / 1.18) * 100) / 100;
  const igv = Math.round((total - total / 1.18) * 100) / 100;
  const tipoLabel: Record<string, string> = {
    boleta: "Boleta de Venta Electrónica",
    factura: "Factura Electrónica",
    nota: "Nota de Crédito",
  };
  const metodLabel: Record<string, string> = {
    efectivo: "Efectivo",
    tarjeta: "Tarjeta",
    transferencia: "Transferencia",
    yape_plin: "Yape / Plin",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4 sm:mx-auto p-0 overflow-hidden gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            Vista previa del comprobante
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[70vh]">
          {/* Receipt header */}
          <div className="bg-primary/5 px-4 py-3 border-b border-border text-center">
            <p className="font-bold text-sm">G&M MUEBLERÍA</p>
            <p className="text-xs text-muted-foreground">Lima, Perú</p>
            <Badge className="mt-1.5 text-xs" variant="outline">{tipoLabel[tipo] ?? tipo}</Badge>
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Customer */}
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium text-right max-w-[55%]">
                {customer ? customer.nombre : "Consumidor final"}
              </span>
            </div>
            {customer && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{customer.doc_tipo}</span>
                <span className="font-medium">{customer.doc_numero}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Fecha</span>
              <span className="font-medium">{format(new Date(), "dd/MM/yyyy")}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Pago</span>
              <span className="font-medium">{metodLabel[metodo] ?? metodo}</span>
            </div>

            {/* Items */}
            <div className="border-t border-dashed border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">DETALLE</p>
              <div className="space-y-2">
                {cart.map((l) => {
                  const name = l.editedTitle ?? l.title;
                  const price = l.unit_price * (1 - (l.discount ?? 0) / 100);
                  return (
                    <div key={l.product_id}>
                      <div className="flex justify-between text-xs">
                        <span className="flex-1 pr-2 line-clamp-1">{name}</span>
                        <span className="font-medium">{fmt(price * l.qty)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{l.qty} × {fmt(price)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-dashed border-border pt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal (sin IGV)</span>
                <span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>IGV 18%</span>
                <span>{fmt(igv)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-border pt-2 mt-2">
                <span>TOTAL</span>
                <span className="text-primary">{fmt(total)}</span>
              </div>
            </div>

            {notas && (
              <div className="bg-muted/50 rounded-lg px-3 py-2">
                <p className="text-xs text-muted-foreground">Obs: {notas}</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border flex gap-2">
          <Button variant="outline" className="flex-1 h-9 text-sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Editar
          </Button>
          <Button
            className="flex-1 h-9 text-sm"
            onClick={onProcesar}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle className="h-4 w-4 mr-1.5" />}
            Procesar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
function RealizarVentaPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tipo, setTipo] = useState<"boleta" | "factura" | "nota">("boleta");
  const [metodo, setMetodo] = useState<"efectivo" | "tarjeta" | "transferencia" | "yape_plin">("efectivo");
  const [notas, setNotas] = useState("");
  const [customer, setCustomer] = useState<any | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading } = useProducts(50, search || undefined);
  const total = cart.reduce((s, l) => s + l.unit_price * (1 - (l.discount ?? 0) / 100) * l.qty, 0);
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);

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
        imagen_url: p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 80 }) : p.imagen_url,
        almacen: "PRINCIPAL",
      }];
    });
    toast.success(`${p.nombre.slice(0, 30)}… agregado`, { duration: 1500 });
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
            title: l.editedTitle ?? l.title,
            qty: l.qty,
            unit_price: l.unit_price * (1 - (l.discount ?? 0) / 100),
          })),
        },
      }),
    onSuccess: ({ saleId }: any) => {
      toast.success("¡Venta procesada correctamente!");
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
          descripcion: l.editedTitle ?? l.title,
          unidad: "NIU",
          cantidad: l.qty,
          precioUnitario: l.unit_price * (1 - (l.discount ?? 0) / 100),
          total: l.unit_price * (1 - (l.discount ?? 0) / 100) * l.qty,
        })),
        subtotal: Math.round((total / 1.18) * 100) / 100,
        igv: Math.round((total - total / 1.18) * 100) / 100,
        total,
      });
      setCart([]);
      setCustomer(null);
      setNotas("");
      setPreviewOpen(false);
      setCartOpen(false);
      navigate({ to: "/ventas" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const metodoIcons: Record<string, React.ReactNode> = {
    efectivo: <Wallet className="h-4 w-4" />,
    tarjeta: <CreditCard className="h-4 w-4" />,
    transferencia: <ArrowRight className="h-4 w-4" />,
    yape_plin: <Smartphone className="h-4 w-4" />,
  };

  // Cart panel JSX (reusable on both desktop sidebar and mobile sheet)
  const CartPanel = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          Venta actual
          {cartCount > 0 && (
            <Badge className="ml-1 h-5 px-1.5 text-xs">{cartCount}</Badge>
          )}
        </h2>
      </div>

      {/* Comprobante + Pago */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Comprobante</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="boleta">Boleta</SelectItem>
              <SelectItem value="factura">Factura</SelectItem>
              <SelectItem value="nota">Nota crédito</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Método de pago</Label>
          <Select value={metodo} onValueChange={(v) => setMetodo(v as any)}>
            <SelectTrigger className="h-9 text-sm">
              <div className="flex items-center gap-1.5">
                {metodoIcons[metodo]}
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="efectivo">Efectivo</SelectItem>
              <SelectItem value="tarjeta">Tarjeta</SelectItem>
              <SelectItem value="transferencia">Transferencia</SelectItem>
              <SelectItem value="yape_plin">Yape / Plin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Customer */}
      <div className="mb-3">
        {customer ? (
          <div className="flex items-center justify-between bg-primary/8 border border-primary/20 rounded-xl px-3 py-2">
            <div>
              <p className="text-sm font-medium leading-tight">{customer.nombre}</p>
              <p className="text-xs text-muted-foreground">{customer.doc_tipo} {customer.doc_numero}</p>
            </div>
            <button onClick={() => setCustomer(null)} className="text-muted-foreground hover:text-destructive transition-colors ml-2">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <CustomerDialog onSelect={setCustomer} />
        )}
      </div>

      {/* Cart lines */}
      <div className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1 min-h-0">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <ShoppingCart className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Sin productos</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Busca o escanea un producto para agregar</p>
          </div>
        ) : (
          cart.map((l) => (
            <CartLineItem
              key={l.product_id}
              line={l}
              onQtyChange={(id, delta) =>
                setCart((c) =>
                  c.map((x) => x.product_id === id ? { ...x, qty: Math.max(0, x.qty + delta) } : x)
                    .filter((x) => x.qty > 0)
                )
              }
              onRemove={(id) => setCart((c) => c.filter((x) => x.product_id !== id))}
              onTitleChange={(id, title) =>
                setCart((c) => c.map((x) => x.product_id === id ? { ...x, editedTitle: title } : x))
              }
              onDiscountChange={(id, pct) =>
                setCart((c) => c.map((x) => x.product_id === id ? { ...x, discount: pct } : x))
              }
            />
          ))
        )}
      </div>

      {/* Notas */}
      {cart.length > 0 && (
        <div className="mt-3">
          <Textarea
            placeholder="Observaciones (opcional)…"
            rows={2}
            className="text-sm resize-none"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>
      )}

      {/* Totals + actions */}
      {cart.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal</span>
            <span>{fmt(Math.round((total / 1.18) * 100) / 100)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>IGV 18%</span>
            <span>{fmt(Math.round((total - total / 1.18) * 100) / 100)}</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t border-border pt-2">
            <span>TOTAL</span>
            <span className="text-primary">{fmt(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              className="h-10 text-sm"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="h-4 w-4 mr-1.5" />
              Vista previa
            </Button>
            <Button
              className="h-10 text-sm"
              onClick={() => saleMut.mutate()}
              disabled={saleMut.isPending}
            >
              {saleMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle className="h-4 w-4 mr-1.5" />}
              Procesar
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-display font-semibold">Realizar Venta</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(), "EEEE dd 'de' MMMM yyyy", { locale: undefined })}</p>
        </div>
        {/* Mobile cart FAB */}
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetTrigger asChild>
            <button className="lg:hidden relative flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 shadow-sm">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-sm font-medium">{cartCount > 0 ? fmt(total) : "Carrito"}</span>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-[400px] p-4 flex flex-col gap-0">
            <SheetHeader className="mb-0 pb-0">
              <SheetTitle className="sr-only">Carrito de venta</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden flex flex-col pt-2">
              {CartPanel}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-5 flex-1">
        {/* ── Product search area ─────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Search bar with QR hint */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Buscar producto por nombre, SKU o escanear código de barras…"
              className="pl-10 pr-12 h-11 text-sm rounded-xl border-border focus:border-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {search && (
                <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <div className="text-muted-foreground" title="Escanea un código de barras — el campo siempre está activo">
                <QrCode className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Empty state */}
          {!search && products.length === 0 && !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                <QrCode className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <p className="text-base font-medium text-muted-foreground">Escanea o busca un producto</p>
              <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
                Usa el lector de código de barras o escribe el nombre del producto para encontrarlo
              </p>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Products grid */}
          {!isLoading && products.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="text-left bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all group active:scale-[0.98]"
                >
                  {p.imagen_url ? (
                    <img
                      src={p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 200 }) : p.imagen_url}
                      alt=""
                      className="w-full aspect-[4/3] object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="p-2.5">
                    <p className="text-xs font-medium leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                      {p.nombre}
                    </p>
                    <p className="text-sm font-bold text-primary">{fmt(Number(p.precio))}</p>
                    {p.sku && <p className="text-xs text-muted-foreground mt-0.5">{p.sku}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isLoading && search && products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">Sin resultados para <strong>"{search}"</strong></p>
              <p className="text-xs text-muted-foreground/70 mt-1">Puedes agregar el producto manualmente desde el módulo Productos</p>
            </div>
          )}
        </div>

        {/* ── Desktop cart sidebar ───────────────────────────────── */}
        <div className="hidden lg:flex lg:w-80 xl:w-96 flex-col">
          <div className="sticky top-4 bg-card border border-border rounded-2xl p-4 flex flex-col max-h-[calc(100vh-6rem)] overflow-hidden">
            {CartPanel}
          </div>
        </div>
      </div>

      {/* Vista previa dialog */}
      <VistaPrevia
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        cart={cart}
        customer={customer}
        tipo={tipo}
        metodo={metodo}
        notas={notas}
        total={total}
        onProcesar={() => saleMut.mutate()}
        isPending={saleMut.isPending}
      />
    </div>
  );
}