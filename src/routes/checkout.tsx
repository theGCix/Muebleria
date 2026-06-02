// src/routes/checkout.tsx
// G&M Mueblería — Checkout con integración Niubiz (VisanetCheckout popup)
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCartStore } from "@/stores/cartStore";
import {
  ArrowLeft, ShoppingBag, Truck, Shield, CreditCard,
  CheckCircle2, XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";


declare global {
  interface Window {
    VisanetCheckout?: {
      configure: (opts: Record<string, unknown>) => void;
      open: () => void;
    };
  }
}

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — G&M Mueblería" }] }),
  component: CheckoutPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

function generateOrderId() {
  return `GM-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

type ModalTipo = "exitoso" | "error" | null;
interface ModalDatos {
  purchase?: string;
  date?: string;
  amount?: string;
  currency?: string;
  actionDesc?: string;
}

// const API = import.meta.env.VITE_API_URL ?? "";
import { API_URL as API } from "@/config";

async function fetchNiubizSession(payload: {
  amount: number;
  orderId: string;
  email?: string;
}) {
  const res = await fetch(`${API}/api/niubiz/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Error al conectar con Niubiz");
  }
  return res.json() as Promise<{
    sessionKey: string;
    merchantId: string;
    jsUrl: string;
    currency: string;
  }>;
}

function CheckoutPage() {
  const { items, total, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // ── Todos los refs aquí, en el cuerpo del componente ──────
  const jsUrlRef      = useRef<string | null>(null);
  const orderIdRef    = useRef<string>("");
  const niubizRef     = useRef<{ sessionKey: string; merchantId: string } | null>(null);
  const orderSavedRef = useRef(false); // ← evita guardar el pedido dos veces

  const [modalTipo, setModalTipo] = useState<ModalTipo>(null);
  const [modalDatos, setModalDatos] = useState<ModalDatos>({});

  const [form, setForm] = useState({
    nombre: "", email: "", telefono: "", dni: "",
    direccion: "", distrito: "", ciudad: "Lima", notas: "",
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const subtotal   = total();
  const envio      = subtotal > 500 ? 0 : 35;
  const totalFinal = subtotal + envio;

  // ── Pre-carga el JS de Niubiz ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`${API}/api/niubiz/config`);
        const data = await res.json();
        jsUrlRef.current = data.jsUrl;
        injectNiubizScript(data.jsUrl);
      } catch {
        // silencioso
      }
    })();
  }, []);

  // ── Detecta retorno de Niubiz vía query params ────────────
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const transactionToken = params.get("transactionToken");
  if (!transactionToken) return;
  if (orderSavedRef.current) return;
  orderSavedRef.current = true;

  window.history.replaceState({}, "", "/checkout");

  // Recuperar datos guardados antes del redirect
  const saved = JSON.parse(localStorage.getItem("gm_checkout_form") ?? "{}");
  localStorage.removeItem("gm_checkout_form");

  const allParams = Object.fromEntries(new URLSearchParams(window.location.search).entries());
  const purchaseNumber = allParams.purchaseNumber ?? orderIdRef.current;

  fetch(`${API}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order: {
        orderNumber:      purchaseNumber || `GM-${Date.now()}`,
        userId:           saved.userId ?? null,         // ← viene de localStorage
        nombre:           saved.nombre || "—",
        email:            saved.email || allParams.customerEmail || "—",
        telefono:         saved.telefono,
        dni:              saved.dni,
        direccion:        saved.direccion,
        distrito:         saved.distrito,
        ciudad:           saved.ciudad,
        notas:            saved.notas,
        subtotal:         saved.subtotal ?? 0,
        envio:            saved.envio ?? 0,
        total:            saved.total ?? 0,
        sessionKey:       niubizRef.current?.sessionKey ?? "",
        transactionToken,
      },
      items: items.map((item) => ({
        product_id: item.id,
        sku:        item.sku ?? null,
        title:      item.title,
        qty:        item.qty,
        price:      item.price,
        image:      item.image ?? null,
      })),
    }),
  }).catch((err) => console.error("Error guardando pedido:", err));
    clearCart();
    // Redirigir directo al perfil después de 1.5s para que vean el modal brevemente
    setModalDatos({
      purchase: purchaseNumber || "—",
      date:     new Date().toLocaleString("es-PE"),
      amount:   (saved.total ?? totalFinal).toFixed(2),
      currency: "PEN",
    });
    setModalTipo("exitoso");
    setTimeout(() => {
      window.location.href = "/perfil";
    }, 2500);
}, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit → abrir popup Niubiz ───────────────────────────
  const handlePagar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast.error("Tu carrito está vacío"); return; }
    setLoading(true);

    try {
      const orderId = generateOrderId();
      orderIdRef.current = orderId;

      const niubiz = await fetchNiubizSession({
        amount:  totalFinal,
        orderId,
        email:   form.email,
      });
      niubizRef.current = niubiz;

      await injectNiubizScript(niubiz.jsUrl);

      if (!window.VisanetCheckout) {
        throw new Error("El script de Niubiz no cargó correctamente.");
      }

      window.VisanetCheckout.configure({
        sessiontoken:      niubiz.sessionKey,
        channel:           "web",
        merchantid:        niubiz.merchantId,
        purchasenumber:    orderId,
        amount:            totalFinal.toFixed(2),
        currency:          niubiz.currency,
        expirationminutes: "5",
        // timeouturl:        `${window.location.origin}/niubiz-return.html`,
        // action:            `${window.location.origin}/niubiz-return.html`,
        timeouturl: `${API}/niubiz-return.html`,
        action:     `${API}/niubiz-return.html`,
        name:              form.nombre,
        email:             form.email,
        billingaddress:    form.direccion,
        billingcity:       form.distrito,
        billingcountry:    "PE",
      });
      // Guardar datos del formulario y userId en localStorage antes del redirect
      localStorage.setItem("gm_checkout_form", JSON.stringify({
        ...form,
        userId: user?.id ?? null,
        subtotal,
        envio,
        total: totalFinal,
      }));

      window.VisanetCheckout.open();
    } catch (err) {
      console.error("Error Niubiz:", err);
      toast.error(err instanceof Error ? err.message : "Error al conectar con la pasarela de pago.");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0 && modalTipo === null) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <ShoppingBag className="h-16 w-16 text-muted-foreground" />
          <h2 className="font-display text-2xl">Tu carrito está vacío</h2>
          <Button asChild><Link to="/">Ver productos</Link></Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-10 max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Seguir comprando
        </Link>

        <h1 className="font-display text-4xl font-semibold mb-10">Finalizar compra</h1>

        <div className="grid lg:grid-cols-[1fr_420px] gap-10">
          {/* ── Formulario ── */}
          <form onSubmit={handlePagar} className="space-y-8">

            <section className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-xl font-semibold">Datos de contacto</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nombre">Nombre completo</Label>
                  <Input id="nombre" required value={form.nombre} onChange={set("nombre")} placeholder="Juan Pérez" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input id="email" type="email" required value={form.email} onChange={set("email")} placeholder="juan@email.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="telefono">Teléfono / Celular</Label>
                  <Input id="telefono" required value={form.telefono} onChange={set("telefono")} placeholder="+51 999 999 999" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dni">DNI / RUC</Label>
                  <Input id="dni" required value={form.dni} onChange={set("dni")} placeholder="12345678" maxLength={11} pattern="^\d{8}(\d{3})?$" title="DNI: 8 dígitos — RUC: 11 dígitos" />
                </div>
              </div>
            </section>

            <section className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-xl font-semibold">Dirección de entrega</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input id="direccion" required value={form.direccion} onChange={set("direccion")} placeholder="Av. Principal 123, Dpto 4B" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="distrito">Distrito</Label>
                  <Input id="distrito" required value={form.distrito} onChange={set("distrito")} placeholder="Miraflores" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ciudad">Ciudad</Label>
                  <Input id="ciudad" required value={form.ciudad} onChange={set("ciudad")} placeholder="Lima" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="notas">Notas adicionales (opcional)</Label>
                  <Input id="notas" value={form.notas} onChange={set("notas")} placeholder="Referencias, horario preferido de entrega..." />
                </div>
              </div>
            </section>

            <section className="bg-card border border-border/50 rounded-xl p-6 space-y-3">
              <h2 className="font-display text-xl font-semibold">Método de pago</h2>
              <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                <CreditCard className="h-6 w-6 text-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Tarjeta de crédito / débito</p>
                  <p className="text-xs text-muted-foreground">Pago seguro procesado por Niubiz · Visa, Mastercard, Amex</p>
                </div>
                <img
                  src="https://static-content-qas.vnforapps.com/v2/img/vpos-logo-new.png"
                  alt="Niubiz" className="ml-auto h-8 object-contain"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              </div>
            </section>

            <div className="grid sm:grid-cols-3 gap-3 text-sm text-muted-foreground">
              {[
                { icon: Truck,      text: "Entrega a domicilio en Lima" },
                { icon: Shield,     text: "Garantía de 2 años" },
                { icon: CreditCard, text: "Pago 100% seguro con Niubiz" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                  <Icon className="h-4 w-4 flex-shrink-0" /><span>{text}</span>
                </div>
              ))}
            </div>

            <Button type="submit" size="lg" className="w-full rounded-full h-12 text-base" disabled={loading}>
              {loading ? "Conectando con Niubiz..." : `Pagar — ${fmt(totalFinal)}`}
            </Button>
          </form>

          {/* ── Resumen ── */}
          <aside>
            <div className="bg-card border border-border/50 rounded-xl p-6 sticky top-6">
              <h2 className="font-display text-xl font-semibold mb-4">Resumen del pedido</h2>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3 items-center">
                    <div className="w-14 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {item.image
                        ? <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-5 w-5 text-muted-foreground" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">x{item.qty}</p>
                      {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                    </div>
                    <span className="text-sm font-semibold flex-shrink-0">{fmt(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Envío</span>
                  <span>{envio === 0 ? <span className="text-green-600">Gratis</span> : fmt(envio)}</span>
                </div>
                {envio > 0 && <p className="text-xs text-muted-foreground">Envío gratis en compras mayores a {fmt(500)}</p>}
                <div className="flex justify-between font-semibold text-base pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="font-display text-lg">{fmt(totalFinal)}</span>
                </div>
                <p className="text-xs text-muted-foreground text-center pt-1">Moneda: Soles (PEN)</p>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />

      {modalTipo && (
        <PagoModal tipo={modalTipo} datos={modalDatos} onCerrar={() => setModalTipo(null)} />
      )}
    </div>
  );
}

function injectNiubizScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
    const script = document.createElement("script");
    script.src = url;
    script.onload  = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar el script de Niubiz"));
    document.body.appendChild(script);
  });
}

function PagoModal({ tipo, datos, onCerrar }: { tipo: "exitoso" | "error"; datos: ModalDatos; onCerrar: () => void }) {
  const navigate = useNavigate();
  const exitoso  = tipo === "exitoso";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }}>
      <div className="relative bg-background rounded-2xl px-10 py-12 max-w-[440px] w-[90%] text-center shadow-2xl" style={{ paddingTop: "56px" }}>

        <div className="absolute -top-11 left-1/2 -translate-x-1/2">
          <div className="w-[88px] h-[88px] rounded-full border-[5px] border-background flex items-center justify-center" style={{ background: "#1a2e5a" }}>
            {exitoso
              ? <CheckCircle2 className="h-11 w-11" style={{ color: "#f0a020" }} />
              : <XCircle      className="h-11 w-11" style={{ color: "#e24b4a" }} />}
          </div>
        </div>

        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: exitoso ? "#f0a020" : "#e24b4a" }}>
          {exitoso ? "Compra confirmada" : "Pago no procesado"}
        </p>
        <h2 className="text-2xl font-semibold mb-3" style={{ color: "#1a2e5a" }}>
          {exitoso ? "¡Gracias por tu compra!" : "Hubo un problema"}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          {exitoso
            ? "Tu pago fue procesado exitosamente.\nNos pondremos en contacto para coordinar la entrega de tus muebles."
            : "No pudimos procesar tu pago.\nPor favor verifica tus datos e intenta nuevamente."}
        </p>

        <div className="rounded-xl p-4 mb-6 text-left space-y-2" style={{ background: "#f7f8fa" }}>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Estado</span>
            {exitoso
              ? <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ background: "#eaf3de", color: "#3b6d11" }}>✓ Aprobado</span>
              : <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ background: "#fcebeb", color: "#a32d2d" }}>✗ Rechazado</span>}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Tienda</span>
            <span className="text-xs font-medium" style={{ color: "#1a2e5a" }}>G&amp;M Mueblería</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Método</span>
            <span className="text-xs text-muted-foreground">Tarjeta · Niubiz</span>
          </div>
          {datos.purchase && datos.purchase !== "—" && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">N° de pedido</span>
              <span className="text-xs text-muted-foreground">{datos.purchase}</span>
            </div>
          )}
          {datos.date && datos.date !== "—" && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Fecha y hora</span>
              <span className="text-xs text-muted-foreground">{datos.date}</span>
            </div>
          )}
          {exitoso && datos.amount && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Importe</span>
              <span className="text-xs font-semibold" style={{ color: "#1a2e5a" }}>{datos.currency ?? "PEN"} {datos.amount}</span>
            </div>
          )}
          {!exitoso && datos.actionDesc && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Motivo</span>
              <span className="text-xs" style={{ color: "#a32d2d" }}>{datos.actionDesc}</span>
            </div>
          )}
        </div>

        <button onClick={() => navigate({ to: "/" })} className="w-full py-3.5 rounded-xl text-sm font-medium text-white mb-3 cursor-pointer border-none" style={{ background: "#1a2e5a" }}>
          Volver a la tienda
        </button>
        <button onClick={onCerrar} className="w-full py-3.5 rounded-xl text-sm border cursor-pointer bg-transparent" style={{ color: "#1a2e5a", borderColor: "#1a2e5a" }}>
          {exitoso ? "Ver mi pedido" : "Intentar de nuevo"}
        </button>
      </div>
    </div>
  );
}