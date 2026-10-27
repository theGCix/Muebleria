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
};

/** Foto principal del taller (arriba de la página). */
export const TALLER_PORTADA: string | undefined = undefined;

/** Fotos extra del taller y de piezas terminadas. Vacío = no se muestra la galería. */
export const TALLER_GALERIA: string[] = [];

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

/** Devuelve la URL lista para <img>, o null si no hay foto configurada. */
export function fotoUrl(ref: string | undefined, w = 900): string | null {
  const r = ref?.trim();
  if (!r) return null;
  return /^https?:\/\//i.test(r) ? r : cloudinaryUrl(r, { w });
}