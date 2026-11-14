// src/lib/origen.ts
// «De dónde viene» cada producto, para la ficha. Sin DOM ni imports del proyecto (se prueba con Node).
//  - Manufactura (por defecto): se fabrica en el taller → siempre hay bloque, con los pasos del taller.
//  - Retail (de proveedor): solo hay bloque si el admin escribió procedencia o material. No se
//    inventa nada: lo que no está cargado no se muestra.

export interface OrigenDatos {
  material?: string;
  procedencia?: string;
  artesano?: string;
  dias_fabricacion?: number;
}

export interface PasoMin {
  id: string;
  titulo: string;
}

export interface ResumenOrigen {
  tipo: "taller" | "seleccion";
  titulo: string;
  /** Línea bajo el título (dirección del taller). */
  subtitulo: string | null;
  filas: { etiqueta: string; valor: string }[];
  pasos: PasoMin[];
}

const MAX_TEXTO = 120;

const texto = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim().slice(0, MAX_TEXTO);
  return t || undefined;
};

/** Lee el JSON de la base de forma defensiva (puede venir null, un string o campos de otro tipo). */
export function limpiarOrigen(raw: unknown): OrigenDatos {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: OrigenDatos = {};
  const material = texto(r.material);
  const procedencia = texto(r.procedencia);
  const artesano = texto(r.artesano);
  if (material) out.material = material;
  if (procedencia) out.procedencia = procedencia;
  if (artesano) out.artesano = artesano;
  const d = Number(r.dias_fabricacion);
  if (Number.isFinite(d) && d >= 1 && d <= 365) out.dias_fabricacion = Math.round(d);
  return out;
}

/** Formulario del admin (todo texto) → JSON a guardar, sin campos vacíos. */
export function origenParaGuardar(f: { material: string; procedencia: string; artesano: string; dias: string }): OrigenDatos {
  return limpiarOrigen({
    material: f.material,
    procedencia: f.procedencia,
    artesano: f.artesano,
    dias_fabricacion: f.dias.trim() === "" ? undefined : Number(f.dias.replace(",", ".")),
  });
}

/** El paso de tapizado solo aplica a sofás y sillas (categorías «muebles» y «comedores»). */
const CATEGORIAS_CON_TAPIZADO = new Set(["muebles", "comedores"]);

export function resolverOrigen(
  p: { tipo_gestion?: string | null; origen?: unknown; categoria?: string | null },
  ctx: { direccion: string; pasos: PasoMin[] },
): ResumenOrigen | null {
  const datos = limpiarOrigen(p.origen);

  if (p.tipo_gestion === "retail") {
    if (!datos.procedencia && !datos.material) return null;
    const filas: ResumenOrigen["filas"] = [];
    if (datos.procedencia) filas.push({ etiqueta: "Marca o procedencia", valor: datos.procedencia });
    if (datos.material) filas.push({ etiqueta: "Material", valor: datos.material });
    return { tipo: "seleccion", titulo: "Seleccionado por G&M Mueblería", subtitulo: null, filas, pasos: [] };
  }

  const filas: ResumenOrigen["filas"] = [];
  if (datos.material) filas.push({ etiqueta: "Material", valor: datos.material });
  if (datos.procedencia) filas.push({ etiqueta: "Procedencia del material", valor: datos.procedencia });
  if (datos.artesano) filas.push({ etiqueta: "Hecho por", valor: datos.artesano });
  if (datos.dias_fabricacion) {
    filas.push({ etiqueta: "Fabricación", valor: `${datos.dias_fabricacion} días hábiles aprox.` });
  }
  const tapiza = CATEGORIAS_CON_TAPIZADO.has((p.categoria ?? "").toLowerCase());
  return {
    tipo: "taller",
    titulo: "Fabricado en nuestro taller",
    subtitulo: ctx.direccion ? `Lima · ${ctx.direccion}` : "Lima",
    filas,
    pasos: ctx.pasos.filter((s) => s.id !== "tapizado" || tapiza),
  };
}
