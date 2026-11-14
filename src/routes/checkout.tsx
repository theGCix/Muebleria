// src/routes/checkout.tsx
// G&M Mueblería — Checkout con integración Niubiz (VisanetCheckout popup)
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
import { MetodosPago } from "@/components/checkout/MetodosPago";
import { efectivoDisponible, modalidadPago, desglosePago, type MetodoPago } from "@/lib/pagoEfectivo";
import { Footer } from "@/components/Footer";
import { LoginModal } from "@/components/LoginModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { calcLineId, useCartStore } from "@/stores/cartStore";
import { useValidarCarrito } from "@/hooks/useValidarCarrito";
import { CarritoAvisos } from "@/components/CarritoAvisos";
import {
  ArrowLeft, ShoppingBag, Truck, Shield, CreditCard,
  LogIn, Minus, Plus, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getStoredUtm } from "@/hooks/useUtm";
import { supabase } from "@/integrations/supabase/client";
import { DistritoCombobox } from "@/components/DistritoCombobox";
import { getPrecioEnvio, ORIGEN_ENVIO, ciudadDeDistrito, precioEnvioDesde } from "@/lib/envios";
import { guardarDistrito, leerDistritoGuardado } from "@/lib/entrega";
import {
  DEPARTAMENTOS_PROVINCIA, provinciasDe, estimarEnvioProvincia, nombreZona,
} from "@/lib/envioNacional";
import { useVolumenCarrito } from "@/hooks/useVolumenCarrito";
import { WHATSAPP_NUMBER } from "@/config";
import { useCheckoutPrefill, elegirDireccion, distritoDeTarifa, direccionUsable } from "@/hooks/useCheckoutPrefill";
import { DireccionesGuardadas, DireccionSeleccionada } from "@/components/checkout/DireccionesGuardadas";
import { OpcionesEntrega, type OpcionEntrega } from "@/components/checkout/OpcionesEntrega";
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
import { itemsDeCarrito, trackAddPaymentInfo, trackAddShippingInfo, trackLead } from "@/lib/analytics";
import { precalentarServidor } from "@/lib/precalentar";
import { ConfirmandoPagoOverlay } from "@/components/ConfirmandoPagoOverlay";
import { syncCartSnapshot, markCartRecovered } from "@/lib/carrito.functions";
import { leerCuponSalida } from "@/lib/cupon-salida";
import { TerminosCheckout } from "@/components/checkout/TerminosCheckout";
import { PagoExitoso, type PagoExitosoDatos } from "@/components/checkout/PagoExitoso";
import { fmtFechaHora } from "@/lib/fechas";
import { PagoRechazado, type PagoRechazadoDatos } from "@/components/checkout/PagoRechazado";

/** El servidor recalculó el pedido y el total del navegador estaba desactualizado. */
class PrecioCambioError extends Error {
  constructor(
    message: string,
    public total: number,
    public descuento: number,
    public lineas: { product_id: string; opciones?: string[] | null; unit_price: number }[],
  ) { super(message); }
}

async function fetchNiubizSession(payload: {
  amount: number;
  orderId: string;
  email?: string;
  /** Para que el servidor abra la sesión con el MISMO total que luego autoriza */
  items?: { product_id: string; qty: number; sku?: string | null; title?: string; comboId?: string | null; opciones?: string[] }[];
  order?: { metodo_entrega: string; modo_entrega: string | null; destino: string; distrito: string; metodo_pago?: string };
  cupon_codigo?: string | null;
  user_id?: string | null;
}) {
  const res = await fetch(`${API}/api/niubiz/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 409 && err.code === "PRECIO_CAMBIO") {
      throw new PrecioCambioError(err.error, Number(err.total), Number(err.descuento) || 0, err.lineas ?? []);
    }
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
  const { items, total, clearCart, updateQty, removeItem, actualizarPrecios } = useCartStore();
  // Revisión contra el servidor al entrar: si algo cambió se corrige y Pagar espera a que el cliente lo confirme
  const { avisos: avisosCarrito, pendiente: avisoPendiente, entendido: avisoEntendido } = useValidarCarrito(true);
  const [loading, setLoading] = useState(false);
  const [confirmandoPago, setConfirmandoPago] = useState(false);

  // Despierta Render (si está dormido) apenas el cliente entra al checkout
  useEffect(() => { precalentarServidor(); }, []);
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

  // Distrito elegido en la ficha del producto ("Calcula tu envío"): manda sobre la dirección predeterminada
  const [distritoFicha] = useState(() => distritoDeTarifa(leerDistritoGuardado()));

  const [form, setForm] = useState({
    nombre: "", email: "", telefono: "", dni: "",
    direccion: "", notas: "",
    // Envío a provincias (solo se usan si destino === "provincia")
    departamento: "", provincia: "",
    distrito: distritoFicha,
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
      notas:     !f.notas || direcciones.some((x) => x.referencia && x.referencia === f.notas) ? (a.referencia ?? "") : f.notas,
    }));

  // "Distrito" significa cosas distintas en Lima/Callao (del tarifario) y en provincias (texto libre):
  // al cambiar de zona se limpia lo que no corresponde y, en Lima, se retoma el distrito de la ficha.
  const cambiarDestino = (val: "lima" | "provincia") => {
    setDestino(val);
    setForm((f) => {
      const enTarifa = distritoDeTarifa(f.distrito) !== "";
      if (val === "provincia") return enTarifa ? { ...f, distrito: "" } : f;
      return enTarifa ? f : { ...f, distrito: distritoDeTarifa(leerDistritoGuardado()) };
    });
  };

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
  // UI de direcciones guardadas (Lima): «Cambiar» abre la lista; «Usar otra dirección» muestra los campos a mano.
  const [cambiandoDir, setCambiandoDir] = useState(false);
  const [dirManual, setDirManual] = useState(false);
  // Método de pago (Parte 8.4): tarjeta, Yape o Plin (Niubiz, total) o efectivo (recojo / contra entrega en Lima)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("tarjeta");
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

  // Selector único de entrega (solo interfaz; el estado sigue siendo metodoEntrega + destino)
  const opcionEntrega: OpcionEntrega = metodoEntrega === "recojo_tienda" ? "recojo" : destino;
  const elegirOpcionEntrega = (o: OpcionEntrega) => {
    if (o === "recojo") { setMetodoEntrega("recojo_tienda"); return; }
    setMetodoEntrega("domicilio");
    if (o !== destino) cambiarDestino(o);
  };

  // Direcciones guardadas (Lima y Callao): resumen de la elegida → lista para cambiar → campos a mano
  const guardadasUsables = user ? direcciones.filter(direccionUsable) : [];
  const hayGuardadas     = guardadasUsables.length > 0;
  const cargandoDirs     = !!user && !prefillListo;
  const dirSeleccionada  = guardadasUsables.find(
    (a) => a.direccion.trim() === form.direccion.trim() && distritoDeTarifa(a.distrito) === form.distrito,
  ) ?? null;
  const verResumen   = hayGuardadas && !!dirSeleccionada && !cambiandoDir && !dirManual;
  const verLista     = hayGuardadas && !dirManual && (cambiandoDir || !dirSeleccionada);
  const verCamposLima = !cargandoDirs && (!hayGuardadas || dirManual);
  const elegirGuardada = (a: Address) => { aplicarDireccion(a); setCambiandoDir(false); setDirManual(false); };
  const usarOtraDireccion = () => {
    setDirManual(true);
    setCambiandoDir(false);
    setForm((f) => ({ ...f, direccion: "" })); // el distrito se conserva: define el costo de envío
  };
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

  // Qué se paga ahora y qué queda en efectivo. Si el efectivo deja de estar disponible (p. ej. cambia a provincia),
  // se paga con tarjeta. El servidor recalcula y valida todo; esto solo muestra el monto correcto.
  const destinoPago: "lima" | "provincia" = esProvincia ? "provincia" : "lima";
  const efectivoOk = efectivoDisponible(metodoEntrega, destinoPago);
  const metodoPagoReal: MetodoPago = metodoPago === "efectivo" && !efectivoOk ? "tarjeta" : metodoPago;
  const modalidad = modalidadPago(metodoPagoReal, metodoEntrega, destinoPago);
  const esEfectivoRecojo = modalidad === "efectivo_recojo";
  const esAdelanto = modalidad === "efectivo_adelanto";
  const { ahora: pagoAhora, saldo: pagoSaldo } = desglosePago(modalidad, totalFinal, envio);
  const previoAdelanto = desglosePago("efectivo_adelanto", totalFinal, envio);

  // Un solo distrito para todo el sitio: lo que se elige aquí (select o dirección guardada) lo ven la ficha y las tarjetas
  useEffect(() => {
    if (esProvincia) return;
    const d = distritoDeTarifa(form.distrito);
    if (d) guardarDistrito(d);
  }, [form.distrito, esProvincia]);
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

  // add_shipping_info: cuando los datos de envío quedan completos (la guarda por sesión está en analytics).
  const envioCompleto =
    form.nombre.trim().length > 1 &&
    form.telefono.trim().length >= 6 &&
    (metodoEntrega === "recojo_tienda" ||
      (form.direccion.trim().length > 3 &&
        form.distrito.trim().length > 0 &&
        !distritoSinCobertura &&
        (!esProvincia || (form.departamento !== "" && form.provincia !== ""))));
  useEffect(() => {
    if (!envioCompleto || items.length === 0) return;
    trackAddShippingInfo(totalFinal, itemsDeCarrito(items), metodoEntrega);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envioCompleto]);

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
  setConfirmandoPago(true);
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
        metodo_pago:      saved.metodoPago ?? "tarjeta",   // el servidor valida y recalcula el adelanto
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
        opciones:   item.opciones,          // ids de opciones elegidas; el servidor valida, suma el ajuste y arma el título
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
        date:         fmtFechaHora(new Date()),
        amount:       (saved.montoPagado ?? saved.total ?? totalFinal).toFixed(2),
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
      date:     fmtFechaHora(new Date()),
      amount:   (saved.montoPagado ?? saved.total ?? totalFinal).toFixed(2),
      currency: "PEN",
      // Efectivo contra entrega: lo pagado ahora es el adelanto; el resto se cobra al entregar
      ...(saved.metodoPago === "efectivo" && saved.destino !== "provincia"
        ? { pagoEfectivo: "adelanto" as const, totalPedido: saved.total ?? totalFinal }
        : {}),
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
      date:         fmtFechaHora(new Date()),
      amount:       (saved.montoPagado ?? saved.total ?? totalFinal).toFixed(2),
      nombre:       saved.nombre,
      items: items.map((i) => ({ id: i.id, title: i.title, image: i.image ?? null, qty: i.qty, price: i.price })),
    });
    setModalTipo("error");
  })
  .finally(() => setConfirmandoPago(false));
}, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recojo en tienda con efectivo: no hay cobro online. Se registra el pedido (queda «por confirmar»;
  //    ventas lo confirma y entonces se reserva el stock) y se muestra la pantalla de éxito. ──
  const registrarPedidoEfectivo = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoginOpen(true); return; }
    const purchaseNumber = generateOrderId();
    const res = await fetch(`${API}/api/orders/efectivo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        order: {
          orderNumber: purchaseNumber,
          nombre: form.nombre, email: form.email, telefono: form.telefono, dni: form.dni, notas: form.notas,
          cupon_codigo: cuponAplicado?.codigo ?? null,
          metodo_entrega: "recojo_tienda", destino: "lima",
        },
        items: items.map((i) => ({
          product_id: i.id, sku: i.sku ?? null, title: i.title, qty: i.qty, price: i.price, image: i.image ?? null,
          comboId: i.comboId ?? null, opciones: i.opciones,
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.error ?? "No pudimos registrar tu pedido. Inténtalo de nuevo.");

    if (data.orderId) markCartRecovered({ session_id: getSessionId(), order_id: data.orderId });
    clearCart();
    setModalDatos({
      purchase: data.orderNumber ?? `GM-${purchaseNumber}`,
      date:     fmtFechaHora(new Date()),
      amount:   Number(data.total ?? totalFinal).toFixed(2),   // total del pedido, que se paga en tienda
      currency: "PEN",
      nombre:   form.nombre,
      email:    form.email,
      metodoEntrega: "recojo_tienda",
      pagoEfectivo: "recojo",
      subtotal: subtotal,
      envio:    0,
      items: items.map((i) => ({ id: i.id, title: i.title, image: i.image ?? null, qty: i.qty, price: i.price })),
    });
    setModalTipo("exitoso");
  };

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
      if (esEfectivoRecojo) { await registrarPedidoEfectivo(); return; }

      const orderId = generateOrderId();
      orderIdRef.current = orderId;

      const niubiz = await fetchNiubizSession({
        amount:  pagoAhora,
        orderId,
        email:   form.email,
        items: items.map((i) => ({ product_id: i.id, qty: i.qty, sku: i.sku ?? null, title: i.title, comboId: i.comboId ?? null, opciones: i.opciones })),
        order: {
          metodo_entrega: metodoEntrega,
          modo_entrega:   requiereEleccion ? modoEntrega : null,
          destino:        esProvincia ? "provincia" : "lima",
          distrito:       form.distrito,
          metodo_pago:    metodoPagoReal,
        },
        cupon_codigo: cuponAplicado?.codigo ?? null,
        user_id:      user?.id ?? null,
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
        amount:            pagoAhora.toFixed(2),
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
        metodoPago: metodoPagoReal,   // el retorno de Niubiz lo manda al servidor
        montoPagado: pagoAhora,       // lo que se cobra ahora (el total, o solo el adelanto en efectivo contra entrega)
        cuponCodigo: cuponAplicado?.codigo ?? null,   // ← nuevo
        modoEntrega: requiereEleccion ? modoEntrega : null,
        metodoEntrega,
        destino: esProvincia ? "provincia" : "lima",
        ciudad: esProvincia ? form.provincia : ciudadDeDistrito(form.distrito),
      }));

      window.VisanetCheckout.open();
    } catch (err) {
      if (err instanceof PrecioCambioError) {
        // Precios guardados en el carrito desactualizados: se corrigen y el cliente confirma el nuevo total
        actualizarPrecios(Object.fromEntries(err.lineas.map((l) => [calcLineId(l.product_id, l.opciones), l.unit_price])));
        if (cuponAplicado) {
          if (err.descuento > 0) setCuponAplicado({ codigo: cuponAplicado.codigo, descuento: err.descuento });
          else { setCuponAplicado(null); setCuponCodigo(""); setErrorCupon("El cupón ya no aplica a tu pedido"); }
        }
        toast.error(`Actualizamos los precios de tu pedido. El total correcto es ${fmt(err.total)}; revísalo y vuelve a pagar.`, { duration: 8000 });
        return;
      }
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
    if (avisoPendiente) { toast.error("Revisa los cambios en tu carrito y confirma con \"Entendido, continuar\""); return; }
    if (!aceptaTerminos) { toast.error("Debes aceptar los Términos y condiciones para continuar"); return; }
    if (provinciaIncompleta) { toast.error("Completa departamento, provincia y distrito / localidad"); return; }
    if (metodoEntrega === "domicilio" && !form.direccion.trim()) { toast.error("Elige o escribe tu dirección de entrega"); return; }
    if (metodoEntrega === "domicilio" && !esProvincia && !form.distrito) { toast.error("Selecciona tu distrito para calcular el envío"); return; }
    if (metodoEntrega === "domicilio" && distritoSinCobertura) { toast.error("No tenemos tarifa para ese distrito todavía"); return; }

    // add_payment_info: pasó la validación y va a pagar (si falta iniciar sesión, igual cuenta: ya decidió pagar)
    trackAddPaymentInfo(totalFinal, itemsDeCarrito(items));

    if (!user) {
      setLoginOpen(true);
      return;
    }
    procederAlPago();
  };

  if (items.length === 0 && modalTipo === null) {
    return (
      <div className="min-h-screen bg-background">
        <CheckoutHeader />
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
      <CheckoutHeader />
      {/* pb-32 en móvil: deja espacio para la barra de pago fija */}
      <main className="container mx-auto px-4 pt-10 pb-32 lg:pb-10 max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> Seguir comprando
        </Link>

        <h1 className="font-display text-4xl font-semibold mb-10">Finalizar compra</h1>

        <div className="grid lg:grid-cols-[1fr_420px] gap-10 min-w-0">
          {/* ── Formulario ── */}
          <form id="form-checkout" onSubmit={handlePagar} className="space-y-8 min-w-0">
            <CarritoAvisos avisos={avisosCarrito} onEntendido={avisoEntendido} />

            <section className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-xl font-semibold">Datos de contacto</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nombre">Nombre completo</Label>
                  <Input className="h-11" id="nombre" required value={form.nombre} onChange={set("nombre")} placeholder="Juan Pérez" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input className="h-11" id="email" type="email" required value={form.email} onChange={set("email")} placeholder="juan@email.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="telefono">Teléfono / Celular</Label>
                  <Input className="h-11" id="telefono" required value={form.telefono} onChange={set("telefono")} placeholder="+51 999 999 999" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dni">DNI / RUC</Label>
                  <Input className="h-11" id="dni" required value={form.dni} onChange={set("dni")} placeholder="12345678" maxLength={11} pattern="^\d{8}(\d{3})?$" title="DNI: 8 dígitos — RUC: 11 dígitos" />
                </div>
              </div>
            </section>

            <section className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-xl font-semibold">Entrega</h2>

              <OpcionesEntrega
                valor={opcionEntrega}
                onElegir={elegirOpcionEntrega}
                precioLima={
                  form.distrito && getPrecioEnvio(form.distrito) != null
                    ? fmt(getPrecioEnvio(form.distrito) as number)
                    : `Desde ${fmt(precioEnvioDesde())}`
                }
              />

              {metodoEntrega === "domicilio" ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {!esProvincia ? (
                    <>
                      {cargandoDirs && <div className="sm:col-span-2 h-20 rounded-lg bg-muted/40 animate-pulse" aria-hidden />}
                      {verResumen && dirSeleccionada && (
                        <div className="sm:col-span-2">
                          <DireccionSeleccionada
                            direccion={dirSeleccionada}
                            envio={getPrecioEnvio(form.distrito)}
                            fmt={fmt}
                            onCambiar={() => setCambiandoDir(true)}
                          />
                        </div>
                      )}
                      {verLista && (
                        <div className="sm:col-span-2">
                          <DireccionesGuardadas
                            direcciones={guardadasUsables}
                            direccionActual={form.direccion}
                            distritoActual={form.distrito}
                            envioDe={getPrecioEnvio}
                            fmt={fmt}
                            onElegir={elegirGuardada}
                            onUsarOtra={usarOtraDireccion}
                            onCancelar={dirSeleccionada ? () => setCambiandoDir(false) : undefined}
                          />
                        </div>
                      )}
                      {verCamposLima && (
                        <>
                          {hayGuardadas && (
                            <div className="sm:col-span-2">
                              <button
                                type="button"
                                onClick={() => { setDirManual(false); setCambiandoDir(true); }}
                                className="min-h-[44px] text-sm font-medium text-primary underline-offset-4 hover:underline"
                              >
                                ← Elegir una dirección guardada
                              </button>
                            </div>
                          )}
                          {/* Primero el distrito: define el costo del envío */}
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="distrito">Distrito</Label>
                            <DistritoCombobox
                              id="distrito"
                              value={form.distrito}
                              onChange={(v) => setForm((f) => ({ ...f, distrito: v }))}
                            />
                            <p className="text-xs text-muted-foreground">
                              {form.distrito
                                ? <>Envío a {form.distrito}: <b className="text-foreground">{fmt(getPrecioEnvio(form.distrito) ?? 0)}</b>{form.distrito === distritoFicha ? " · el distrito que elegiste en el producto" : ""}</>
                                : <>Envío desde {fmt(precioEnvioDesde())} según tu distrito.</>}
                            </p>
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="direccion">Dirección</Label>
                            <Input className="h-11" id="direccion" required value={form.direccion} onChange={set("direccion")} placeholder="Av. Principal 123, Dpto 4B" />
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {/* El aviso del flete va primero, antes de pedir datos */}
                      <div className="sm:col-span-2 rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                        <p className="font-medium text-sm">Envío a provincias</p>
                        <p className="text-muted-foreground">
                          Hoy pagas solo tus muebles. El flete se calcula por volumen y destino, y te lo confirmamos por
                          WhatsApp antes de despachar. Puedes elegir recojo en agencia, que sale más económico.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="departamento">Departamento</Label>
                        <Select
                          value={form.departamento || undefined}
                          onValueChange={(v) => setForm((f) => ({ ...f, departamento: v, provincia: "" }))}
                        >
                          <SelectTrigger id="departamento" className="h-11"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
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
                          <SelectTrigger id="provincia" className="h-11"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                          <SelectContent>
                            {provinciasDe(form.departamento).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="distrito_libre">Distrito / localidad</Label>
                        <Input
                          className="h-11" id="distrito_libre" required value={form.distrito}
                          onChange={set("distrito")} placeholder="Ej. Yanahuara"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="direccion">Dirección</Label>
                        <Input className="h-11" id="direccion" required value={form.direccion} onChange={set("direccion")} placeholder="Av. Principal 123, Dpto 4B" />
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="notas">Notas adicionales (opcional)</Label>
                    <Input className="h-11" id="notas" value={form.notas} onChange={set("notas")} placeholder="Referencias, horario preferido de entrega..." />
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
                    <Input className="h-11" id="notas" value={form.notas} onChange={set("notas")} placeholder="Horario en que pasarás a recoger, etc." />
                  </div>
                </div>
              )}
            </section>

            <section className="bg-card border border-border/50 rounded-xl p-6 space-y-3">
              <h2 className="font-display text-xl font-semibold">Método de pago</h2>
              <MetodosPago
                valor={metodoPagoReal}
                onElegir={setMetodoPago}
                efectivoDisponible={efectivoOk}
                modalidad={efectivoOk ? modalidadPago("efectivo", metodoEntrega, destinoPago) : "online_total"}
                adelanto={previoAdelanto.ahora}
                saldo={previoAdelanto.saldo}
                fmt={fmt}
              />
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

            {/* En móvil el botón de pagar vive en la barra fija inferior; este es el de escritorio */}
            <div className="hidden lg:block">
              <Button
                type="submit" size="lg" className="w-full rounded-full h-12 text-base"
                disabled={loading || avisoPendiente || !aceptaTerminos || (metodoEntrega === "domicilio" && (!form.distrito || distritoSinCobertura || provinciaIncompleta))}
              >
                {loading
                  ? (esEfectivoRecojo ? "Registrando tu pedido..." : "Conectando con Niubiz...")
                  : esEfectivoRecojo ? "Confirmar pedido"
                  : esAdelanto ? `Pagar adelanto — ${fmt(pagoAhora)}`
                  : `Pagar — ${fmt(totalFinal)}`}
              </Button>
            </div>
          </form>

          {/* ── Resumen ── */}
          <aside id="resumen-pedido" className="min-w-0 scroll-mt-4">
            <div className="bg-card border border-border/50 rounded-xl p-6 sticky top-6">
              <h2 className="font-display text-xl font-semibold mb-4">Resumen del pedido</h2>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.lineId} className="flex gap-3 items-center">
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
                          onClick={() => updateQty(item.lineId, item.qty - 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
                          aria-label="Restar"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-medium w-5 text-center">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.lineId, item.qty + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
                          aria-label="Sumar"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.lineId)}
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
                      <span className="text-xs font-semibold text-primary">Sin costo extra</span>
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
                    placeholder="Ingresa tu cupón"
                    className="h-11 text-sm"
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
                  <p className="text-xs text-accent-strong">
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
                      ? <span className="text-primary">Sin costo</span>
                      : esProvincia
                        ? <span className="text-muted-foreground">Por confirmar</span>
                        : (form.distrito ? fmt(envio) : "—")}
                  </span>
                </div>
                {descuentoCupon > 0 && (
                  <div className="flex justify-between text-accent-strong">
                    <span>Descuento ({cuponAplicado?.codigo})</span>
                    <span>-{fmt(descuentoCupon)}</span>
                  </div>
                )}
                {esProvincia && (
                  <div className="text-xs rounded-lg bg-muted text-foreground border border-border p-2.5 space-y-1">
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
                  <p className="text-xs text-muted-foreground">Envío desde {fmt(precioEnvioDesde())} según tu distrito. Elige el tuyo en la dirección de entrega.</p>
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
                {(esAdelanto || esEfectivoRecojo) && (
                  <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
                    <div className="flex justify-between"><span>Pagas ahora</span><b className="tabular-nums">{fmt(pagoAhora)}</b></div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{esEfectivoRecojo ? "Pagas en tienda al recoger" : "Saldo en efectivo al recibir"}</span>
                      <b className="tabular-nums text-foreground">{fmt(pagoSaldo)}</b>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />

      {/* E1: barra fija inferior (solo móvil) con total + Pagar. Los motivos por los que aún no se puede
          pagar (términos, distrito, avisos del carrito) los explica handlePagar con un mensaje. */}
      {modalTipo === null && !confirmandoPago && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur px-4 pt-3 lg:hidden"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground leading-tight">Total (IGV incluido)</p>
              <p className="font-display text-xl font-semibold leading-tight">{fmt(totalFinal)}</p>
              {(esAdelanto || esEfectivoRecojo) && (
                <p className="text-xs font-medium leading-tight">Pagas ahora {fmt(pagoAhora)}</p>
              )}
              <button
                type="button"
                className="-ml-1 inline-flex min-h-[44px] items-center px-1 text-xs font-medium text-primary underline underline-offset-2"
                onClick={() => document.getElementById("resumen-pedido")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                Ver resumen del pedido
              </button>
            </div>
            <Button
              type="submit"
              form="form-checkout"
              size="lg"
              className="h-12 min-w-[140px] rounded-full px-6 text-base"
              disabled={loading}
            >
              {loading ? "Conectando…" : esEfectivoRecojo ? "Confirmar" : esAdelanto ? "Pagar adelanto" : "Pagar"}
            </Button>
          </div>
        </div>
      )}

      <ConfirmandoPagoOverlay visible={confirmandoPago} />
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