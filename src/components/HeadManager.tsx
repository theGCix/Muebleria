// src/components/HeadManager.tsx
// Pasa el `head()` de las rutas activas al <head> real (ver src/lib/head.ts).
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { setRouteHead, type Meta } from "@/lib/head";

export function HeadManager() {
  // Se serializa para que el efecto solo corra cuando el contenido realmente cambia
  const firma = useRouterState({
    select: (s) =>
      JSON.stringify({
        m: s.matches.flatMap((m) => ((m as { meta?: Meta[] }).meta ?? []).filter(Boolean)),
        l: s.matches.flatMap((m) => ((m as { links?: Meta[] }).links ?? []).filter(Boolean)),
        p: s.location.pathname,
      }),
  });

  useEffect(() => {
    const { m, l, p } = JSON.parse(firma) as { m: Meta[]; l: Meta[]; p: string };
    setRouteHead(m, l, p);
  }, [firma]);

  return null;
}
