// src/components/LeadFormDialog.tsx
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createLead } from "@/lib/leads.functions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Contexto opcional: si viene desde una ficha de producto */
  productoId?: string;
  productoNombre?: string;
  title?: string;
  description?: string;
}

export function LeadFormDialog({
  open, onOpenChange, productoId, productoNombre,
  title = "Solicitar cotización personalizada",
  description = "Déjanos tus datos y un asesor te contactará a la brevedad.",
}: LeadFormDialogProps) {
  const [form, setForm] = useState({ nombre: "", telefono: "", email: "", mensaje: "" });
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      createLead({
        nombre: form.nombre,
        telefono: form.telefono || null,
        email: form.email || null,
        mensaje: form.mensaje || null,
        producto_id: productoId ?? null,
        producto_nombre: productoNombre ?? null,
        origen: "web",
      }),
    onSuccess: () => {
      setSent(true);
      toast.success("¡Gracias! Te contactaremos pronto.");
    },
    onError: () => {
      toast.error("No pudimos enviar tu consulta. Intenta de nuevo.");
    },
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleClose = (v: boolean) => {
    if (!v) {
      // reset al cerrar, con un pequeño delay para no "parpadear" el form mientras se anima el cierre
      setTimeout(() => { setSent(false); setForm({ nombre: "", telefono: "", email: "", mensaje: "" }); }, 200);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {sent ? (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <h3 className="font-display text-lg font-semibold">¡Consulta enviada!</h3>
            <p className="text-sm text-muted-foreground">
              Un asesor te contactará muy pronto{form.telefono ? " por WhatsApp o llamada" : ""}.
            </p>
            <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
              Cerrar
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">{title}</DialogTitle>
              <DialogDescription>
                {productoNombre ? `Sobre: ${productoNombre}. ` : ""}
                {description}
              </DialogDescription>
            </DialogHeader>

            <form
              className="space-y-3 mt-1"
              onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
            >
              <div>
                <Label htmlFor="lead-nombre">Nombre completo</Label>
                <Input id="lead-nombre" required value={form.nombre} onChange={set("nombre")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="lead-telefono">WhatsApp / teléfono</Label>
                  <Input id="lead-telefono" value={form.telefono} onChange={set("telefono")} placeholder="9XXXXXXXX" />
                </div>
                <div>
                  <Label htmlFor="lead-email">Correo (opcional)</Label>
                  <Input id="lead-email" type="email" value={form.email} onChange={set("email")} />
                </div>
              </div>
              <div>
                <Label htmlFor="lead-mensaje">Cuéntanos qué necesitas</Label>
                <Textarea
                  id="lead-mensaje"
                  rows={3}
                  value={form.mensaje}
                  onChange={set("mensaje")}
                  placeholder="Color, medidas, fecha de entrega deseada…"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[var(--color-walnut)] hover:bg-[var(--color-walnut-mid)] text-white"
                disabled={mutation.isPending || !form.nombre}
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Enviar consulta
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}