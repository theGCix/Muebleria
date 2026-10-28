// src/hooks/useEvidencias.ts
// Evidencia fotográfica (opcional) del avance de un pedido.
// Tabla: order_evidencias. La sube el equipo (admin) y la ve el cliente en /perfil/pedidos.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/cloudinary";

export interface Evidencia {
  id: string;
  order_id: string;
  order_item_id: string | null;
  estado: string;
  foto_url: string;
  public_id: string | null;
  nota: string | null;
  created_at: string;
}

export const MAX_FOTO_MB = 10;

export const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  pagado: "Pago recibido",
  en_produccion: "En producción",
  control_calidad: "Control de calidad",
  listo_despacho: "Listo para despacho",
  enviado: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/** Lee las evidencias de un pedido (staff: todas; cliente: solo las de sus pedidos, por RLS). */
export function useEvidencias(orderId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["evidencias", orderId],
    enabled: !!orderId && enabled,
    queryFn: async (): Promise<Evidencia[]> => {
      const { data, error } = await supabase
        .from("order_evidencias" as any)
        .select("id, order_id, order_item_id, estado, foto_url, public_id, nota, created_at")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Evidencia[];
    },
  });
}

interface SubirInput {
  orderId: string;
  orderNumber: string;
  estado: string;
  files: File[];
  nota?: string;
  /** Si es true, encola un correo al cliente avisándole que hay fotos nuevas. */
  avisar?: boolean;
  email?: string | null;
  nombre?: string | null;
}

/** Sube una o varias fotos a Cloudinary y las registra. Opcionalmente avisa al cliente. */
export function useSubirEvidencias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubirInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const rows: Record<string, unknown>[] = [];

      for (const f of input.files) {
        if (f.size > MAX_FOTO_MB * 1024 * 1024) {
          throw new Error(`"${f.name}" pesa más de ${MAX_FOTO_MB} MB`);
        }
        const r = await uploadImage(f, `muebleria/evidencias/${input.orderNumber}`);
        rows.push({
          order_id: input.orderId,
          estado: input.estado,
          foto_url: r.secure_url,
          public_id: r.public_id,
          nota: input.nota?.trim() || null,
          created_by: auth.user?.id ?? null,
        });
      }

      const { error } = await supabase.from("order_evidencias" as any).insert(rows as any);
      if (error) throw new Error(error.message);

      if (input.avisar && input.email) {
        const origen = typeof window !== "undefined" ? window.location.origin : "";
        const { error: nErr } = await supabase.from("notificaciones").insert({
          order_id: input.orderId,
          destinatario_email: input.email,
          destinatario_nombre: input.nombre ?? null,
          tipo: "evidencia_pedido",
          canal: "email",
          asunto: `Mira cómo va tu pedido ${input.orderNumber} — G&M Mueblería`,
          mensaje:
            `Hola ${input.nombre ?? ""},\n\n` +
            `Subimos ${rows.length === 1 ? "una foto nueva" : `${rows.length} fotos nuevas`} del avance de tu pedido ${input.orderNumber}.\n` +
            `Puedes verlas en: ${origen}/perfil/pedidos\n\n` +
            `Gracias por confiar en G&M Mueblería.`,
        } as any);
        // Si el aviso falla no se pierde la foto: ya quedó guardada.
        if (nErr) console.warn("No se pudo encolar el aviso:", nErr.message);
      }
      return rows.length;
    },
    onSuccess: (_n, v) => qc.invalidateQueries({ queryKey: ["evidencias", v.orderId] }),
  });
}

/** Borra el registro. La imagen queda en Cloudinary (el preset sin firmar no permite borrar). */
export function useBorrarEvidencia(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("order_evidencias" as any).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evidencias", orderId] }),
  });
}

/** Agrupa por estado respetando el orden en que aparecen. */
export function agruparPorEstado(items: Evidencia[]) {
  const map = new Map<string, Evidencia[]>();
  for (const e of items) map.set(e.estado, [...(map.get(e.estado) ?? []), e]);
  return Array.from(map.entries());
}