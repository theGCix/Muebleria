// src/routes/checkout.tsx
// G&M Mueblería — Checkout con integración Niubiz (VisanetCheckout popup)
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LoginModal } from "@/components/LoginModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCartStore } from "@/stores/cartStore";
import {
  ArrowLeft, ShoppingBag, Truck, Shield, CreditCard,
  LogIn, Minus, Plus, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getStoredUtm } from "@/hooks/useUtm";
import { supabase } from "@/integrations/supabase/client";
import { DISTRITOS_ENVIO, getPrecioEnvio, ORIGEN_ENVIO } from "@/lib/envios";
import { leerDistritoGuardado } from "@/lib/entrega";
import {
  DEPARTAMENTOS_PROVINCIA, provinciasDe, estimarEnvioProvincia, nombreZona,
} from "@/lib/envioNacional";
import { useVolumenCarrito } from "@/hooks/useVolumenCarrito";
import { WHATSAPP_NUMBER } from "@/config";
import { useCheckoutPrefill, elegirDireccion, distritoDeTarifa } from "@/hooks/useCheckoutPrefill";
import { DireccionesGuardadas } from "@/components/checkout/DireccionesGuardadas";
import type { Address } from "@/lib/perfil.functions";




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

// Cargo fijo por el segundo viaje cuando el cliente elige "entrega parcial"
// en un pedido mixto (parte disponible ya, parte por conseguir). Ajustable.
const CARGO_ENVIO_PARCIAL = 25;

function generateOrderId() {
  
  // Niubiz exige purchaseNumber numérico de máximo 12 dígitos
  return String(Date.now()).slice(-12);
}

type ModalTipo = "exitoso" | "error" | null;
// Para "exitoso" se usa el detalle completo del pedido (PagoExitoso); para "error", PagoRechazado.
interface ModalDatos extends Partial<PagoExitosoDatos> {
  actionDesc?: string;
  actionCode?: string | number;
  sinConfirmar?: boolean;
}

// const API = import.meta.env.VITE_API_URL ?? "";
import { API_URL as API } from "@/config";
import { trackEvent, getSessionId } from "@/hooks/useEventTracking";
import { trackLead } from "@/lib/analytics";
import { syncCartSnapshot, markCartRecovered } from "@/lib/carrito.functions";
import { leerCuponSalida } from "@/lib/cupon-salida";
import { TerminosCheckout } from "@/components/checkout/TerminosCheckout";
import { PagoExitoso, type PagoExitosoDatos } from "@/components/checkout/PagoExitoso";
import { PagoRechazado, type PagoRechazadoDatos } from "@/components/checkout/PagoRechazado";

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
  const { items, total, clearCart, updateQty, removeItem } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  // ── Todos los refs aquí, en el cuerpo del componente ──────
  const jsUrlRef      = useRef<string | null>(null);
  const orderIdRef    = useRef<string>("");
  const niubizRef     = useRef<{ sessionKey: string; merchantId: string } | null>(null);
  const orderSavedRef = useRef(false); // ← evita guardar el pedido dos veces

  const [modalTipo, setModalTipo] = useState<ModalTipo>(null);
  const [modalDatos, setModalDatos] = useState<ModalDatos>({});
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nombre: "", email: "", telefono: "", dni: "",
    direccion: "", ciudad: "Lima", notas: "",
    // Envío a provincias (solo se usan si destino === "provincia")
    departamento: "", provincia: "",
    // Distrito elegido en la ficha del producto ("Calcula tu envío"); solo si está en el tarifario
    distrito: (() => {
      const g = leerDistritoGuardado();
      return DISTRITOS_ENVIO.some((d) => d.destino === g) ? g : "";
    })(),
  });

  // ── Autocompletar con "Mis datos" y "Mis direcciones" de la cuenta ──────────
  // Solo rellena campos VACÍOS (nunca pisa lo que el cliente ya escribió) y una sola vez por sesión.
  const { listo: prefillListo, perfil, direcciones } = useCheckoutPrefill(user?.id);
  const prefillRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !prefillListo || prefillRef.current === user.id) return;
    prefillRef.current = user.id;
    const nombreCompleto = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ").trim();
    // El campo DNI/RUC del checkout solo acepta 8 u 11 dígitos; CE/pasaporte se escriben a mano
    const doc = /^\d{8}(\d{3})?$/.test(perfil?.doc_numero ?? "") ? (perfil?.doc_numero as string) : "";
    setForm((f) => {
      const dir = f.direccion ? null : elegirDireccion(direcciones, f.distrito);
      return {
        ...f,
        nombre:   f.nombre   || nombreCompleto,
        email:    f.email    || (user.email ?? ""),
        telefono: f.telefono || (perfil?.telefono_principal ?? ""),
        dni:      f.dni      || doc,
        ...(dir ? {
          direccion: dir.direccion,
          distrito:  f.distrito || distritoDeTarifa(dir.distrito),
          ciudad:    dir.ciudad || f.ciudad,
          notas:     f.notas || (dir.referencia ?? ""),
        } : {}),
      };
    });
  }, [user, prefillListo, perfil, direcciones]);

  // Cambiar de dirección guardada con un toque (la referencia solo reemplaza notas vacías o también autocompletadas)
  const aplicarDireccion = (a: Address) =>
    setForm((f) => ({
      ...f,
      direccion: a.direccion,
      distrito:  distritoDeTarifa(a.distrito),
      ciudad:    a.ciudad || "Lima",
      notas:     !f.notas || direcciones.some((x) => x.referencia && x.referencia === f.notas) ? (a.referencia ?? "") : f.notas,
    }));

  // ── Cupón de descuento ─────────────────────────────────────
  const [cuponCodigo, setCuponCodigo] = useState("");
  const [cuponAplicado, setCuponAplicado] = useState<{
    codigo: string;
    descuento: number;
  } | null>(null);
  const [validandoCupon, setValidandoCupon] = useState(false);
  const [errorCupon, setErrorCupon] = useState<string | null>(null);

  // ── Disponibilidad / modo de entrega (pedidos mixtos) ─────
  const [disponibilidad, setDisponibilidad] = useState<{
    requiere_eleccion_modo_entrega: boolean;
    fecha_entrega_disponible: string;
    fecha_entrega_backorder: string;
  } | null>(null);
  const [modoEntrega, setModoEntrega] = useState<"unificada" | "parcial">("unificada");
  const [checkingDisponibilidad, setCheckingDisponibilidad] = useState(false);
  const [metodoEntrega, setMetodoEntrega] = useState<"domicilio" | "recojo_tienda">("domicilio");
  // "lima" = Lima Metropolitana y Callao (tarifa por distrito, se cobra en línea).
  // "provincia" = resto del país: flete estimado por volumen, se confirma por WhatsApp y NO se cobra en Niubiz.
  const [destino, setDestino] = useState<"lima" | "provincia">("lima");
  const { volumenTotal, faltaVolumen } = useVolumenCarrito(items);

  useEffect(() => {
    if (items.length === 0) { setDisponibilidad(null); return; }
    setCheckingDisponibilidad(true);
    supabase
      .rpc("verificar_disponibilidad_carrito", {
        _items: items.map((it) => ({ product_id: it.id, qty: it.qty })),
      })
      .then(({ data, error }) => {
        if (error) { console.error("Error verificando disponibilidad:", error.message); return; }
        setDisponibilidad(data as any);
      })
      .finally(() => setCheckingDisponibilidad(false));
  }, [items]);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const subtotal        = total();
  const requiereEleccion = disponibilidad?.requiere_eleccion_modo_entrega ?? false;
  const cargoParcial     = (metodoEntrega === "domicilio" && requiereEleccion && modoEntrega === "parcial") ? CARGO_ENVIO_PARCIAL : 0;
  const esProvincia      = metodoEntrega === "domicilio" && destino === "provincia";
  const estimacion       = esProvincia && form.departamento && form.provincia
    ? estimarEnvioProvincia(form.departamento, form.provincia, volumenTotal, faltaVolumen)
    : null;
  // En provincias el flete NO entra al total cobrado (es estimado y se confirma después).
  const envioBase        = (metodoEntrega === "recojo_tienda" || esProvincia) ? 0 : getPrecioEnvio(form.distrito);
  const envio            = (envioBase ?? 0) + cargoParcial;
  const descuentoCupon   = cuponAplicado?.descuento ?? 0;
  const totalFinal       = subtotal + envio - descuentoCupon;
  const distritoSinCobertura = metodoEntrega === "domicilio" && !esProvincia && form.distrito !== "" && envioBase === null;
  const provinciaIncompleta  = esProvincia && (!form.departamento || !form.provincia || !form.distrito.trim());
  const linkFleteWhatsApp = (() => {
    if (!esProvincia || !WHATSAPP_NUMBER) return null;
    const texto = `Hola, quiero cotizar el envío a ${form.provincia || "mi provincia"}, ${form.departamento || ""} para mi pedido (${volumenTotal > 0 ? volumenTotal + " m³" : "volumen por definir"}).`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`;
  })();

  // Si cambian los productos del carrito, el cupón aplicado puede dejar de
  // ser válido (ej. era por categoría/producto específico) — se limpia y
  // se vuelve a validar al tocar "Aplicar" de nuevo, para no cobrar un
  // descuento que ya no corresponde.
  useEffect(() => {
    if (cuponAplicado) {
      setCuponAplicado(null);
      setErrorCupon("Tu carrito cambió — vuelve a aplicar el cupón");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // Cupón de salida guardado en este navegador: se rellena y se aplica solo (una vez)
  const [cuponAuto, setCuponAuto] = useState(false);
  useEffect(() => {
    const guardado = leerCuponSalida();
    if (guardado && !cuponCodigo && !cuponAplicado) {
      setCuponCodigo(guardado.codigo);
      setCuponAuto(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (cuponAuto && cuponCodigo && items.length > 0 && !cuponAplicado) {
      setCuponAuto(false);
      validarCupon();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuponAuto, cuponCodigo, items.length]);

  async function validarCupon() {
    if (!cuponCodigo.trim()) return;
    setValidandoCupon(true);
    setErrorCupon(null);
    try {
      const res = await fetch(`${API}/api/cupones/validar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: cuponCodigo,
          items: items.map((i) => ({ product_id: i.id, qty: i.qty })),
          user_id: user?.id ?? null,
        }),
      });
      const data = await res.json();
      if (data.valid) {
        setCuponAplicado({ codigo: data.codigo, descuento: data.descuento });
        toast.success(`Cupón aplicado: -${fmt(data.descuento)}`);
      } else {
        setCuponAplicado(null);
        setErrorCupon(data.motivo ?? "Cupón no válido");
      }
    } catch {
      setErrorCupon("No pudimos validar el cupón, intenta de nuevo");
    } finally {
      setValidandoCupon(false);
    }
  }

  function quitarCupon() {
    setCuponAplicado(null);
    setCuponCodigo("");
    setErrorCupon(null);
  }

  useEffect(() => {
  if (items.length === 0) return;

  trackEvent({
    tipo: "checkout_iniciado",
    valor: total(),
  });
}, []);

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
  const purchaseNumber =
    allParams.purchaseNumber || orderIdRef.current || saved.orderNumber || generateOrderId();

  const utmData = getStoredUtm();
  fetch(`${API}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order: {
        // Dentro del payload que construyes antes de INSERT
        user_id: user?.id ?? null,
        orderNumber:      purchaseNumber,
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
        cupon_codigo:     saved.cuponCodigo ?? null,     // ← nuevo: se revalida en el servidor
        modo_entrega:     saved.modoEntrega ?? null,
        metodo_entrega:   saved.metodoEntrega ?? "domicilio",
        // Envío nacional: el servidor recalcula zona y estimado (no confía en el navegador)
        destino:          saved.destino ?? "lima",
        departamento:     saved.destino === "provincia" ? (saved.departamento ?? null) : null,
        provincia:        saved.destino === "provincia" ? (saved.provincia ?? null) : null,
        sessionKey:       niubizRef.current?.sessionKey ?? "",
        transactionToken,
        // UTM
        utm_source: utmData.utm_source ?? null,
        utm_medium: utmData.utm_medium ?? null,
        utm_campaign: utmData.utm_campaign ?? null,
        utm_content: utmData.utm_content ?? null,
        referrer_url: utmData.referrer_url ?? null,
      },
      items: items.map((item) => ({
        product_id: item.id,
        sku:        item.sku ?? null,
        title:      item.title,
        qty:        item.qty,
        price:      item.price,
        image:      item.image ?? null,
        comboId:    item.comboId ?? null,   // el servidor recalcula el precio del combo
      })),
    }),
  })
  .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
  .then(({ ok, data }) => {
    // El servidor autoriza el cobro con Niubiz: solo si responde success hay pedido pagado.
    if (!ok || !data?.success) {
      // Con error/actionCode el servidor sí obtuvo respuesta (rechazo); sin ellos no se pudo confirmar.
      const rechazo = Boolean(data?.error || data?.actionCode);
      setModalDatos({
        actionDesc:   data?.error,
        actionCode:   data?.actionCode,
        sinConfirmar: !rechazo,
        purchase:     purchaseNumber,
        date:         new Date().toLocaleString("es-PE"),
        amount:       (saved.total ?? totalFinal).toFixed(2),
        nombre:       saved.nombre,
        items: items.map((i) => ({ id: i.id, title: i.title, image: i.image ?? null, qty: i.qty, price: i.price })),
      });
      setModalTipo("error");
      return;
    }
    // Evento de compra exitosa
    trackEvent({
      tipo: "orden_pagada",
      order_id: purchaseNumber,
      valor: saved.total ?? totalFinal,
    });
    if (data?.orderId) {
      markCartRecovered({ session_id: getSessionId(), order_id: data.orderId });
    }

    clearCart();
    setModalDatos({
      purchase: purchaseNumber,
      date:     new Date().toLocaleString("es-PE"),
      amount:   (saved.total ?? totalFinal).toFixed(2),
      currency: "PEN",
      nombre:        saved.nombre,
      email:         saved.email,
      direccion:     saved.direccion,
      distrito:      saved.distrito,
      metodoEntrega: saved.metodoEntrega ?? "domicilio",
      modoEntrega:   saved.modoEntrega ?? null,
      provinciaEnvio: saved.destino === "provincia" ? (saved.provincia ?? undefined) : undefined,
      subtotal:      saved.subtotal,
      envio:         saved.envio,
      items: items.map((i) => ({ id: i.id, title: i.title, image: i.image ?? null, qty: i.qty, price: i.price })),
    });
    setModalTipo("exitoso");
    // Sin redirección automática: la pantalla de éxito tiene sus propios botones ("Ver mi pedido", etc.)
  })
  .catch((err) => {
    console.error("Error guardando pedido:", err);
    setModalDatos({
      sinConfirmar: true,
      purchase:     purchaseNumber,
      date:         new Date().toLocaleString("es-PE"),
      amount:       (saved.total ?? totalFinal).toFixed(2),
      nombre:       saved.nombre,
      items: items.map((i) => ({ id: i.id, title: i.title, image: i.image ?? null, qty: i.qty, price: i.price })),
    });
    setModalTipo("error");
  });
}, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lógica real de pago (Niubiz) — se llama tras validar y, si hace falta, loguearse ──
  const procederAlPago = async () => {
    setLoading(true);

    // Guarda nombre/teléfono/email en el snapshot del carrito: si abandona
    // justo aquí (o en la pasarela de pago), igual queda con quién contactar.
    syncCartSnapshot({
      session_id: getSessionId(),
      items: items.map((i) => ({ id: i.id, title: i.title, price: i.price, qty: i.qty, image: i.image, sku: i.sku })),
      subtotal,
      nombre: form.nombre,
      email: form.email,
      telefono: form.telefono,
      distrito: form.distrito,
      user_id: user?.id ?? null,
    });

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
        orderNumber: orderId,   // sobrevive al redirect de Niubiz (orderIdRef se pierde al recargar)
        userId: user?.id ?? null,
        subtotal,
        envio,
        total: totalFinal,
        cuponCodigo: cuponAplicado?.codigo ?? null,   // ← nuevo
        modoEntrega: requiereEleccion ? modoEntrega : null,
        metodoEntrega,
        destino: esProvincia ? "provincia" : "lima",
        ciudad: esProvincia ? form.provincia : form.ciudad,
      }));

      window.VisanetCheckout.open();
    } catch (err) {
      console.error("Error Niubiz:", err);
      toast.error(err instanceof Error ? err.message : "Error al conectar con la pasarela de pago.");
    } finally {
      setLoading(false);
    }
  };

  // ── Submit → valida, pide login recién aquí si hace falta, y paga ──
  const handlePagar = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { toast.error("Tu carrito está vacío"); return; }
    if (!aceptaTerminos) { toast.error("Debes aceptar los Términos y condiciones para continuar"); return; }
    if (provinciaIncompleta) { toast.error("Completa departamento, provincia y distrito / localidad"); return; }
    if (metodoEntrega === "domicilio" && !esProvincia && !form.distrito) { toast.error("Selecciona tu distrito para calcular el envío"); return; }
    if (metodoEntrega === "domicilio" && distritoSinCobertura) { toast.error("No tenemos tarifa para ese distrito todavía"); return; }

    if (!user) {
      setLoginOpen(true);
      return;
    }
    procederAlPago();
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

        <div className="grid lg:grid-cols-[1fr_420px] gap-10 min-w-0">
          {/* ── Formulario ── */}
          <form onSubmit={handlePagar} className="space-y-8 min-w-0">

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
              <h2 className="font-display text-xl font-semibold">
                {metodoEntrega === "domicilio" ? "Dirección de entrega" : "Recojo en tienda"}
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMetodoEntrega("domicilio")}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    metodoEntrega === "domicilio" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <p className="text-sm font-medium">Envío a domicilio</p>
                  <p className="text-xs text-muted-foreground">Según tarifa por distrito</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMetodoEntrega("recojo_tienda")}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    metodoEntrega === "recojo_tienda" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <p className="text-sm font-medium">Recojo en tienda</p>
                  <p className="text-xs font-semibold text-green-600">Sin costo de envío</p>
                </button>
              </div>

              {metodoEntrega === "domicilio" ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                    {([
                      ["lima", "Lima y Callao", "Se cobra aquí, según tu distrito"],
                      ["provincia", "Otras provincias", "Flete estimado; lo confirmamos por WhatsApp"],
                    ] as const).map(([val, titulo, sub]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setDestino(val)}
                        className={`p-2.5 rounded-lg border text-left transition-colors ${
                          destino === val ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <p className="text-sm font-medium">{titulo}</p>
                        <p className="text-[11px] text-muted-foreground">{sub}</p>
                      </button>
                    ))}
                  </div>
                  {user && !esProvincia && (
                    <DireccionesGuardadas
                      direcciones={direcciones}
                      direccionActual={form.direccion}
                      distritoActual={form.distrito}
                      onElegir={aplicarDireccion}
                    />
                  )}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="direccion">Dirección</Label>
                    <Input id="direccion" required value={form.direccion} onChange={set("direccion")} placeholder="Av. Principal 123, Dpto 4B" />
                  </div>
                  {!esProvincia ? (
                    <>
                        <div className="space-y-1.5">
                          <Label htmlFor="distrito">Distrito</Label>
                          <Select
                            value={form.distrito || undefined}
                            onValueChange={(v) => setForm((f) => ({ ...f, distrito: v }))}
                          >
                            <SelectTrigger id="distrito">
                              <SelectValue placeholder="Selecciona tu distrito…" />
                            </SelectTrigger>
                            <SelectContent>
                              {DISTRITOS_ENVIO.map((d) => (
                                <SelectItem key={d.destino} value={d.destino}>
                                  {d.destino} — {fmt(d.precio)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="ciudad">Ciudad</Label>
                          <Input id="ciudad" required value={form.ciudad} onChange={set("ciudad")} placeholder="Lima" />
                        </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="departamento">Departamento</Label>
                        <Select
                          value={form.departamento || undefined}
                          onValueChange={(v) => setForm((f) => ({ ...f, departamento: v, provincia: "" }))}
                        >
                          <SelectTrigger id="departamento"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                          <SelectContent>
                            {DEPARTAMENTOS_PROVINCIA.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="provincia">Provincia</Label>
                        <Select
                          value={form.provincia || undefined}
                          onValueChange={(v) => setForm((f) => ({ ...f, provincia: v }))}
                          disabled={!form.departamento}
                        >
                          <SelectTrigger id="provincia"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                          <SelectContent>
                            {provinciasDe(form.departamento).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="distrito_libre">Distrito / localidad</Label>
                        <Input
                          id="distrito_libre" required value={form.distrito}
                          onChange={set("distrito")} placeholder="Ej. Yanahuara"
                        />
                      </div>
                      <div className="sm:col-span-2 rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                        <p className="font-medium text-sm">Envío a provincias</p>
                        <p className="text-muted-foreground">
                          Hoy pagas solo tus muebles. El flete se calcula por volumen y destino, y te lo confirmamos por
                          WhatsApp antes de despachar. Puedes elegir recojo en agencia, que sale más económico.
                        </p>
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="notas">Notas adicionales (opcional)</Label>
                    <Input id="notas" value={form.notas} onChange={set("notas")} placeholder="Referencias, horario preferido de entrega..." />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted/40 text-sm">
                    <p className="font-medium">Tienda G&amp;M Mueblería — {ORIGEN_ENVIO}</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Te avisaremos por email/WhatsApp en cuanto tu pedido esté listo para recoger.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="notas">Notas adicionales (opcional)</Label>
                    <Input id="notas" value={form.notas} onChange={set("notas")} placeholder="Horario en que pasarás a recoger, etc." />
                  </div>
                </div>
              )}
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
                { icon: Truck,      text: "Envíos a todo el Perú" },
                { icon: Shield,     text: "Garantía de 2 años" },
                { icon: CreditCard, text: "Pago 100% seguro con Niubiz" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                  <Icon className="h-4 w-4 flex-shrink-0" /><span>{text}</span>
                </div>
              ))}
            </div>

            <TerminosCheckout aceptado={aceptaTerminos} onChange={setAceptaTerminos} />

            <Button
              type="submit" size="lg" className="w-full rounded-full h-12 text-base"
              disabled={loading || !aceptaTerminos || (metodoEntrega === "domicilio" && (!form.distrito || distritoSinCobertura || provinciaIncompleta))}
            >
              {loading ? "Conectando con Niubiz..." : `Pagar — ${fmt(totalFinal)}`}
            </Button>
          </form>

          {/* ── Resumen ── */}
          <aside className="min-w-0">
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
                      {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                      <div className="flex items-center gap-1.5 mt-1">
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, item.qty - 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
                          aria-label="Restar"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-medium w-5 text-center">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, item.qty + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
                          aria-label="Sumar"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="ml-1.5 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Quitar producto"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <span className="text-sm font-semibold flex-shrink-0">{fmt(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>

              {requiereEleccion && (
                <div className="mt-4 pt-4 border-t border-border space-y-2">
                  <p className="text-sm font-medium">Tu pedido tiene productos con distinta disponibilidad</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Parte de tu pedido lo tenemos en almacén, y parte lo conseguimos especialmente para ti. Elige cómo prefieres recibirlo:
                  </p>

                  <button
                    type="button"
                    onClick={() => setModoEntrega("unificada")}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      modoEntrega === "unificada" ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">Recibir todo junto</p>
                        <p className="text-xs text-muted-foreground">
                          Entrega estimada: {disponibilidad?.fecha_entrega_backorder}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-green-600">Sin costo extra</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoEntrega("parcial")}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      modoEntrega === "parcial" ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">Recibir en dos envíos</p>
                        <p className="text-xs text-muted-foreground">
                          Lo disponible: {disponibilidad?.fecha_entrega_disponible} · Resto: {disponibilidad?.fecha_entrega_backorder}
                        </p>
                      </div>
                      <span className="text-xs font-semibold">+{fmt(CARGO_ENVIO_PARCIAL)}</span>
                    </div>
                  </button>
                </div>
              )}

              {/* ── Cupón de descuento ── */}
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <Label htmlFor="cupon" className="text-xs">¿Tienes un cupón?</Label>
                <div className="flex gap-2">
                  <Input
                    id="cupon"
                    value={cuponCodigo}
                    onChange={(e) => setCuponCodigo(e.target.value.toUpperCase())}
                    placeholder="CODIGO"
                    className="h-9 text-sm"
                    disabled={!!cuponAplicado}
                  />
                  {cuponAplicado ? (
                    <Button type="button" size="sm" variant="outline" onClick={quitarCupon}>
                      Quitar
                    </Button>
                  ) : (
                    <Button
                      type="button" size="sm" variant="outline"
                      onClick={validarCupon} disabled={validandoCupon || !cuponCodigo.trim()}
                    >
                      {validandoCupon ? "..." : "Aplicar"}
                    </Button>
                  )}
                </div>
                {errorCupon && <p className="text-xs text-destructive">{errorCupon}</p>}
                {cuponAplicado && (
                  <p className="text-xs text-green-600">
                    ✓ {cuponAplicado.codigo} aplicado — ahorras {fmt(cuponAplicado.descuento)}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    {metodoEntrega === "recojo_tienda"
                      ? "Recojo en tienda"
                      : esProvincia
                        ? `Envío${form.provincia ? ` (${form.provincia})` : ""}`
                        : `Envío${form.distrito ? ` (${form.distrito})` : ""}`}
                  </span>
                  <span>
                    {metodoEntrega === "recojo_tienda"
                      ? <span className="text-green-600">Sin costo</span>
                      : esProvincia
                        ? <span className="text-amber-600">Por confirmar</span>
                        : (form.distrito ? fmt(envio) : "—")}
                  </span>
                </div>
                {descuentoCupon > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Descuento ({cuponAplicado?.codigo})</span>
                    <span>-{fmt(descuentoCupon)}</span>
                  </div>
                )}
                {esProvincia && (
                  <div className="text-xs rounded-lg bg-amber-50 text-amber-900 border border-amber-200 p-2.5 space-y-1">
                    {!estimacion && <p>Elige departamento y provincia para ver un estimado del flete.</p>}
                    {estimacion?.tipo === "estimado" && (
                      <p>
                        Flete estimado ({nombreZona(estimacion.zona)}): <strong>{fmt(estimacion.min)} – {fmt(estimacion.max)}</strong>.
                        No se cobra ahora; es referencial y lo confirmamos por WhatsApp.
                      </p>
                    )}
                    {estimacion?.tipo === "cotizar" && (
                      <p>
                        {estimacion.motivo === "sin_volumen"
                          ? "Algunos productos aún no tienen volumen registrado, así que cotizamos tu envío manualmente."
                          : "Este destino requiere cotización especial."}
                      </p>
                    )}
                    {linkFleteWhatsApp && (
                      <a href={linkFleteWhatsApp} target="_blank" rel="noreferrer" className="underline font-medium" onClick={() => trackLead("whatsapp", { nombre: "Cotizar flete a provincia" })}>
                        Consultar el flete por WhatsApp
                      </a>
                    )}
                  </div>
                )}
                {metodoEntrega === "domicilio" && !esProvincia && !form.distrito && (
                  <p className="text-xs text-muted-foreground">Selecciona tu distrito para calcular el envío</p>
                )}
                {distritoSinCobertura && (
                  <p className="text-xs text-destructive">
                    No tenemos tarifa registrada para este distrito — te contactaremos para coordinar el envío.
                  </p>
                )}
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

      {modalTipo === "exitoso" ? (
        <PagoExitoso datos={{ purchase: "—", date: "", amount: "0", ...modalDatos }} />
      ) : (
        modalTipo === "error" && (
          <PagoRechazado
            datos={modalDatos as PagoRechazadoDatos}
            onReintentar={() => setModalTipo(null)}
            onVolver={() => navigate({ to: "/" })}
          />
        )
      )}

      <LoginModal
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={() => {
          setLoginOpen(false);
          procederAlPago();
        }}
      />
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
