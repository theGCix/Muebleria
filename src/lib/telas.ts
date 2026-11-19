// src/lib/telas.ts
// Catálogo de telas para tapizado (36 muestras del catálogo impreso) y tonos para probarlas en las vistas 3D.
// Es la misma información que sembró supabase/migrations/20261120_catalogo_telas.sql: si cambias una, cambia la otra.
// Lógica pura (sin DOM): se prueba con scripts/test-telas.mjs.

export interface CategoriaTela { id: number; nombre: string }
export interface Tela { id: string; numero: number; categoria: number; nombre: string; descripcion: string; imagen: string; hex: string }
export interface Tono { id: string; nombre: string; hex: string | null } // hex null = el color propio de la tela

export const CATEGORIAS_TELA: CategoriaTela[] = [
  { id: 1, nombre: "Aterciopeladas y suaves" },
  { id: 2, nombre: "Tejidas y decorativas" },
  { id: 3, nombre: "Sintéticas y de alto rendimiento" },
  { id: 4, nombre: "Apariencia de cuero" },
  { id: 5, nombre: "Diseños y texturas" },
];

export const TELAS: Tela[] = [
  { id: "velvet-terciopelo", numero: 1, categoria: 1, nombre: "Velvet (Terciopelo)", descripcion: "Elegancia y suavidad", imagen: "/telas/01.webp", hex: "#1c4e9a" },
  { id: "chenille", numero: 2, categoria: 1, nombre: "Chenille", descripcion: "Textura afelpada", imagen: "/telas/02.webp", hex: "#c2a68d" },
  { id: "suede-gamuzado", numero: 3, categoria: 1, nombre: "Suede (Gamuzado)", descripcion: "Apariencia de gamuza", imagen: "/telas/03.webp", hex: "#535056" },
  { id: "microfibra", numero: 4, categoria: 1, nombre: "Microfibra", descripcion: "Fácil mantenimiento", imagen: "/telas/04.webp", hex: "#985651" },
  { id: "teddy", numero: 5, categoria: 1, nombre: "Teddy", descripcion: "Suavidad envolvente", imagen: "/telas/05.webp", hex: "#d9c0a9" },
  { id: "boucle", numero: 6, categoria: 1, nombre: "Bouclé", descripcion: "Textura con bucles", imagen: "/telas/06.webp", hex: "#dbccbf" },
  { id: "jacquard", numero: 7, categoria: 2, nombre: "Jacquard", descripcion: "Diseños únicos", imagen: "/telas/07.webp", hex: "#867e7b" },
  { id: "lino", numero: 8, categoria: 2, nombre: "Lino", descripcion: "Natural y elegante", imagen: "/telas/08.webp", hex: "#b0937a" },
  { id: "algodon", numero: 9, categoria: 2, nombre: "Algodón", descripcion: "Fresco y confortable", imagen: "/telas/09.webp", hex: "#2d4f72" },
  { id: "lona", numero: 10, categoria: 2, nombre: "Lona", descripcion: "Resistente y firme", imagen: "/telas/10.webp", hex: "#b79f8a" },
  { id: "sarga-twill", numero: 11, categoria: 2, nombre: "Sarga (Twill)", descripcion: "Tejido diagonal", imagen: "/telas/11.webp", hex: "#9e8a7f" },
  { id: "corduroy-pana", numero: 12, categoria: 2, nombre: "Corduroy (Pana)", descripcion: "Con canales", imagen: "/telas/12.webp", hex: "#b5601f" },
  { id: "tapiz-gobelino", numero: 13, categoria: 2, nombre: "Tapiz (Gobelino)", descripcion: "Decorativa", imagen: "/telas/13.webp", hex: "#cbb690" },
  { id: "espiga", numero: 14, categoria: 2, nombre: "Espiga", descripcion: "Diseño clásico", imagen: "/telas/14.webp", hex: "#947f71" },
  { id: "poliester-tejido", numero: 15, categoria: 2, nombre: "Poliéster tejido", descripcion: "Versátil", imagen: "/telas/15.webp", hex: "#655f5f" },
  { id: "tejido-de-punto", numero: 16, categoria: 2, nombre: "Tejido de punto", descripcion: "Flexible", imagen: "/telas/16.webp", hex: "#8e7e74" },
  { id: "tela-antimanchas", numero: 17, categoria: 3, nombre: "Tela antimanchas", descripcion: "Fácil limpieza", imagen: "/telas/17.webp", hex: "#c3aa95" },
  { id: "repelente-al-agua", numero: 18, categoria: 3, nombre: "Repelente al agua", descripcion: "Protege de líquidos", imagen: "/telas/18.webp", hex: "#1f5983" },
  { id: "impermeable", numero: 19, categoria: 3, nombre: "Impermeable", descripcion: "Mayor protección", imagen: "/telas/19.webp", hex: "#292e38" },
  { id: "olefina", numero: 20, categoria: 3, nombre: "Olefina", descripcion: "Ideal para exterior", imagen: "/telas/20.webp", hex: "#838f71" },
  { id: "acrilica", numero: 21, categoria: 3, nombre: "Acrílica", descripcion: "Resistente al sol", imagen: "/telas/21.webp", hex: "#d75818" },
  { id: "polipropileno", numero: 22, categoria: 3, nombre: "Polipropileno", descripcion: "Gran durabilidad", imagen: "/telas/22.webp", hex: "#80828e" },
  { id: "cuero-sintetico-pu", numero: 23, categoria: 4, nombre: "Cuero sintético (PU)", descripcion: "Elegancia y estilo", imagen: "/telas/23.webp", hex: "#381f1a" },
  { id: "cuerina-pvc", numero: 24, categoria: 4, nombre: "Cuerina (PVC)", descripcion: "Fácil limpieza", imagen: "/telas/24.webp", hex: "#2b2b2c" },
  { id: "cuero-sintetico-gamuza", numero: 25, categoria: 4, nombre: "Cuero sintético (Gamuza)", descripcion: "Suave y moderno", imagen: "/telas/25.webp", hex: "#885034" },
  { id: "cuero-natural", numero: 26, categoria: 4, nombre: "Cuero natural", descripcion: "Gama alta", imagen: "/telas/26.webp", hex: "#a46c45" },
  { id: "cuero-grabado", numero: 27, categoria: 4, nombre: "Cuero grabado", descripcion: "Diseño exclusivo", imagen: "/telas/27.webp", hex: "#7d584f" },
  { id: "nobuck", numero: 28, categoria: 4, nombre: "Nobuck", descripcion: "Acabado aterciopelado", imagen: "/telas/28.webp", hex: "#834f33" },
  { id: "piel-de-potro", numero: 29, categoria: 5, nombre: "Piel de potro", descripcion: "Estampado natural", imagen: "/telas/29.webp", hex: "#ccc0b8" },
  { id: "jaguar", numero: 30, categoria: 5, nombre: "Jaguar", descripcion: "Estampado animal", imagen: "/telas/30.webp", hex: "#a27b5d" },
  { id: "dino", numero: 31, categoria: 5, nombre: "Dino", descripcion: "Relieve geométrico", imagen: "/telas/31.webp", hex: "#7a7a80" },
  { id: "iker", numero: 32, categoria: 5, nombre: "Iker", descripcion: "Patrón moderno", imagen: "/telas/32.webp", hex: "#928274" },
  { id: "floral", numero: 33, categoria: 5, nombre: "Floral", descripcion: "Estampado floral", imagen: "/telas/33.webp", hex: "#d9c3a0" },
  { id: "geometrica", numero: 34, categoria: 5, nombre: "Geométrica", descripcion: "Patrón geométrico", imagen: "/telas/34.webp", hex: "#807a77" },
  { id: "texturizada", numero: 35, categoria: 5, nombre: "Texturizada", descripcion: "Relieve sutil", imagen: "/telas/35.webp", hex: "#81818e" },
  { id: "estampada", numero: 36, categoria: 5, nombre: "Estampada", descripcion: "Diseño artístico", imagen: "/telas/36.webp", hex: "#97a1a3" },
];

export const TONOS: Tono[] = [
  { id: "original", nombre: "Original", hex: null },
  { id: "crema", nombre: "Crema", hex: "#e6dcc8" },
  { id: "gris", nombre: "Gris", hex: "#8a8d90" },
  { id: "azul-marino", nombre: "Azul marino", hex: "#2f4a6b" },
  { id: "verde", nombre: "Verde", hex: "#4f6b4a" },
  { id: "terracota", nombre: "Terracota", hex: "#a65d44" },
  { id: "vino", nombre: "Vino", hex: "#6e2a3a" },
  { id: "negro", nombre: "Negro", hex: "#232323" },
];

/** Color con el que se pinta el modelo: el del tono elegido o, si es «Original», el de la propia tela. */
export function hexTapizado(tela: Tela | null | undefined, tono: Tono | null | undefined): string | null {
  if (!tela) return tono?.hex ?? null;
  return tono?.hex ?? tela.hex;
}

/** Texto para el cliente: «Velvet (Terciopelo) · Vino». */
export function nombreTapizado(tela: Tela | null | undefined, tono: Tono | null | undefined): string {
  if (!tela) return tono && tono.hex ? tono.nombre : "Original";
  return tono && tono.hex ? `${tela.nombre} · ${tono.nombre}` : tela.nombre;
}

export const telasDeCategoria = (categoria: number) => TELAS.filter((t) => t.categoria === categoria);
export const buscarTela = (id: string | null | undefined) => TELAS.find((t) => t.id === id) ?? null;
export const buscarTono = (id: string | null | undefined) => TONOS.find((t) => t.id === id) ?? null;
