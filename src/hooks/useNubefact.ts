// src/hooks/useNubefact.ts
// ════════════════════════════════════════════════════════════════
// Hook para emitir/anular comprobantes vía Nubefact desde el frontend
// ════════════════════════════════════════════════════════════════
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SERVER = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("No hay sesión activa");
  return { Authorization: `Bearer ${session.access_token}` };
}

export interface NubefactResult {
  aceptado: boolean;
  enlace_pdf: string;
  enlace_xml: string;
  hash: string;
  descripcion: string;
}

export function useNubefact() {
  const [loading, setLoading] = useState(false);

  /**
   * Emite el comprobante de una venta a SUNAT vía Nubefact.
   * Llama al endpoint del servidor (no expone el token al browser).
   */
  async function emitir(saleId: string): Promise<NubefactResult | null> {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${SERVER}/api/nubefact/emitir`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ sale_id: saleId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(`Error Nubefact: ${data.error ?? "Error desconocido"}`);
        return null;
      }

      if (data.aceptado) {
        toast.success("✅ Comprobante enviado y aceptado por SUNAT");
      } else {
        toast.warning(`⚠️ Nubefact respondió: ${data.descripcion}`);
      }

      return data as NubefactResult;
    } catch (err: any) {
      toast.error(`Error de conexión: ${err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }

  /**
   * Anula un comprobante ya aceptado por SUNAT.
   */
  async function anular(saleId: string, motivo: string): Promise<boolean> {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${SERVER}/api/nubefact/anular`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ sale_id: saleId, motivo }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(`Error al anular: ${data.error}`);
        return false;
      }

      toast.success("Comprobante anulado ante SUNAT");
      return true;
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { emitir, anular, loading };
}