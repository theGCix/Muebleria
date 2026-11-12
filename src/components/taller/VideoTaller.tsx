// src/components/taller/VideoTaller.tsx
// Video del taller con carga bajo demanda: hasta pulsar «Ver video» no se carga ningún reproductor ni script externo.
import { useState } from "react";
import { Play } from "lucide-react";
import { videoFuente, fotoUrl, type VideoTaller as VideoCfg } from "@/lib/taller";

export function VideoTaller({ video }: { video: VideoCfg }) {
  const [play, setPlay] = useState(false);
  const fuente = videoFuente(video.url);
  if (!fuente) return null;
  const titulo = video.titulo?.trim() || "Video del taller de G&M Mueblería";
  const poster = fotoUrl(video.poster, 1200);

  return (
    <div className="aspect-video overflow-hidden rounded-3xl border border-border/60 bg-card">
      {play ? (
        fuente.tipo === "youtube" ? (
          <iframe
            title={titulo}
            src={`https://www.youtube-nocookie.com/embed/${fuente.id}?autoplay=1&rel=0`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="h-full w-full border-0"
          />
        ) : (
          <video src={fuente.src} poster={poster ?? undefined} controls autoPlay playsInline className="h-full w-full object-cover">
            <track kind="captions" />
          </video>
        )
      ) : (
        <button
          type="button"
          onClick={() => setPlay(true)}
          className="group relative flex h-full w-full items-center justify-center bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {poster && <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
          <span className="relative flex items-center gap-3 rounded-full bg-background/95 px-6 py-3.5 text-sm font-medium shadow-lg transition-transform group-hover:scale-105">
            <Play className="h-5 w-5 text-accent-strong" aria-hidden="true" />
            Ver video<span className="sr-only">: {titulo}</span>
          </span>
        </button>
      )}
    </div>
  );
}
