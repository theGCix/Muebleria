// src/lib/segmentos.ts
// Segmentación de clientes de G&M Mueblería: UNA sola lista para la portada, los formularios de
// leads, la base de datos (checks de 20261117_segmentacion_leads.sql) y el admin.
// Sin imports del proyecto (se prueba con Node).
//
// Dos preguntas, ambas opcionales:
//   · segmento: «¿para qué es?»   (motivo de compra o tipo de comprador)
//   · ambiente: «¿qué ambiente?»  (sala, comedor, recámara…)
// El presupuesto (lib/presupuesto.ts) y la ubicación (distrito de envío) ya se capturan aparte.

export const SEGMENTO_IDS = ["primer-hogar", "familia", "remodelacion", "regalo", "negocio", "proyecto"] as const;
export type SegmentoId = (typeof SEGMENTO_IDS)[number];

export const AMBIENTE_IDS = ["sala", "comedor", "recamara", "separador", "otro"] as const;
export type AmbienteId = (typeof AMBIENTE_IDS)[number];

export interface Segmento {
  id: SegmentoId;
  /** Nombre neutro (admin, reportes). */
  nombre: string;
  /** Texto en primera persona para el cliente. */
  chip: string;
  /** "motivo" = por qué compra; "comprador" = quién es. */
  grupo: "motivo" | "comprador";
}

export const SEGMENTOS: readonly Segmento[] = [
  { id: "primer-hogar", nombre: "Primer hogar", chip: "Mi primer hogar", grupo: "motivo" },
  { id: "familia", nombre: "Familia", chip: "Mi familia", grupo: "motivo" },
  { id: "remodelacion", nombre: "Remodelación o mudanza", chip: "Remodelación o mudanza", grupo: "motivo" },
  { id: "regalo", nombre: "Regalo o inauguración", chip: "Un regalo", grupo: "motivo" },
  { id: "negocio", nombre: "Negocio u oficina", chip: "Mi negocio u oficina", grupo: "comprador" },
  { id: "proyecto", nombre: "Diseñador, arquitecto o constructora", chip: "Diseñador o constructora", grupo: "comprador" },
];

export const AMBIENTES: readonly { id: AmbienteId; nombre: string }[] = [
  { id: "sala", nombre: "Sala" },
  { id: "comedor", nombre: "Comedor" },
  { id: "recamara", nombre: "Recámara" },
  { id: "separador", nombre: "Separador de ambiente" },
  { id: "otro", nombre: "Otro" },
];

export const esSegmento = (v: unknown): v is SegmentoId => typeof v === "string" && (SEGMENTO_IDS as readonly string[]).includes(v);
export const esAmbiente = (v: unknown): v is AmbienteId => typeof v === "string" && (AMBIENTE_IDS as readonly string[]).includes(v);

/** Lee un valor guardado (localStorage, base de datos) y lo devuelve solo si es un segmento válido. */
export const segmentoValido = (v: unknown): SegmentoId | null => (esSegmento(v) ? v : null);

export const nombreSegmento = (id: string | null | undefined): string | null =>
  SEGMENTOS.find((s) => s.id === id)?.nombre ?? null;

export const nombreAmbiente = (id: string | null | undefined): string | null =>
  AMBIENTES.find((a) => a.id === id)?.nombre ?? null;

/** Etiqueta de «¿Qué necesitas?» del formulario a medida → ambiente (null si no hay). */
export function ambienteDeTipo(tipo: string | null | undefined): AmbienteId | null {
  if (!tipo) return null;
  return AMBIENTES.find((a) => a.nombre.toLowerCase() === tipo.trim().toLowerCase())?.id ?? null;
}

export interface AccionSugerida {
  texto: string;
  /** "medida" = formulario «A medida» del home; "envios" = página de envíos y plazos. */
  destino: "medida" | "envios";
}

/**
 * Un solo atajo útil según el segmento. Primer hogar y familia no cambian nada: ya tienen el
 * selector de presupuesto, que es lo que necesitan. No se inventan ofertas ni descuentos.
 */
export function accionSugerida(segmento: SegmentoId | null): AccionSugerida | null {
  switch (segmento) {
    case "negocio":
      return { texto: "Pide una cotización por volumen o a medida", destino: "medida" };
    case "proyecto":
      return { texto: "Cotiza tu proyecto a medida", destino: "medida" };
    case "remodelacion":
      return { texto: "Fabricamos a la medida de tu espacio", destino: "medida" };
    case "regalo":
      return { texto: "Mira los plazos de entrega", destino: "envios" };
    default:
      return null;
  }
}
