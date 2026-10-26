import { supabase } from "@/integrations/supabase/client";

export type Herramienta = { nombre: string; resultado: "ok" | "vacio" | "error" };

export type ChatSesion = {
  id: string;
  created_at: string;
  ultimo_mensaje_at: string;
  total_mensajes: number;
  sin_resolver: boolean;
};

export type ChatMensaje = {
  id: number;
  sesion_id: string;
  rol: "user" | "assistant";
  contenido: string;
  herramientas: Herramienta[];
  agrego_carrito: boolean;
  sin_resolver: boolean;
  error: string | null;
  latencia_ms: number | null;
  modelo: string | null;
  created_at: string;
};

export type TurnoSinResolver = { respuesta: ChatMensaje; pregunta: string };

export type ResumenTurno = Pick<ChatMensaje, "latencia_ms" | "agrego_carrito" | "sin_resolver" | "error">;

// Las tablas chat_* aún no están en los tipos generados de Supabase.
// Cuando regeneres los tipos, reemplaza esto por supabase.from("chat_...") directo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabla = (nombre: string) => (supabase as any).from(nombre);

const desde = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString();

/** Tope de filas que se analizan para los indicadores (PostgREST devuelve 1000 por defecto). */
export const LIMITE_RESUMEN = 1000;

export async function listarSesiones(dias: number, soloSinResolver: boolean): Promise<ChatSesion[]> {
  let q = tabla("chat_sesiones")
    .select("*")
    .gte("ultimo_mensaje_at", desde(dias))
    .order("ultimo_mensaje_at", { ascending: false })
    .limit(200);
  if (soloSinResolver) q = q.eq("sin_resolver", true);
  const { data, error } = await q;
  if (error) throw error;
  return data as ChatSesion[];
}

export async function listarMensajesSesion(sesionId: string): Promise<ChatMensaje[]> {
  const { data, error } = await tabla("chat_mensajes")
    .select("*")
    .eq("sesion_id", sesionId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data as ChatMensaje[];
}

/** Datos mínimos de las respuestas del bot para calcular indicadores. */
export async function resumenTurnos(dias: number): Promise<ResumenTurno[]> {
  const { data, error } = await tabla("chat_mensajes")
    .select("latencia_ms, agrego_carrito, sin_resolver, error")
    .eq("rol", "assistant")
    .gte("created_at", desde(dias))
    .order("created_at", { ascending: false })
    .limit(LIMITE_RESUMEN);
  if (error) throw error;
  return data as ResumenTurno[];
}

/** Respuestas sin resolver, cada una con la pregunta del cliente que la originó. */
export async function listarSinResolver(dias: number): Promise<TurnoSinResolver[]> {
  const { data, error } = await tabla("chat_mensajes")
    .select("*")
    .eq("rol", "assistant")
    .eq("sin_resolver", true)
    .gte("created_at", desde(dias))
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const respuestas = data as ChatMensaje[];
  if (respuestas.length === 0) return [];

  const ids = [...new Set(respuestas.map((m) => m.sesion_id))];
  const { data: usuarios, error: e2 } = await tabla("chat_mensajes")
    .select("id, sesion_id, contenido")
    .eq("rol", "user")
    .in("sesion_id", ids)
    .order("id", { ascending: true })
    .limit(2000);
  if (e2) throw e2;

  const preguntas = usuarios as Pick<ChatMensaje, "id" | "sesion_id" | "contenido">[];
  return respuestas.map((respuesta) => {
    const previa = preguntas
      .filter((u) => u.sesion_id === respuesta.sesion_id && u.id < respuesta.id)
      .at(-1);
    return { respuesta, pregunta: previa?.contenido ?? "(pregunta no disponible)" };
  });
}

export function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.ceil(p * orden.length) - 1)];
}