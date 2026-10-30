// src/components/AsistenteChat.tsx
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Loader2, Sparkles, ArrowLeft, ArrowUpRight, Phone } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { API_URL as API, WHATSAPP_NUMBER } from "@/config";
import { trackLead } from "@/lib/analytics";
import { TEMAS_CHAT, type ChatLink, type PreguntaChat, type TemaChat } from "@/lib/chatSugerencias";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthModalStore } from "@/stores/authModalStore";

type ChatResult = { reply: string; cartActions: CartAction[]; links: ChatLink[] };
type Message = { role: "user" | "assistant"; content: string; links?: ChatLink[] };
type CartAction = {
  id: string; title: string; price: number;
  image?: string; sku?: string; cantidad: number;
};

/** Cabeceras del chat: si hay sesión, el servidor identifica al cliente y consulta SUS pedidos sin pedir número ni correo. */
async function cabeceras(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) h.Authorization = `Bearer ${data.session.access_token}`;
  } catch {
    /* sin sesión: el chat funciona igual */
  }
  return h;
}

async function chatWithAssistant(messages: Message[], sessionId: string): Promise<ChatResult> {
  const res = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: await cabeceras(),
    body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })), sessionId }),
  });
  if (!res.ok) throw new Error("Error al conectar con el asistente");
  const data = await res.json();
  return { reply: data.reply ?? "Lo siento, no pude procesar tu consulta.", cartActions: data.cartActions ?? [], links: data.links ?? [] };
}

type StreamHandlers = {
  onToken: (t: string) => void;
  onStatus: (t: string) => void;
  onReset: () => void;
};

/** El backend no tiene /api/chat/stream (versión anterior): se usa el modo sin streaming. */
class StreamNoDisponible extends Error {}

// Lee la respuesta por Server-Sent Events: status · token · reset · done · error
async function chatWithAssistantStream(
  messages: Message[],
  sessionId: string,
  h: StreamHandlers,
  signal?: AbortSignal,
): Promise<ChatResult> {
  const res = await fetch(`${API}/api/chat/stream`, {
    method: "POST",
    headers: await cabeceras(),
    body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })), sessionId }),
    signal,
  });
  if (res.status === 404) throw new StreamNoDisponible();
  if (!res.ok || !res.body) throw new Error("Error al conectar con el asistente");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let event = "message";
      let data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      const payload = data ? JSON.parse(data) : {};

      if (event === "token") h.onToken(payload.text ?? "");
      else if (event === "status") h.onStatus(payload.text ?? "");
      else if (event === "reset") h.onReset();
      else if (event === "error") throw new Error(payload.error ?? "Error del asistente");
      else if (event === "done") {
        result = {
          reply: payload.reply ?? "Lo siento, no pude procesar tu consulta.",
          cartActions: payload.cartActions ?? [],
          links: payload.links ?? [],
        };
      }
    }
  }
  if (!result) throw new Error("Respuesta incompleta del asistente");
  return result;
}

export function AsistenteChat() {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [estado, setEstado]   = useState("Pensando…");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "¡Hola! Soy el asistente de G&M Mueblería. Puedo ayudarte a encontrar el mueble ideal, revisar precios y stock, agregar productos a tu carrito, o consultar el estado de un pedido. ¿En qué te ayudo?",
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Id de la conversación (se guarda en Supabase para analítica); se renueva al recargar la página
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const [tema, setTema] = useState<TemaChat | null>(null);
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const items = useCartStore((s) => s.items);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, estado]);

  // Si el componente se desmonta, cancelamos la generación en curso
  useEffect(() => () => abortRef.current?.abort(), []);

  const aplicarAccionesCarrito = (acciones: CartAction[]) => {
    for (const a of acciones) {
      addItem({ id: a.id, title: a.title, price: a.price, image: a.image, sku: a.sku });
      const cantidad = a.cantidad ?? 1;
      if (cantidad > 1) {
        const previa = items.find((i) => i.id === a.id)?.qty ?? 0;
        updateQty(a.id, previa + cantidad);
      }
      toast.success(`"${a.title}" agregado al carrito desde el asistente`);
    }
  };

  const enviarPreguntaRapida = (item: PreguntaChat) => {
    if (loading) return;
    if (item.respuesta) {
      // Respuesta fija: no gasta IA, aparece al toque (con botones a las páginas relacionadas)
      setMessages((m) => [
        ...m,
        { role: "user", content: item.pregunta },
        { role: "assistant", content: item.respuesta!, links: item.links },
      ]);
    } else {
      // Necesita datos reales (precio, stock, pedido, envío): va directo a la IA
      void send(item.pregunta);
    }
  };

  const irA = (l: ChatLink) => {
    setOpen(false); // cierra el panel para que el cliente vea la página
    if (l.to === "#login") {
      useAuthModalStore.getState().openLogin();
      return;
    }
    // navigate() de TanStack es estricto con los tipos de ruta; los enlaces vienen de una lista cerrada
    void navigate({ to: l.to, params: l.params, search: l.search, hash: l.hash } as never);
  };

  // Reemplaza el contenido del último mensaje (el que se está "escribiendo")
  const editarUltimo = (fn: (prev: string) => string) =>
    setMessages((m) => {
      const copia = [...m];
      const last = copia[copia.length - 1];
      copia[copia.length - 1] = { ...last, content: fn(last.content) };
      return copia;
    });

  const ponerEnlacesUltimo = (links: ChatLink[]) =>
    setMessages((m) => {
      const copia = [...m];
      copia[copia.length - 1] = { ...copia[copia.length - 1], links };
      return copia;
    });

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setTema(null);

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    // Burbuja vacía del asistente que se irá llenando con el stream
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setEstado("Pensando…");
    setLoading(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      let result: ChatResult;
      try {
        result = await chatWithAssistantStream(
          newMessages,
          sessionIdRef.current,
          {
            onToken: (t) => editarUltimo((prev) => prev + t),
            onStatus: (t) => setEstado(t),
            onReset: () => editarUltimo(() => ""),
          },
          abort.signal,
        );
      } catch (e) {
        if (!(e instanceof StreamNoDisponible)) throw e;
        result = await chatWithAssistant(newMessages, sessionIdRef.current); // backend sin streaming
      }

      editarUltimo(() => result.reply);
      if (result.links.length > 0) ponerEnlacesUltimo(result.links);
      if (result.cartActions.length > 0) aplicarAccionesCarrito(result.cartActions);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      editarUltimo(() => "Disculpa, hubo un error. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Traspaso a una persona: abre WhatsApp con el contexto (página que ve + última consulta al asistente)
  const abrirWhatsApp = () => {
    if (!WHATSAPP_NUMBER) return;
    const path = window.location.pathname;
    const ultima = [...messages].reverse().find((m) => m.role === "user")?.content;
    const lineas = ["Hola G&M 👋 Vengo del asistente de la web."];
    if (/^\/(product|combo)\//.test(path)) {
      lineas.push(`Estoy viendo: ${document.title.split(" | ")[0]}`, window.location.href);
    }
    if (ultima) lineas.push(`Mi consulta: ${ultima.slice(0, 140)}`);
    trackLead("whatsapp_chat");
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lineas.join("\n"))}`, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        aria-label="Asistente de compra"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Panel de chat */}
      {open && (
        <div
          className="fixed bottom-24 right-4 z-50 rounded-2xl shadow-2xl border overflow-hidden flex flex-col"
          style={{
            background: "var(--background)",
            borderColor: "var(--border)",
            maxHeight: "70vh",
            width: "min(340px, calc(100vw - 2rem))",
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center gap-2.5"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <Sparkles className="h-4 w-4 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold leading-none">Asistente G&M</p>
              <p className="text-xs opacity-80 mt-0.5">IA · Catálogo y pedidos en vivo</p>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {messages.map((m, i) => (
              (m.role === "assistant" && !m.content) ? null : (
              <div
                key={i}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className="max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap"
                  style={
                    m.role === "user"
                      ? { background: "var(--primary)", color: "var(--primary-foreground)" }
                      : { background: "var(--muted)", color: "var(--foreground)" }
                  }
                >
                  {m.content}
                </div>
                {m.role === "assistant" && m.links && m.links.length > 0 && (
                  <div className="mt-1.5 flex max-w-[85%] flex-wrap gap-1.5">
                    {m.links.map((l) => (
                      <button
                        key={`${l.to}${l.label}`}
                        onClick={() => irA(l)}
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                        style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
                      >
                        {l.label}
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              )
            ))}
            {loading && !messages[messages.length - 1]?.content && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl px-3.5 py-2.5 flex items-center gap-1.5"
                  style={{ background: "var(--muted)" }}
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{estado}</span>
                </div>
              </div>
            )}
            {messages.length > 0 && messages[messages.length - 1].role === "assistant" && !loading && (
              <div className="flex flex-col gap-1.5 pt-1">
                {tema ? (
                  <>
                    <button
                      onClick={() => setTema(null)}
                      className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-3 w-3" /> Otros temas
                    </button>
                    {tema.preguntas.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => enviarPreguntaRapida(p)}
                        className="text-left text-xs px-3 py-2 rounded-xl border transition-colors hover:bg-muted"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">¿Sobre qué tema tienes dudas?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TEMAS_CHAT.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTema(t)}
                          className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-muted"
                          style={{ borderColor: "var(--border)" }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t flex gap-2" style={{ borderColor: "var(--border)" }}>
            <Input
              className="flex-1 text-sm h-9"
              placeholder="¿Qué mueble buscas?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={loading}
            />
            <Button size="sm" className="h-9 w-9 p-0 flex-shrink-0" onClick={() => send()} disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Traspaso a una persona (solo si hay WhatsApp configurado) */}
          {WHATSAPP_NUMBER && (
            <button
              type="button"
              onClick={abrirWhatsApp}
              className="flex items-center justify-center gap-1.5 border-t px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
              style={{ borderColor: "var(--border)", color: "#1f8f4e" }}
            >
              <Phone className="h-3.5 w-3.5" />
              ¿Prefieres hablar con una persona? Escríbenos por WhatsApp
            </button>
          )}
        </div>
      )}
    </>
  );
}