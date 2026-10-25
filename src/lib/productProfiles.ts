// src/lib/productProfiles.ts
// ─────────────────────────────────────────────────────────────────────────────
// Perfil de experiencia por tipo de producto. La ficha /product/$handle lee de
// aquí para adaptar: color de ambiente, textos, tarjetas de especificación,
// acabados, módulo interactivo "firma", preguntas frecuentes y mensajes de venta.
//
// ⚠️  Los textos de materiales / medidas son valores por defecto de la marca.
//     Revísalos y ajústalos: es el único archivo que hay que tocar para cambiar
//     el contenido por categoría.
// ─────────────────────────────────────────────────────────────────────────────
import {
  Armchair, BedDouble, Hammer, Layers, Lightbulb, Ruler, Sofa, Sparkles,
  TreeDeciduous, UtensilsCrossed, Columns3, type LucideIcon,
} from "lucide-react";

export type ProfileKey =
  | "tv" | "sala" | "comedor" | "recamara" | "separador" | "accesorio" | "generico";

export type SignatureModuleKey =
  | "tv-fit" | "seating" | "sleep" | "comfort" | "custom-space" | "none";

export interface Acabado { name: string; hex: string }
export interface SpecCard { icon: LucideIcon; label: string; value: string }
export interface Faq { q: string; a: string }

export interface ProductProfile {
  key: ProfileKey;
  /** Color de ambiente de la categoría (acentos, bordes, brillo del hero) */
  accent: string;
  accentSoft: string;
  /** Etiqueta corta sobre el título */
  eyebrow: string;
  /** Promesa en una línea, orientada al beneficio (no a la ficha técnica) */
  pitch: string;
  /** Texto de "para quién / dónde" */
  idealFor: string[];
  specs: SpecCard[];
  acabadoLabel: string;
  acabados: Acabado[];
  module: SignatureModuleKey;
  /** Título de la sección de venta cruzada */
  bundleTitle: string;
  bundleSub: string;
  faqs: Faq[];
  /** Características para la pestaña de especificaciones */
  features: string[];
}

const MADERA = "Madera tornillo seca y tratada";

const FAQ_ENTREGA: Faq = {
  q: "Tiempos de entrega",
  a: "Lima Metropolitana: 5–7 días hábiles. Provincias: 10–15 días hábiles. Este modelo se fabrica a pedido — coordinamos la fecha exacta al confirmar tu compra.",
};
const FAQ_DEVOLUCION: Faq = {
  q: "Política de devoluciones",
  a: "Al ser una pieza fabricada a medida, no se aceptan cambios una vez confirmado el pedido. Si hay un defecto de fabricación, reparamos o reponemos sin costo dentro del período de garantía.",
};

const PROFILES: Record<ProfileKey, ProductProfile> = {
  tv: {
    key: "tv",
    accent: "#B07A2B",
    accentSoft: "#F6EAD3",
    eyebrow: "Centro de entretenimiento",
    pitch: "Convierte la pared de tu TV en el punto focal de la sala — con luz que se siente de cine.",
    idealFor: ["Salas y dormitorios amplios", "Quienes quieren ocultar cables", "Ambientación con luz LED cálida"],
    specs: [
      { icon: TreeDeciduous, label: "Estructura", value: MADERA },
      { icon: Lightbulb, label: "Iluminación", value: "Perfiles con LED cálido" },
      { icon: Ruler, label: "Medida", value: "A tu pared y a tu TV" },
      { icon: Hammer, label: "Fabricación", value: "A pedido, en Lima" },
    ],
    acabadoLabel: "Acabado",
    acabados: [
      { name: "Nogal oscuro", hex: "#5B4033" },
      { name: "Roble natural", hex: "#B58B5D" },
      { name: "Grafito", hex: "#4A4D52" },
      { name: "Blanco humo", hex: "#E7E3DC" },
    ],
    module: "tv-fit",
    bundleTitle: "Termina tu rincón de TV",
    bundleSub: "Piezas de otras colecciones que armonizan con este mueble",
    faqs: [
      { q: "¿Se adapta a mi TV y a mi pared?", a: "Sí. Usa el medidor de arriba para ver el ancho recomendado según tus pulgadas, y cuéntanos las medidas de tu pared al cotizar: ajustamos el diseño." },
      { q: "Cuidado y mantenimiento", a: "Limpia con paño suave y seco o apenas húmedo. Evita químicos abrasivos y deja ventilación detrás de equipos que se calienten." },
      FAQ_ENTREGA, FAQ_DEVOLUCION,
    ],
    features: ["Fabricado artesanalmente en Perú", `Estructura de ${MADERA.toLowerCase()}`, "Paso de cables integrado", "Iluminación LED según diseño", "Garantía de 2 años en estructura"],
  },

  sala: {
    key: "sala",
    accent: "#B8806A",
    accentSoft: "#F4E3DB",
    eyebrow: "Sala · Tapizado a mano",
    pitch: "Hecho para quedarte horas: espuma de alta densidad, tapizado antifluidos y tú eliges el color.",
    idealFor: ["Familias con niños o mascotas", "Salas donde se recibe visitas", "Quienes valoran el confort diario"],
    specs: [
      { icon: TreeDeciduous, label: "Estructura", value: MADERA },
      { icon: Layers, label: "Tapizado", value: "Velvet importado + antifluida" },
      { icon: Sparkles, label: "Relleno", value: "Espuma alta densidad + napa" },
      { icon: Armchair, label: "Patas", value: "Metal dorado o negro" },
    ],
    acabadoLabel: "Color del tapizado",
    acabados: [
      { name: "Rosado blush", hex: "#E8D5CC" },
      { name: "Beige arena", hex: "#E8E0D0" },
      { name: "Gris topo", hex: "#C8BFB5" },
      { name: "Crema marfil", hex: "#D4C5A9" },
      { name: "Mocha", hex: "#B8A898" },
    ],
    module: "comfort",
    bundleTitle: "Completa tu sala",
    bundleSub: "Mesas, puffs y detalles que cierran el ambiente",
    faqs: [
      { q: "Cuidado y mantenimiento", a: "Limpia con paño húmedo sin químicos agresivos y evita el sol directo. Para el velvet, usa un cepillo suave en dirección del pelo. La estructura de madera puede aceitarse una vez al año." },
      FAQ_ENTREGA, FAQ_DEVOLUCION,
    ],
    features: ["Fabricado artesanalmente en Perú", `Estructura de ${MADERA.toLowerCase()}`, "Tapizado en velvet importado + tela antifluida", "Relleno en espuma de alta densidad", "Patas de metal dorado o negro a elección", "Garantía de 2 años en estructura"],
  },

  comedor: {
    key: "comedor",
    accent: "#7F8A55",
    accentSoft: "#E9EDDB",
    eyebrow: "Comedor · Hecho para reunir",
    pitch: "La mesa donde pasan las cosas importantes: cumpleaños, domingos largos y sobremesas.",
    idealFor: ["Almuerzos de domingo en familia", "Quienes reciben invitados", "Comedores de uso diario"],
    specs: [
      { icon: TreeDeciduous, label: "Estructura", value: MADERA },
      { icon: Layers, label: "Tablero", value: "Madera o vidrio según modelo" },
      { icon: UtensilsCrossed, label: "Sillas", value: "Según la versión elegida" },
      { icon: Hammer, label: "Fabricación", value: "A pedido, en Lima" },
    ],
    acabadoLabel: "Acabado de madera",
    acabados: [
      { name: "Nogal", hex: "#6B4C38" },
      { name: "Roble claro", hex: "#C7A57A" },
      { name: "Wengué", hex: "#3B2B1F" },
      { name: "Blanco nórdico", hex: "#EDE9E1" },
    ],
    module: "seating",
    bundleTitle: "Viste tu comedor",
    bundleSub: "Aparadores, lámparas y piezas para completar el espacio",
    faqs: [
      { q: "¿Cuántas personas entran cómodas?", a: "Usa el simulador de arriba. Como regla, cuenta unos 60 cm de ancho de mesa por comensal." },
      { q: "Cuidado y mantenimiento", a: "Limpia con paño suave. Usa individuales o posavasos con bebidas calientes y seca derrames de inmediato." },
      FAQ_ENTREGA, FAQ_DEVOLUCION,
    ],
    features: ["Fabricado artesanalmente en Perú", `Estructura de ${MADERA.toLowerCase()}`, "Acabado protector resistente al uso diario", "Garantía de 2 años en estructura"],
  },

  recamara: {
    key: "recamara",
    accent: "#6F86A3",
    accentSoft: "#E1E8F1",
    eyebrow: "Recámara · Descanso",
    pitch: "El lugar donde empieza y termina tu día merece una pieza que se sienta tuya.",
    idealFor: ["Dormitorios principales", "Quienes buscan cabecera con presencia", "Renovar el cuarto sin mudarse"],
    specs: [
      { icon: TreeDeciduous, label: "Estructura", value: MADERA },
      { icon: Layers, label: "Tapizado / acabado", value: "Según modelo" },
      { icon: BedDouble, label: "Tamaños", value: "Estándar o a medida" },
      { icon: Hammer, label: "Fabricación", value: "A pedido, en Lima" },
    ],
    acabadoLabel: "Acabado",
    acabados: [
      { name: "Gris niebla", hex: "#BFC4CA" },
      { name: "Beige lino", hex: "#DDD2BF" },
      { name: "Azul humo", hex: "#8FA3B8" },
      { name: "Nogal", hex: "#6B4C38" },
    ],
    module: "sleep",
    bundleTitle: "Arma tu dormitorio",
    bundleSub: "Veladores, bancos y detalles que combinan con tu cama",
    faqs: [
      { q: "¿Qué tamaño de cama me conviene?", a: "Usa el visor de arriba: te muestra el espacio libre que necesitas alrededor. Confirmamos medidas y disponibilidad al cotizar." },
      { q: "Cuidado y mantenimiento", a: "Aspira o cepilla suavemente el tapizado y limpia manchas de inmediato. Evita sol directo prolongado." },
      FAQ_ENTREGA, FAQ_DEVOLUCION,
    ],
    features: ["Fabricado artesanalmente en Perú", `Estructura de ${MADERA.toLowerCase()}`, "Tamaños estándar o a medida", "Garantía de 2 años en estructura"],
  },

  separador: {
    key: "separador",
    accent: "#5F8A84",
    accentSoft: "#DCEAE7",
    eyebrow: "Separador de ambiente",
    pitch: "Divide sin cerrar: ordena el espacio, deja pasar la luz y le da carácter a tu casa.",
    idealFor: ["Departamentos y espacios abiertos", "Separar sala y comedor", "Dar privacidad sin construir"],
    specs: [
      { icon: TreeDeciduous, label: "Estructura", value: MADERA },
      { icon: Columns3, label: "Diseño", value: "Listones y vacíos a medida" },
      { icon: Ruler, label: "Medida", value: "A tu espacio" },
      { icon: Hammer, label: "Fabricación", value: "A pedido, en Lima" },
    ],
    acabadoLabel: "Acabado",
    acabados: [
      { name: "Roble natural", hex: "#B58B5D" },
      { name: "Nogal", hex: "#6B4C38" },
      { name: "Negro mate", hex: "#2B2623" },
      { name: "Blanco humo", hex: "#E7E3DC" },
    ],
    module: "custom-space",
    bundleTitle: "Dale vida a cada lado",
    bundleSub: "Piezas que acompañan a tu separador",
    faqs: [
      { q: "¿Se hace a la medida de mi espacio?", a: "Sí. Indica ancho y alto de tu espacio arriba y un asesor te devuelve una cotización con el diseño ajustado." },
      { q: "Cuidado y mantenimiento", a: "Limpia el polvo con paño seco o ligeramente húmedo. Evita químicos abrasivos." },
      FAQ_ENTREGA, FAQ_DEVOLUCION,
    ],
    features: ["Fabricado artesanalmente en Perú", `Estructura de ${MADERA.toLowerCase()}`, "Diseño a medida del espacio", "Garantía de 2 años en estructura"],
  },

  accesorio: {
    key: "accesorio",
    accent: "#B59A5B",
    accentSoft: "#F3EBD6",
    eyebrow: "Accesorio · El toque final",
    pitch: "Los detalles que hacen que un ambiente se sienta terminado.",
    idealFor: ["Completar una sala o dormitorio", "Regalo para estrenar casa", "Renovar sin cambiar todo"],
    specs: [
      { icon: TreeDeciduous, label: "Material", value: "Madera y acabados seleccionados" },
      { icon: Sparkles, label: "Detalle", value: "Hecho a mano" },
      { icon: Sofa, label: "Combina con", value: "Nuestras salas y recámaras" },
      { icon: Hammer, label: "Fabricación", value: "A pedido, en Lima" },
    ],
    acabadoLabel: "Acabado",
    acabados: [
      { name: "Natural", hex: "#C9A97A" },
      { name: "Nogal", hex: "#6B4C38" },
      { name: "Blanco humo", hex: "#E7E3DC" },
      { name: "Negro mate", hex: "#2B2623" },
    ],
    module: "none",
    bundleTitle: "Combínalo con",
    bundleSub: "Piezas que se llevan bien con esta",
    faqs: [
      { q: "Cuidado y mantenimiento", a: "Limpia con paño suave. Evita sol directo prolongado y químicos agresivos." },
      FAQ_ENTREGA, FAQ_DEVOLUCION,
    ],
    features: ["Fabricado artesanalmente en Perú", "Acabado resistente al uso diario", "Garantía de 2 años en estructura"],
  },

  generico: {
    key: "generico",
    accent: "#9A8070",
    accentSoft: "#F1E9E2",
    eyebrow: "Hecho a mano en Lima",
    pitch: "Muebles fabricados a pedido, con materiales seleccionados y garantía real.",
    idealFor: ["Quienes buscan piezas únicas", "Espacios que piden medidas propias"],
    specs: [
      { icon: TreeDeciduous, label: "Estructura", value: MADERA },
      { icon: Hammer, label: "Fabricación", value: "A pedido, en Lima" },
      { icon: Ruler, label: "Medida", value: "Consulta por tu espacio" },
      { icon: Sparkles, label: "Garantía", value: "2 años en estructura" },
    ],
    acabadoLabel: "Acabado",
    acabados: [
      { name: "Natural", hex: "#C9A97A" },
      { name: "Nogal", hex: "#6B4C38" },
      { name: "Blanco humo", hex: "#E7E3DC" },
    ],
    module: "none",
    bundleTitle: "Completa el ambiente",
    bundleSub: "Piezas que combinan con tu elección",
    faqs: [FAQ_ENTREGA, FAQ_DEVOLUCION],
    features: ["Fabricado artesanalmente en Perú", "Garantía de 2 años en estructura"],
  },
};

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Elige el perfil según categoría y, cuando hace falta, el nombre del producto. */
export function resolveProfile(p: {
  nombre: string; categoria: string | null; subcategoria?: string | null;
}): ProductProfile {
  const nombre = norm(p.nombre);
  const cat = norm(p.categoria);

  // El nombre manda cuando es inequívoco (ej. "Estante para televisor" vive en "separadores")
  if (/\b(televisor|tv|rack|entretenimiento)\b/.test(nombre)) return PROFILES.tv;

  if (cat === "muebles") return PROFILES.sala;
  if (cat === "comedores") return PROFILES.comedor;
  if (cat === "recamaras") return PROFILES.recamara;
  if (cat === "separadores") return PROFILES.separador;
  if (cat === "accesorios") return PROFILES.accesorio;
  return PROFILES.generico;
}
