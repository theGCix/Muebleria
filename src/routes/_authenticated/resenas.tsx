// src/routes/_authenticated/resenas.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listResenasAdmin, moderarResena, responderResena,
  resenaEstado, type ResenaAdmin, type ResenaEstado,
} from "@/lib/resenas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Star, Loader2, Search, RefreshCw, Check, X, MessageSquare, ImageIcon,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/resenas")({
  head: () => ({ meta: [{ title: "Reseñas — G&M" }] }),
  component: ResenasPage,
});

const fmtDate = (d: string) => format(new Date(d), "dd MMM, HH:mm", { locale: es });

const TABS: { key: ResenaEstado | "todas"; label: string }[] = [
  { key: "pendiente", label: "Pendientes" },
  { key: "aprobada", label: "Aprobadas" },
  { key: "rechazada", label: "Rechazadas" },
  { key: "todas", label: "Todas" },
];

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

const ESTADO_BADGE: Record<ResenaEstado, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Pendiente", color: "#78350f", bg: "#fef3c7" },
  aprobada: { label: "Aprobada", color: "#065f46", bg: "#d1fae5" },
  rechazada: { label: "Rechazada", color: "#6b7280", bg: "#f3f4f6" },
};

function RejectInline({ onConfirm, onCancel, pending }: {
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [motivo, setMotivo] = useState("");
  return (
    <div className="mt-2 flex items-center gap-2">
      <Input
        autoFocus
        placeholder="Motivo del rechazo (opcional)"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="h-8 text-xs"
      />
      <Button size="sm" variant="destructive" disabled={pending} onClick={() => onConfirm(motivo)}>
        Confirmar
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
    </div>
  );
}

function ResponderInline({ resena, onDone }: { resena: ResenaAdmin; onDone: () => void }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState(resena.respuesta_tienda ?? "");
  const mut = useMutation({
    mutationFn: () => responderResena({ id: resena.id, respuesta_tienda: texto }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resenas-admin"] });
      toast.success("Respuesta publicada");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="mt-2 space-y-2 bg-muted/30 rounded-lg p-3">
      <Label className="text-xs">Respuesta pública de la tienda</Label>
      <Textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Gracias por tu comentario…" />
      <div className="flex gap-2">
        <Button size="sm" disabled={mut.isPending || !texto.trim()} onClick={() => mut.mutate()}>
          {mut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Publicar respuesta
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </div>
  );
}

function ResenaCard({ r }: { r: ResenaAdmin }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [responding, setResponding] = useState(false);
  const estado = resenaEstado(r);
  const badge = ESTADO_BADGE[estado];

  const mut = useMutation({
    mutationFn: (patch: { aprobada: boolean; motivo_rechazo?: string | null }) =>
      moderarResena({ id: r.id, ...patch }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["resenas-admin"] });
      toast.success(vars.aprobada ? "Reseña aprobada" : "Reseña rechazada");
      setRejecting(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="bg-card border border-border/50 rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Stars n={r.calificacion} />
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{ color: badge.color, background: badge.bg }}
            >
              {badge.label}
            </span>
            {r.fotos?.length > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <ImageIcon className="h-3 w-3" /> {r.fotos.length}
              </span>
            )}
          </div>
          <p className="text-sm font-medium mt-1 truncate">{r.products?.nombre ?? "Producto eliminado"}</p>
          <p className="text-xs text-muted-foreground">
            {r.customers?.nombre ?? "Cliente"} · {fmtDate(r.created_at)}
          </p>
        </div>
      </div>

      {r.titulo && <p className="text-sm font-medium">{r.titulo}</p>}
      {r.comentario && <p className="text-sm text-muted-foreground">{r.comentario}</p>}

      {r.fotos?.length > 0 && (
        <div className="flex gap-2 pt-1">
          {r.fotos.slice(0, 4).map((url, i) => (
            <img key={i} src={url} alt="" className="w-14 h-14 rounded-md object-cover border border-border/50" />
          ))}
        </div>
      )}

      {estado === "rechazada" && r.motivo_rechazo && (
        <p className="text-xs text-muted-foreground italic">Motivo: {r.motivo_rechazo}</p>
      )}

      {r.respuesta_tienda && !responding && (
        <div className="bg-muted/30 rounded-lg p-2.5 text-xs">
          <span className="font-medium">Respuesta de la tienda: </span>
          {r.respuesta_tienda}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {estado !== "aprobada" && (
          <Button size="sm" disabled={mut.isPending} onClick={() => mut.mutate({ aprobada: true })}>
            <Check className="h-3.5 w-3.5 mr-1" /> Aprobar
          </Button>
        )}
        {estado !== "rechazada" && !rejecting && (
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>
            <X className="h-3.5 w-3.5 mr-1" /> Rechazar
          </Button>
        )}
        {estado === "aprobada" && !responding && (
          <Button size="sm" variant="outline" onClick={() => setResponding(true)}>
            <MessageSquare className="h-3.5 w-3.5 mr-1" /> {r.respuesta_tienda ? "Editar respuesta" : "Responder"}
          </Button>
        )}
      </div>

      {rejecting && (
        <RejectInline
          pending={mut.isPending}
          onConfirm={(motivo) => mut.mutate({ aprobada: false, motivo_rechazo: motivo })}
          onCancel={() => setRejecting(false)}
        />
      )}
      {responding && <ResponderInline resena={r} onDone={() => setResponding(false)} />}
    </div>
  );
}

function ResenasPage() {
  const [tab, setTab] = useState<ResenaEstado | "todas">("pendiente");
  const [q, setQ] = useState("");
  const qc = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["resenas-admin", tab, q],
    queryFn: () => listResenasAdmin({ estado: tab, q }),
  });

  const resenas = data?.resenas ?? [];

  const counts = useMemo(() => {
    const all = resenas;
    return { total: all.length };
  }, [resenas]);

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Reseñas</h1>
          <p className="text-muted-foreground mt-0.5">Modera lo que se muestra en la tienda</p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["resenas-admin"] })}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-muted/40 rounded-full p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                tab === t.key ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por producto, cliente, texto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-14">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : resenas.length === 0 ? (
        <div className="text-center py-14 text-sm text-muted-foreground">
          No hay reseñas en esta bandeja.
        </div>
      ) : (
        <div className="space-y-3">
          {resenas.map((r) => <ResenaCard key={r.id} r={r} />)}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">{counts.total} reseña(s)</p>
    </div>
  );
}