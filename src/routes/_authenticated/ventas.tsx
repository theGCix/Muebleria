import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listSales, getSale } from "@/lib/pos.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Printer } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/ventas")({
  head: () => ({ meta: [{ title: "Ventas y comprobantes — G&M" }] }),
  component: VentasPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

const tipoLabel: Record<string, string> = { boleta: "Boleta", factura: "Factura", nota: "Guía remisión" };

function VentasPage() {
  const { data, isLoading } = useQuery({ queryKey: ["sales"], queryFn: () => listSales() });
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-3xl font-display font-semibold">Ventas</h1>
        <p className="text-muted-foreground">Boletas, facturas y guías de remisión</p>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">Comprobante</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(data?.sales ?? []).map((s: any) => (
                  <tr key={s.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{tipoLabel[s.tipo]}</div>
                      <div className="text-xs text-muted-foreground">{s.serie}-{String(s.correlativo).padStart(6, "0")}</div>
                    </td>
                    <td className="px-4 py-3">
                      {s.customers?.nombre ?? <span className="text-muted-foreground">Sin cliente</span>}
                      {s.customers && <div className="text-xs text-muted-foreground">{s.customers.doc_tipo} {s.customers.doc_numero}</div>}
                    </td>
                    <td className="px-4 py-3">{format(new Date(s.created_at), "dd/MM/yyyy HH:mm")}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(Number(s.total))}</td>
                    <td className="px-4 py-3">
                      <Badge variant={s.estado === "emitida" ? "default" : "secondary"}>{s.estado}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(s.id)}>
                        <FileText className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {(data?.sales ?? []).length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Aún no hay ventas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SaleDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function SaleDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["sale", id],
    queryFn: () => getSale({ data: { id: id! } }),
    enabled: !!id,
  });
  const s = data?.sale as any;
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {s ? `${tipoLabel[s.tipo]} ${s.serie}-${String(s.correlativo).padStart(6, "0")}` : "Comprobante"}
          </DialogTitle>
        </DialogHeader>
        {isLoading || !s ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Fecha:</span> {format(new Date(s.created_at), "dd/MM/yyyy HH:mm")}</div>
              <div><span className="text-muted-foreground">Pago:</span> {s.metodo}</div>
              <div><span className="text-muted-foreground">Vendedor:</span> {s.profiles?.full_name ?? "—"}</div>
              <div><span className="text-muted-foreground">Estado:</span> {s.estado}</div>
            </div>
            {s.customers && (
              <div className="border-t pt-3">
                <div className="font-semibold">{s.customers.nombre}</div>
                <div className="text-muted-foreground">{s.customers.doc_tipo} {s.customers.doc_numero}</div>
                {s.customers.direccion && <div className="text-muted-foreground">{s.customers.direccion}</div>}
              </div>
            )}
            <table className="w-full border-t">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-2">Producto</th><th>Cant.</th><th className="text-right">P.U.</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {s.sale_items.map((it: any) => (
                  <tr key={it.id} className="border-t">
                    <td className="py-2">{it.title}</td>
                    <td>{it.qty}</td>
                    <td className="text-right">{fmt(Number(it.unit_price))}</td>
                    <td className="text-right">{fmt(Number(it.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t pt-3 space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>{fmt(Number(s.subtotal))}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>IGV</span><span>{fmt(Number(s.igv))}</span></div>
              <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{fmt(Number(s.total))}</span></div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />Imprimir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
