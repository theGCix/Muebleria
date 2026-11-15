// src/hooks/useCampana.ts
// Campaña activa del home, calculada con datos reales:
//  - productos con oferta vigente (descuento_porcentaje + oferta_vence_el)
//  - nombre opcional desde config_general (clave "campana_nombre"), p. ej. "Días de locura"
// Si no hay ofertas vigentes devuelve null y el home muestra el hero normal.
// DECISIÓN DEL DUEÑO (2026-11-15): «Días de locura» NO sale hasta que él marque piezas como «súper rebaja» en el panel admin
// (no basta una oferta normal). Mientras esa función no exista, CAMPANA_POR_SUPER_REBAJA = false oculta la campaña en todo el
// sitio (portada, barra superior y reloj). Al implementar la súper rebaja, la campaña se calculará con esas piezas y se pondrá en true.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOfertas, type Product } from "./useProducts";
import { ofertaInfo } from "@/lib/pricing";

export interface Campana {
  /** Nombre de la campaña (config_general) o null si no hay uno configurado */
  nombre: string | null;
  /** Ofertas vigentes, de mayor a menor descuento */
  ofertas: Product[];
  maxDescuento: number;
  /** Vencimiento más próximo (ms epoch) o null si ninguna oferta vence */
  venceMs: number | null;
  /** true si todas las ofertas con vencimiento terminan casi a la vez (campaña única) */
  unificada: boolean;
}

/** Por encima de este plazo no mostramos reloj: un contador de 60 días no genera urgencia real */
const MAX_DIAS_CONTADOR = 30;

/** false = la campaña no se muestra (aún no existe la «súper rebaja» en el panel admin). */
const CAMPANA_POR_SUPER_REBAJA = false;

function useNombreCampana() {
  return useQuery({
    queryKey: ["config-campana-nombre"],
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      // config_general no está en types.ts; si la política RLS no deja leer, se ignora
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("config_general")
        .select("valor")
        .eq("clave", "campana_nombre")
        .maybeSingle();
      if (error) return null;
      const v = String(data?.valor ?? "").trim();
      return v.length > 0 ? v.slice(0, 40) : null;
    },
  });
}

export function useCampana(): { campana: Campana | null; isLoading: boolean } {
  const { data: ofertas = [], isLoading } = useOfertas(8);
  const { data: nombre = null } = useNombreCampana();

  if (!CAMPANA_POR_SUPER_REBAJA) return { campana: null, isLoading: false };
  if (isLoading || ofertas.length === 0) return { campana: null, isLoading };

  const vigentes = ofertas.filter((p) => ofertaInfo(p).activa);
  if (vigentes.length === 0) return { campana: null, isLoading: false };

  const venceTodos = vigentes
    .map((p) => (p.oferta_vence_el ? new Date(p.oferta_vence_el).getTime() : null))
    .filter((t): t is number => t != null);

  const min = venceTodos.length ? Math.min(...venceTodos) : null;
  const max = venceTodos.length ? Math.max(...venceTodos) : null;
  const dentroDePlazo = min != null && min - Date.now() <= MAX_DIAS_CONTADOR * 86400000;

  return {
    isLoading: false,
    campana: {
      nombre,
      ofertas: vigentes,
      maxDescuento: Math.max(...vigentes.map((p) => p.descuento_porcentaje ?? 0)),
      venceMs: dentroDePlazo ? min : null,
      unificada:
        min != null &&
        max != null &&
        max - min < 60 * 60 * 1000 &&
        venceTodos.length === vigentes.length,
    },
  };
}
