// src/lib/portadaFotos.ts
// Fotos propias de la portada v3: todo archivo de imagen de src/assets/portada/ (ver LEEME.txt allí), agrupado por
// el prefijo del nombre (01-locura-1.jpg, 02-salas.jpg, 03-a-medida.jpg, 04-pruebalo.jpg, taller.jpg).
// Sin fotos propias la portada usa las fotos reales de las piezas del catálogo.
const modulos = import.meta.glob("/src/assets/portada/*.{jpg,jpeg,png,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const ordenadas = Object.entries(modulos)
  .map(([ruta, src]) => ({ nombre: ruta.split("/").pop() ?? ruta, src }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));

/** Fotos cuyo nombre empieza con el prefijo (p. ej. «01-locura»), en orden de nombre. */
export function fotosPortada(prefijo: string): string[] {
  return ordenadas.filter((f) => f.nombre.toLowerCase().startsWith(prefijo)).map((f) => f.src);
}
