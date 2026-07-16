// src/routes/perfil/datos.tsx
// G&M Mueblería — Mis datos personales
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProfile, saveProfile, type DocTipo } from "@/lib/perfil.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/perfil/datos")({
  head: () => ({ meta: [{ title: "Mis datos — G&M Mueblería" }] }),
  component: DatosPage,
});

const EMPTY_FORM = {
  nombre: "",
  apellido: "",
  doc_tipo: "DNI" as DocTipo,
  doc_numero: "",
  telefono_principal: "",
  telefono_alternativo: "",
};

function DatosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["mi-perfil", user?.id],
    queryFn:  () => fetchProfile(user!.id),
    enabled:  !!user,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        nombre: profile.nombre ?? "",
        apellido: profile.apellido ?? "",
        doc_tipo: (profile.doc_tipo as DocTipo) ?? "DNI",
        doc_numero: profile.doc_numero ?? "",
        telefono_principal: profile.telefono_principal ?? "",
        telefono_alternativo: profile.telefono_alternativo ?? "",
      });
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () => saveProfile({ id: user!.id, ...form }),
    onSuccess: () => {
      toast.success("Tus datos se actualizaron correctamente");
      qc.invalidateQueries({ queryKey: ["mi-perfil", user?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo guardar tus datos"),
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const docMaxLength = form.doc_tipo === "RUC" ? 11 : form.doc_tipo === "DNI" ? 8 : 20;
  const docPattern = form.doc_tipo === "DNI" ? "^\\d{8}$" : form.doc_tipo === "RUC" ? "^\\d{11}$" : undefined;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section>
      <h2 className="font-display text-xl font-semibold mb-1">Mis datos</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Esta información se usará para prellenar tus próximas compras.
      </p>

      <Card className="p-6">
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" required value={form.nombre} onChange={set("nombre")} placeholder="Juan" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apellido">Apellido</Label>
            <Input id="apellido" required value={form.apellido} onChange={set("apellido")} placeholder="Pérez" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doc_tipo">Tipo de documento</Label>
            <Select
              value={form.doc_tipo}
              onValueChange={(v) => setForm((f) => ({ ...f, doc_tipo: v as DocTipo }))}
            >
              <SelectTrigger id="doc_tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DNI">DNI</SelectItem>
                <SelectItem value="RUC">RUC</SelectItem>
                <SelectItem value="CE">Carné de extranjería</SelectItem>
                <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc_numero">Número de documento</Label>
            <Input
              id="doc_numero"
              required
              maxLength={docMaxLength}
              pattern={docPattern}
              title={form.doc_tipo === "DNI" ? "DNI: 8 dígitos" : form.doc_tipo === "RUC" ? "RUC: 11 dígitos" : undefined}
              value={form.doc_numero}
              onChange={set("doc_numero")}
              placeholder="12345678"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="telefono_principal">Teléfono principal</Label>
            <Input
              id="telefono_principal"
              required
              type="tel"
              value={form.telefono_principal}
              onChange={set("telefono_principal")}
              placeholder="987654321"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefono_alternativo">Teléfono alternativo (opcional)</Label>
            <Input
              id="telefono_alternativo"
              type="tel"
              value={form.telefono_alternativo}
              onChange={set("telefono_alternativo")}
              placeholder="987654321"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end pt-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Save className="h-4 w-4 mr-2" />}
              Guardar cambios
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}