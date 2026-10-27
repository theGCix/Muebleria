// src/components/LegalPage.tsx
// Plantilla común de las páginas informativas: Envíos, Términos y Privacidad.
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { EMPRESA } from "@/config";
import { trackEvent } from "@/hooks/useEventTracking";

export interface SeccionLegal {
  titulo: string;
  contenido: ReactNode;
}

interface Props {
  path: string;
  eyebrow: string;
  titulo: string;
  intro: string;
  /** Texto de la última actualización, p. ej. "Octubre de 2026". */
  actualizado: string;
  secciones: SeccionLegal[];
}

export function LegalPage({ path, eyebrow, titulo, intro, actualizado, secciones }: Props) {
  useEffect(() => {
    trackEvent({ tipo: "pagina_vista", path });
  }, [path]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <section className="px-4 pb-6 pt-14 md:pt-20">
          <div className="container mx-auto max-w-3xl">
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-muted-foreground">{eyebrow}</p>
            <h1 className="font-display text-4xl font-semibold leading-tight md:text-5xl">{titulo}</h1>
            <p className="mt-5 text-muted-foreground">{intro}</p>
            <p className="mt-3 text-xs text-muted-foreground">Última actualización: {actualizado}</p>
          </div>
        </section>

        <section className="px-4 pb-20">
          <div className="container mx-auto max-w-3xl space-y-10">
            {secciones.map((s, i) => (
              <article key={s.titulo} className="border-t border-border/60 pt-8">
                <h2 className="font-display text-2xl font-semibold">
                  <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                  {s.titulo}
                </h2>
                <div className="mt-4 space-y-3 leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
                  {s.contenido}
                </div>
              </article>
            ))}

            <nav aria-label="Otras páginas informativas" className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-8 text-sm">
              {path !== "/envios" && <Link to="/envios" className="underline hover:text-foreground">Envíos</Link>}
              {path !== "/terminos" && <Link to="/terminos" className="underline hover:text-foreground">Términos y condiciones</Link>}
              {path !== "/privacidad" && <Link to="/privacidad" className="underline hover:text-foreground">Política de privacidad</Link>}
            </nav>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

/** Datos de la empresa; solo muestra los que están llenos en config.ts. */
export function DatosEmpresa() {
  const filas: [string, string][] = [
    ["Nombre comercial", EMPRESA.nombre],
    ["Razón social", EMPRESA.razonSocial],
    ["RUC", EMPRESA.ruc],
    ["Dirección", EMPRESA.direccion],
    ["Correo de contacto", EMPRESA.email],
  ];
  return (
    <ul>
      {filas
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <li key={k}>
            <strong>{k}:</strong> {v}
          </li>
        ))}
    </ul>
  );
}