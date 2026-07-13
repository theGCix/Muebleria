// src/lib/categories.ts
// Fuente única de verdad para la taxonomía del catálogo público.
// Si agregas/quitas una categoría o subcategoría, este es el único
// archivo que necesitas tocar: Categories.tsx, la página /categoria/$slug
// y el formulario admin de productos leen de aquí.

import { Sofa, UtensilsCrossed, BedDouble, Columns3, type LucideIcon } from "lucide-react";

export interface Subcategoria {
  slug: string;
  label: string;
}

export interface FiltroExtra {
  /** columna de la tabla products que representa este filtro */
  key: "material_base";
  label: string;
  opciones: Subcategoria[];
}

export interface CategoriaConfig {
  /** valor guardado en products.categoria */
  slug: string;
  nombre: string;
  /** frase corta usada en tarjetas/menús */
  descripcion: string;
  /** texto más largo para el encabezado de la página de categoría */
  heroDescripcion: string;
  icon: LucideIcon;
  subcategorias: Subcategoria[];
  filtroExtra?: FiltroExtra;
}

export const CATEGORIAS: CategoriaConfig[] = [
  {
    slug: "muebles",
    nombre: "Muebles",
    descripcion: "Sofás, mesas de centro y piezas para cada tipo de espacio.",
    heroDescripcion:
      "Piezas versátiles pensadas para la sala de tu casa, tu departamento o esos ambientes compactos que necesitan muebles a su medida.",
    icon: Sofa,
    subcategorias: [
      { slug: "sala", label: "Sala" },
      { slug: "departamento", label: "Departamento" },
      { slug: "mini-departamento", label: "Mini departamento" },
    ],
  },
  {
    slug: "comedores",
    nombre: "Comedores",
    descripcion: "Juegos de comedor para reunir a la familia alrededor de cada plato.",
    heroDescripcion:
      "Comedores completos en distintos tamaños, con base de madera o vidrio según el estilo que busques.",
    icon: UtensilsCrossed,
    subcategorias: [
      { slug: "4-sillas", label: "4 sillas" },
      { slug: "6-sillas", label: "6 sillas" },
      { slug: "8-sillas", label: "8 sillas" },
    ],
    filtroExtra: {
      key: "material_base",
      label: "Tipo de base",
      opciones: [
        { slug: "madera", label: "Madera" },
        { slug: "vidrio", label: "Vidrio" },
      ],
    },
  },
  {
    slug: "recamaras",
    nombre: "Recámaras",
    descripcion: "Camas, cabeceras y cómodas para un descanso reparador.",
    heroDescripcion: "Camas, cabeceras y cómodas para un descanso reparador.",
    icon: BedDouble,
    subcategorias: [],
  },
  {
    slug: "separadores",
    nombre: "Separadores de ambiente",
    descripcion: "Divisiones y biombos que ordenan y visten cada espacio.",
    heroDescripcion: "Divisiones y biombos que ordenan y visten cada espacio.",
    icon: Columns3,
    subcategorias: [],
  },
];

export function getCategoria(slug: string | undefined): CategoriaConfig | undefined {
  return CATEGORIAS.find((c) => c.slug === slug);
}

export function getSubcategoria(cat: CategoriaConfig | undefined, slug: string | undefined) {
  if (!cat || !slug) return undefined;
  return cat.subcategorias.find((s) => s.slug === slug);
}