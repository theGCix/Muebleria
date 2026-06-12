// src/components/AsistenteChat.tsx
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

async function fetchCatalogo() {
  const { data } = await supabase
    .from("products")
    .select("nombre, precio, descripcion, categoria, sku")
    .eq("activo", true)
    .order("nombre");
  return data ?? [];
}

async function chatWithAssistant(
  messages: Message[],
  catalogo: any[]
): Promise<string> {
  const catalogoTexto = catalogo
    .map((p) => `- ${p.nombre} (${p.categoria ?? "General"}): S/ ${p.precio}${p.descripcion ? ` — ${p.descripcion.slice(0, 80)}` : ""}`)
    .join("\n");

  const systemPrompt = `Eres el asistente de G&M Mueblería, una empresa peruana que fabrica muebles artesanales en madera natural. Tu rol es ayudar a los clientes a elegir el mueble perfecto para su hogar.

Catálogo actual:
${catalogoTexto}

Responde siempre en español, de forma cálida y concisa (máximo 3 oraciones). Si el cliente describe su espacio o necesidad, recomienda productos específicos del catálogo. Si preguntan por precios, modelos o disponibilidad, usa solo la información del catálogo. Cuando menciones un producto, incluye su precio en Soles.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) throw new Error("Error al conectar con el asistente");
  const data = await res.json();
  return data.content?.[0]?.text ?? "Lo siento, no pude procesar tu consulta.";
}

export function AsistenteChat() {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "¡Hola! Soy el asistente de G&M Mueblería. ¿Qué tipo de mueble estás buscando para tu hogar?",
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: catalogo = [] } = useQuery({
    queryKey: ["catalogo-asistente"],
    queryFn: fetchCatalogo,
    staleTime: 600_000,
    enabled: open,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const reply = await chatWithAssistant(newMessages, catalogo);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Disculpa, hubo un error. Por favor intenta de nuevo." },
      ]);
    } finally {
      setLoading(false);
    }
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
            width: "min(320px, calc(100vw - 2rem))",
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
              <p className="text-xs opacity-80 mt-0.5">IA · Catálogo actualizado</p>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed"
                  style={
                    m.role === "user"
                      ? { background: "var(--primary)", color: "var(--primary-foreground)" }
                      : { background: "var(--muted)", color: "var(--foreground)" }
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl px-3.5 py-2.5 flex items-center gap-1.5"
                  style={{ background: "var(--muted)" }}
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Pensando...</span>
                </div>
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
            <Button size="sm" className="h-9 w-9 p-0 flex-shrink-0" onClick={send} disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}