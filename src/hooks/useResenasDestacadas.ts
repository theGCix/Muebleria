// src/hooks/useResenasDestacadas.ts
// Reseñas reales y aprobadas para el home. Se comparte con Header y Footer para
// que el enlace "Testimonios" solo exista cuando la sección realmente se muestra.
import { useQuery } from "@tanstack/react-query";
import { fetchCalificacionGlobal, fetchResenasDestacadas } from "@/lib/resenas.functions";

/** Con menos reseñas que esto la sección no se muestra (evita una prueba social escasa). */
export const MIN_RESENAS_HOME = 3;

export function useResenasDestacadas() {
  return useQuery({
    queryKey: ["resenas-destacadas-home"],
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const [resenas, global] = await Promise.all([
        fetchResenasDestacadas(6),
        fetchCalificacionGlobal(),
      ]);
      return { resenas, ...global };
    },
  });
}

/** true cuando hay suficientes reseñas para mostrar la sección de testimonios. */
export function useHayTestimonios() {
  const { data } = useResenasDestacadas();
  return (data?.resenas.length ?? 0) >= MIN_RESENAS_HOME;
}