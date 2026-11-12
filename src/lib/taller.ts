// src/lib/taller.ts
// Contenido de la página "Nuestro taller" (/nosotros).
//
// FOTOS: cada paso (y la portada y la galería) acepta una foto. Pon el public_id de Cloudinary
// (ej. "muebleria/taller/lijado") o una URL https completa. Si queda vacío, el paso se muestra
// sin foto y la página se ve bien igual: ve agregando fotos reales a medida que las tengas.
import { cloudinaryUrl } from "@/lib/cloudinary";

export type PasoTaller = {
  id: string;
  titulo: string;
  descripcion: string;
  /** Aclaración corta bajo el texto (ej. "Solo en sofás y sillas") */
  nota?: string;
  /** public_id de Cloudinary o URL https. Vacío = sin foto. */
  foto?: string;
  /** Texto alternativo de la foto: descríbela (qué se ve). Si falta, se usa el título del paso. */
  alt?: string;
};

export type FotoGaleria = {
  /** public_id de Cloudinary o URL https. */
  foto: string;
  /** Qué se ve en la foto (para lectores de pantalla). Si falta, se usa un texto genérico. */
  alt?: string;
};

export type MiembroEquipo = {
  nombre: string;
  rol: string;
  /** public_id de Cloudinary o URL https. Vacío = iniciales. */
  foto?: string;
};

export type VideoTaller = {
  /** URL de YouTube (watch, youtu.be o embed) o de un archivo de video (.mp4/.webm, p. ej. Cloudinary). */
  url: string;
  /** Texto del botón y título accesible del video. */
  titulo?: string;
  /** Imagen previa opcional (public_id de Cloudinary o URL https). */
  poster?: string;
};

/** Foto principal del taller (arriba de la página). */
export const TALLER_PORTADA: string | undefined = undefined;
/** Qué se ve en la portada (si hay foto). */
export const TALLER_PORTADA_ALT: string | undefined = undefined;

/** Fotos extra del taller y de piezas terminadas. Vacío = no se muestra la galería. */
export const TALLER_GALERIA: FotoGaleria[] = [];

/** Video del taller. Sin valor = no se muestra la sección. El reproductor solo se carga al pulsar «Ver video». */
export const TALLER_VIDEO: VideoTaller | undefined = undefined;

/** Equipo (nombre, rol y foto). Vacío = no se muestra la sección «El equipo». */
export const TALLER_EQUIPO: MiembroEquipo[] = [];

export const TALLER_PASOS: PasoTaller[] = [
  {
    id: "corte",
    titulo: "Selección y corte de la madera",
    descripcion:
      "Trabajamos con madera tornillo seca y tratada. Cortamos cada pieza según las medidas de tu mueble.",
  },
  {
    id: "lijado",
    titulo: "Lijado",
    descripcion:
      "Lijamos todas las piezas, primero con lija 120 y luego con 220, hasta dejar la superficie suave al tacto.",
  },
  {
    id: "armado",
    titulo: "Armado de la estructura",
    descripcion:
      "Ensamblamos la estructura y verificamos escuadra y nivel antes de pasar al acabado.",
  },
  {
    id: "acabado",
    titulo: "Sellado y acabado",
    descripcion:
      "Aplicamos fondo sellador (con 4 horas de secado) y dos manos de barniz o laca, respetando el secado entre capas.",
    nota: "El acabado exacto depende del modelo y de lo que elijas.",
  },
  {
    id: "tapizado",
    titulo: "Tapizado",
    descripcion:
      "Pegamos la espuma en asiento y respaldo, tapizamos y fijamos la tela con grapas tapiceras.",
    nota: "Solo en sofás y sillas.",
  },
  {
    id: "calidad",
    titulo: "Control de calidad",
    descripcion: "Revisamos la estabilidad, el nivel y el acabado visual de cada pieza antes de despacharla.",
  },
  {
    id: "embalaje",
    titulo: "Embalaje y despacho",
    descripcion: "Protegemos cada pieza con film stretch para que llegue a tu casa en buen estado.",
  },
];

/** Resuelve la URL de un video: YouTube (se embebe sin cookies) o archivo directo. null si no es válida. */
export function videoFuente(url: string | undefined): { tipo: "youtube"; id: string } | { tipo: "archivo"; src: string } | null {
  const u = url?.trim();
  if (!u || !/^https:\/\//i.test(u)) return null;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return { tipo: "youtube", id: yt[1] };
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(u) ? { tipo: "archivo", src: u } : null;
}

/** Devuelve la URL lista para <img>, o null si no hay foto configurada. */
export function fotoUrl(ref: string | undefined, w = 900): string | null {
  const r = ref?.trim();
  if (!r) return null;
  return /^https?:\/\//i.test(r) ? r : cloudinaryUrl(r, { w });
}