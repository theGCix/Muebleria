// src/routes/perfil/direcciones.tsx
// G&M Mueblería — Mis direcciones de entrega
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAddresses, saveAddress, deleteAddress, setDefaultAddress, type Address,
} from "@/lib/perfil.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, MapPin, Star, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/perfil/direcciones")({
  head: () => ({ meta: [{ title: "Mis direcciones — G&M Mueblería" }] }),
  component: DireccionesPage,
});

const EMPTY_ADDRESS = {
  id: "", etiqueta: "Casa", direccion: "", distrito: "", ciudad: "Lima", referencia: "",
};

function DireccionesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_ADDRESS);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["mis-direcciones", user?.id],
    queryFn:  () => fetchAddresses(user!.id),
    enabled:  !!user,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["mis-direcciones", user?.id] });

  const saveMutation = useMutation({
    mutationFn: () => saveAddress({
      ...(form.id ? { id: form.id } : {}),
      user_id: user!.id,
      etiqueta: form.etiqueta,
      direccion: form.direccion,
      distrito: form.distrito || null,
      ciudad: form.ciudad,
      referencia: form.referencia || null,
    }),
    onSuccess: () => {
      toast.success(form.id ? "Dirección actualizada" : "Dirección guardada");
      setDialogOpen(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo guardar la dirección"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAddress(id),
    onSuccess: () => { toast.success("Dirección eliminada"); setDeleteId(null); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "No se pudo eliminar la dirección"),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: string) => setDefaultAddress(user!.id, id),
    onSuccess: () => { toast.success("Dirección predeterminada actualizada"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "No se pudo actualizar"),
  });

  const openNew = () => { setForm(EMPTY_ADDRESS); setDialogOpen(true); };
  const openEdit = (a: Address) => {
    setForm({
      id: a.id,
      etiqueta: a.etiqueta,
      direccion: a.direccion,
      distrito: a.distrito ?? "",
      ciudad: a.ciudad,
      referencia: a.referencia ?? "",
    });
    setDialogOpen(true);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-1 gap-3">
        <h2 className="font-display text-xl font-semibold">Mis direcciones</h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" /> Agregar
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Guarda tus direcciones frecuentes para agilizar el checkout.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground bg-muted/20 rounded-xl">
          <MapPin className="h-10 w-10" />
          <p className="text-sm">Aún no tienes direcciones guardadas</p>
          <Button size="sm" variant="outline" onClick={openNew}>Agregar mi primera dirección</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{a.etiqueta}</span>
                  {a.predeterminada && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Star className="h-3 w-3 fill-current" /> Predeterminada
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-sm">{a.direccion}</p>
              <p className="text-xs text-muted-foreground">
                {[a.distrito, a.ciudad].filter(Boolean).join(", ")}
              </p>
              {a.referencia && <p className="text-xs text-muted-foreground mt-1">Ref: {a.referencia}</p>}
              {!a.predeterminada && (
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 h-auto mt-2 text-xs"
                  onClick={() => defaultMutation.mutate(a.id)}
                  disabled={defaultMutation.isPending}
                >
                  Usar como predeterminada
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar dirección" : "Nueva dirección"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="etiqueta">Etiqueta</Label>
              <Input
                id="etiqueta" required value={form.etiqueta}
                onChange={(e) => setForm((f) => ({ ...f, etiqueta: e.target.value }))}
                placeholder="Casa, Oficina, etc."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion" required value={form.direccion}
                onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                placeholder="Av. Siempre Viva 123"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="distrito">Distrito</Label>
                <Input
                  id="distrito" value={form.distrito}
                  onChange={(e) => setForm((f) => ({ ...f, distrito: e.target.value }))}
                  placeholder="San Isidro"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input
                  id="ciudad" required value={form.ciudad}
                  onChange={(e) => setForm((f) => ({ ...f, ciudad: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="referencia">Referencia (opcional)</Label>
              <Textarea
                id="referencia" rows={2} value={form.referencia}
                onChange={(e) => setForm((f) => ({ ...f, referencia: e.target.value }))}
                placeholder="Frente al parque, puerta azul..."
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación de borrado */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta dirección?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}