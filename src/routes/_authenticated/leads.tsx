// src/routes/_authenticated/leads.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listLeads, updateLead, listAsesores,
  LEAD_ESTADOS, type Lead, type LeadEstado,
} from "@/lib/leads.functions";
import { ConvertLeadDialog } from "@/components/ConvertLeadDialog";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search, Phone, Mail, Package, RefreshCw, UserCheck } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads — G&M" }] }),
  component: LeadsPage,
});

const ESTADO_CONFIG: Record<LeadEstado, { label: string; color: string; bg: string }> = {
  nuevo:               { label: "Nuevo",              color: "#1e40af", bg: "#dbeafe" },
  contactado:          { label: "Contactado",         color: "#78350f", bg: "#fef3c7" },
  interesado:          { label: "Interesado",         color: "#5b21b6", bg: "#ede9fe" },
  cotizacion_enviada:  { label: "Cotización enviada", color: "#9a3412", bg: "#ffedd5" },
  negociacion:         { label: "Negociación",        color: "#0e7490", bg: "#cffafe" },
  ganado:              { label: "Ganado",             color: "#065f46", bg: "#d1fae5" },
  perdido:             { label: "Perdido",            color: "#6b7280", bg: "#f3f4f6" },
};

const ORIGEN_LABEL: Record<string, string> = {
  web: "🌐 Web", whatsapp: "💬 WhatsApp", facebook: "📘 Facebook",
  instagram: "📸 Instagram", tienda: "🏪 Tienda", referido: "🤝 Referido", otro: "Otro",
};

const fmtDate = (d: string) => format(new Date(d), "dd MMM, HH:mm", { locale: es });

// ── Detalle de un lead ───────────────────────────────────────
function LeadDetail({ lead, asesores, onClose }: {
  lead: Lead;
  asesores: { id: string; full_name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [notas, setNotas] = useState(lead.notas ?? "");
  const [convertOpen, setConvertOpen] = useState(false);

  const mut = useMutation({
    mutationFn: (patch: Parameters<typeof updateLead>[0]) => updateLead(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{lead.nombre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 rounded-xl p-4">
            {lead.telefono && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{lead.telefono}</span>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}
            {lead.producto_nombre && (
              <div className="flex items-center gap-1.5 col-span-2">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{lead.producto_nombre}</span>
              </div>
            )}
            <div className="col-span-2 text-xs text-muted-foreground">
              {ORIGEN_LABEL[lead.origen] ?? lead.origen} · {fmtDate(lead.created_at)}
            </div>
          </div>

          {lead.mensaje && (
            <div>
              <Label className="text-xs text-muted-foreground">Mensaje del cliente</Label>
              <p className="text-sm bg-muted/30 rounded-lg p-3 mt-1">{lead.mensaje}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Etapa</Label>
              <Select
                value={lead.estado}
                onValueChange={(v) => mut.mutate({ id: lead.id, estado: v as LeadEstado })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>{ESTADO_CONFIG[e].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Asesor asignado</Label>
              <Select
                value={lead.asesor_id ?? "sin_asignar"}
                onValueChange={(v) =>
                  mut.mutate({ id: lead.id, asesor_id: v === "sin_asignar" ? null : v })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin_asignar">Sin asignar</SelectItem>
                  {asesores.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name || "Sin nombre"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Notas internas</Label>
            <Textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej. Quiere color gris, necesita entrega en Ate…"
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={mut.isPending}
              onClick={() => mut.mutate({ id: lead.id, notas })}
            >
              Guardar notas
            </Button>
          </div>

          <div className="border-t border-border/50 pt-4">
            {lead.customer_id ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-700 text-sm">
                  <UserCheck className="h-4 w-4" />
                  Vinculado a un cliente
                </div>
                <Link to="/clientes" className="text-xs underline text-green-700">
                  Ver clientes
                </Link>
              </div>
            ) : (
              <Button variant="secondary" className="w-full" onClick={() => setConvertOpen(true)}>
                <UserCheck className="h-4 w-4 mr-2" />
                Convertir en cliente
              </Button>
            )}
          </div>
        </div>

        {convertOpen && (
          <ConvertLeadDialog
            lead={lead}
            open={convertOpen}
            onOpenChange={setConvertOpen}
            onConverted={() => { setConvertOpen(false); onClose(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────
function LeadsPage() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["leads"],
    queryFn: () => listLeads(),
  });

  const { data: asesoresData } = useQuery({
    queryKey: ["asesores"],
    queryFn: () => listAsesores(),
  });

  const quickMoveMut = useMutation({
    mutationFn: (patch: Parameters<typeof updateLead>[0]) => updateLead(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = data?.leads ?? [];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((l) =>
      l.nombre.toLowerCase().includes(needle) ||
      l.telefono?.toLowerCase().includes(needle) ||
      l.email?.toLowerCase().includes(needle) ||
      l.producto_nombre?.toLowerCase().includes(needle)
    );
  }, [data, q]);

  const byEstado = useMemo(() => {
    const map = {} as Record<LeadEstado, Lead[]>;
    for (const e of LEAD_ESTADOS) map[e] = [];
    for (const l of filtered) map[l.estado]?.push(l);
    return map;
  }, [filtered]);

  const stats = useMemo(() => {
    const all = data?.leads ?? [];
    const ganados = all.filter((l) => l.estado === "ganado").length;
    const cerrados = all.filter((l) => l.estado === "ganado" || l.estado === "perdido").length;
    return {
      total: all.length,
      nuevos: all.filter((l) => l.estado === "nuevo").length,
      enProceso: all.filter((l) => !["nuevo", "ganado", "perdido"].includes(l.estado)).length,
      conversion: cerrados > 0 ? Math.round((ganados / cerrados) * 100) : 0,
    };
  }, [data]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Leads</h1>
          <p className="text-muted-foreground mt-0.5">Consultas y seguimiento comercial</p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["leads"] })}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total leads", value: stats.total },
          { label: "Nuevos", value: stats.nuevos },
          { label: "En proceso", value: stats.enProceso },
          { label: "Conversión", value: `${stats.conversion}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="font-display text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nombre, teléfono, producto…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="flex justify-center py-14">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {LEAD_ESTADOS.map((estado) => {
            const cfg = ESTADO_CONFIG[estado];
            const leads = byEstado[estado];
            return (
              <div key={estado} className="w-72 flex-shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ color: cfg.color, background: cfg.bg }}
                  >
                    {cfg.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{leads.length}</span>
                </div>
                <div className="space-y-2 min-h-24">
                  {leads.map((lead) => (
                    <Card
                      key={lead.id}
                      className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelected(lead)}
                    >
                      <p className="font-medium text-sm truncate">{lead.nombre}</p>
                      {lead.producto_nombre && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <Package className="h-3 w-3" /> {lead.producto_nombre}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-muted-foreground">
                          {ORIGEN_LABEL[lead.origen] ?? lead.origen}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{fmtDate(lead.created_at)}</span>
                      </div>
                      {estado !== "ganado" && estado !== "perdido" && (
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={estado}
                            onValueChange={(v) => quickMoveMut.mutate({ id: lead.id, estado: v as LeadEstado })}
                          >
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {LEAD_ESTADOS.map((e) => (
                                <SelectItem key={e} value={e} className="text-xs">
                                  {ESTADO_CONFIG[e].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </Card>
                  ))}
                  {leads.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">Sin leads</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <LeadDetail
          lead={selected}
          asesores={asesoresData?.asesores ?? []}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}