// src/components/taller/MapaTaller.tsx
// Mapa de la tienda cargado SOLO al pulsar «Ver mapa»: al abrir /nosotros no se descarga nada de Google.
// Usa el modo de incrustación sin API key. Si un bloqueador impide que cargue, «Cómo llegar» sigue funcionando.
import { useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

export function enlaceComoLlegar(direccion: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

export function MapaTaller({ direccion }: { direccion: string }) {
  const [verMapa, setVerMapa] = useState(false);
  const consulta = encodeURIComponent(direccion);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      {verMapa ? (
        <iframe
          title={`Mapa: ${direccion}`}
          src={`https://www.google.com/maps?q=${consulta}&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block aspect-[4/3] w-full border-0 md:aspect-[16/10]"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 bg-secondary/40 px-6 text-center md:aspect-[16/10]">
          <MapPin className="h-8 w-8 text-accent-strong" aria-hidden="true" />
          <p className="max-w-xs text-sm text-muted-foreground">
            El mapa se carga al pulsar el botón, para que la página abra más rápido.
          </p>
          <Button type="button" variant="outline" className="h-11 rounded-full px-5" onClick={() => setVerMapa(true)}>
            <MapPin className="mr-2 h-4 w-4" aria-hidden="true" /> Ver mapa
          </Button>
        </div>
      )}
      <div className="border-t border-border/50 p-3 text-center">
        <Button asChild variant="ghost" className="h-11 rounded-full px-5 text-accent-strong">
          <a href={enlaceComoLlegar(direccion)} target="_blank" rel="noopener noreferrer">
            <Navigation className="mr-2 h-4 w-4" aria-hidden="true" /> Cómo llegar
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </a>
        </Button>
      </div>
    </div>
  );
}
