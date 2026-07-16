// src/routes/perfil/facturacion.tsx
// G&M Mueblería — Datos de facturación (Boleta / Factura Electrónica)
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBillingInfo, saveBillingInfo } from "@/lib/perfil.functions";
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

export const Route = createFileRoute("/perfil/facturacion")({
  head: () => ({ meta: [{ title: "Datos de facturación — G&M Mueblería" }] }),
  component: FacturacionPage,
});

const EMPTY_FORM = {
  tipo_comprobante: "boleta" as "boleta" | "factura",
  ruc: "",
  razon_social: "",
  direccion_fiscal: "",
};

function FacturacionPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: billing, isLoading } = useQuery({
    queryKey: ["mi-facturacion", user?.id],
    queryFn:  () => fetchBillingInfo(user!.id),
    enabled:  !!user,
  });

  useEffect(() => {
    if (billing) {
      setForm({
        tipo_comprobante: billing.tipo_comprobante ?? "boleta",
        ruc: billing.ruc ?? "",
        razon_social: billing.razon_social ?? "",
        direccion_fiscal: billing.direccion_fiscal ?? "",
      });
    }
  }, [billing]);

  const isFactura = form.tipo_comprobante === "factura";

  const mutation = useMutation({
    mutationFn: () => saveBillingInfo({
      id: user!.id,
      tipo_comprobante: form.tipo_comprobante,
      ruc: isFactura ? form.ruc : null,
      razon_social: isFactura ? form.razon_social : null,
      direccion_fiscal: isFactura ? form.direccion_fiscal : null,
    }),
    onSuccess: () => {
      toast.success("Datos de facturación actualizados");
      qc.invalidateQueries({ queryKey: ["mi-facturacion", user?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "No se pudo guardar"),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section>
      <h2 className="font-display text-xl font-semibold mb-1">Datos de facturación</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Elige qué comprobante prefieres recibir en tus compras. Si necesitas factura, completa los datos de tu RUC.
      </p>

      <Card className="p-6">
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="space-y-5 max-w-lg"
        >
          <div className="space-y-1.5">
            <Label htmlFor="tipo_comprobante">Comprobante preferido</Label>
            <Select
              value={form.tipo_comprobante}
              onValueChange={(v) => setForm((f) => ({ ...f, tipo_comprobante: v as "boleta" | "factura" }))}
            >
              <SelectTrigger id="tipo_comprobante"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="boleta">Boleta de venta</SelectItem>
                <SelectItem value="factura">Factura electrónica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isFactura && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ruc">RUC</Label>
                <Input
                  id="ruc" required maxLength={11} pattern="^\d{11}$" title="RUC: 11 dígitos"
                  value={form.ruc}
                  onChange={(e) => setForm((f) => ({ ...f, ruc: e.target.value }))}
                  placeholder="20123456789"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="razon_social">Razón social</Label>
                <Input
                  id="razon_social" required
                  value={form.razon_social}
                  onChange={(e) => setForm((f) => ({ ...f, razon_social: e.target.value }))}
                  placeholder="Mi Empresa S.A.C."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="direccion_fiscal">Dirección fiscal</Label>
                <Input
                  id="direccion_fiscal" required
                  value={form.direccion_fiscal}
                  onChange={(e) => setForm((f) => ({ ...f, direccion_fiscal: e.target.value }))}
                  placeholder="Av. Comercial 456, San Isidro"
                />
              </div>
            </>
          )}

          <div className="flex justify-end pt-2">
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