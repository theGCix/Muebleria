// src/lib/portadaBanners.ts
// Fotos del banner de la portada: todo archivo de imagen que esté en src/assets/portada/ (ver LEEME.txt allí).
// Sin ninguna foto la lista queda vacía y el banner usa el carrusel de piezas del catálogo. Se ordenan por nombre.
const modulos = import.meta.glob("/src/assets/portada/*.{jpg,jpeg,png,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export interface BannerFoto {
  src: string;
}

export const BANNERS_PORTADA: BannerFoto[] = Object.entries(modulos)
  .sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }))
  .map(([, src]) => ({ src }));
