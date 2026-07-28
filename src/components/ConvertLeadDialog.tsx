// src/components/ConvertLeadDialog.tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertCustomer, searchCustomers } from "@/lib/pos.functions";
import { convertLeadToCustomer, type Lead } from "@/lib/leads.functions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";

interface ConvertLeadDialogProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted: (customerId: string) => void;
}

// Separa "Nombre Apellido" en un intento razonable, si más adelante se
// necesitara — por ahora `customers.nombre` es un solo campo, así que
// usamos el nombre completo del lead tal cual.

export function ConvertLeadDialog({ lead, open, onOpenChange, onConverted }: ConvertLeadDialogProps) {
  const qc = useQueryClient();

  // ── Modo "crear nuevo cliente" ──────────────────────────────
  const [form, setForm] = useState({
    doc_tipo: "DNI" as "DNI" | "RUC" | "CE" | "PASAPORTE",
    doc_numero: "",
    nombre: lead.nombre,
    email: lead.email ?? "",
    telefono: lead.telefono ?? "",
    direccion: "",
    distrito: "",
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { customer } = await upsertCustomer({ data: form });
      await convertLeadToCustomer({ lead_id: lead.id, customer_id: customer.id });
      return customer;
    },
    onSuccess: (customer) => {
      toast.success("Cliente creado y lead marcado como ganado");
      qc.invalidateQueries({ queryKey: ["leads"] });
      onConverted(customer.id);
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo crear el cliente"),
  });

  // ── Modo "vincular cliente existente" ───────────────────────
  const [q, setQ] = useState(lead.telefono ?? lead.nombre);
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchCustomers>>["customers"]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = async () => {
    setSearching(true);
    try {
      const { customers } = await searchCustomers({ data: { q } });
      setResults(customers);
    } catch (e: any) {
      toast.error(e.message ?? "Error al buscar");
    } finally {
      setSearching(false);
    }
  };

  const linkMut = useMutation({
    mutationFn: (customerId: string) =>
      convertLeadToCustomer({ lead_id: lead.id, customer_id: customerId }),
    onSuccess: (_data, customerId) => {
      toast.success("Lead vinculado al cliente");
      qc.invalidateQueries({ queryKey: ["leads"] });
      onConverted(customerId);
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo vincular"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Convertir en cliente</DialogTitle>
          <DialogDescription>
            Vincula este lead a un cliente existente, o crea uno nuevo con sus datos.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="nuevo">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="nuevo">Cliente nuevo</TabsTrigger>
            <TabsTrigger value="existente">Buscar existente</TabsTrigger>
          </TabsList>

          {/* ── Crear nuevo ── */}
          <TabsContent value="nuevo" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo doc.</Label>
                <Select
                  value={form.doc_tipo}
                  onValueChange={(v) => setForm((f) => ({ ...f, doc_tipo: v as typeof f.doc_tipo }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DNI">DNI</SelectItem>
                    <SelectItem value="RUC">RUC</SelectItem>
                    <SelectItem value="CE">CE</SelectItem>
                    <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Número</Label>
                <Input
                  value={form.doc_numero}
                  onChange={(e) => setForm((f) => ({ ...f, doc_numero: e.target.value }))}
                  placeholder="12345678"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Nombre completo</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Teléfono</Label>
                <Input
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Correo</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Dirección</Label>
                <Input
                  value={form.direccion}
                  onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Distrito</Label>
                <Input
                  value={form.distrito}
                  onChange={(e) => setForm((f) => ({ ...f, distrito: e.target.value }))}
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={createMut.isPending || !form.doc_numero || !form.nombre}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Crear cliente y marcar como ganado
            </Button>
          </TabsContent>

          {/* ── Buscar existente ── */}
          <TabsContent value="existente" className="space-y-3 mt-3">
            <div className="flex gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre, DNI/RUC, teléfono o correo"
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
              />
              <Button variant="outline" size="icon" onClick={doSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {results.map((c) => (
                <button
                  key={c.id}
                  className="w-full text-left p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 flex items-center justify-between disabled:opacity-50"
                  disabled={linkMut.isPending}
                  onClick={() => linkMut.mutate(c.id)}
                >
                  <div>
                    <p className="text-sm font-medium">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.doc_tipo} {c.doc_numero} · {c.telefono ?? c.email ?? "—"}
                    </p>
                  </div>
                  <UserCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
              {results.length === 0 && !searching && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Busca por nombre, documento, teléfono o correo
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}