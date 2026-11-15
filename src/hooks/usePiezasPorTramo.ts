// src/hooks/usePiezasPorTramo.ts
// Diapositivas del banner del home: una pieza real por tramo de presupuesto (la de mayor precio final que
// tiene foto). Misma consulta y caché que el catálogo del home: no agrega peticiones.
import { useMemo } from "react";
import { useCatalogoHome } from "@/hooks/useCatalogoHome";
import { TRAMOS, precioEnRango, type Tramo } from "@/lib/presupuesto";
import { piezasPorTramo } from "@/lib/portada";
import type { PiezaEscena } from "@/components/EscenaPortada";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { ofertaInfo } from "@/lib/pricing";

export interface DiapositivaPortada {
  tramo: Tramo;
  pieza: PiezaEscena;
}

export function usePiezasPorTramo() {
  const { data, isLoading } = useCatalogoHome(60);

  const diapositivas = useMemo<DiapositivaPortada[]>(() => {
    if (!data) return [];
    const candidatas = data.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precioFinal: ofertaInfo(p).precioFinal,
      foto: p.imagen_public_id ? cloudinaryUrl(p.imagen_public_id, { w: 720 }) : (p.imagen_url as string | null),
    }));
    return piezasPorTramo(candidatas, TRAMOS, (n, t) => precioEnRango(n, t)).map(({ tramo, pieza }) => ({
      tramo,
      pieza: { id: pieza.id, nombre: pieza.nombre, precioFinal: pieza.precioFinal, src: pieza.foto as string },
    }));
  }, [data]);

  return { diapositivas, cargando: isLoading };
}
