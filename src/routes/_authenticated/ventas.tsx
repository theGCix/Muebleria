import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listSales, getSale, anularVenta, listVentasUnificadas, getOrderDetalle } from "@/lib/pos.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, Download, Mail, MessageCircle, XCircle, FileX, FileDown } from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  printComprobante, downloadComprobanteHtml, downloadComprobanteXml,
  whatsappShare, emailShare, type ComprobanteParaPDF,
} from "@/lib/comprobante-pdf";
import { buildInvoiceXml, type ComprobanteData } from "@/lib/sunat";

export const Route = createFileRoute("/_authenticated/ventas")({
  head: () => ({ meta: [{ title: "Ventas y comprobantes — G&M" }] }),
  component: VentasPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

const tipoLabel: Record<string, string> = {
  boleta: "Boleta",
  factura: "Factura",
  nota: "Nota crédito",
};
const tipoColor: Record<string, "default" | "secondary" | "outline"> = {
  boleta: "default",
  factura: "secondary",
  nota: "outline",
};

// ── Helpers para construir datos de comprobante ──────────────
function saleToComprobanteData(sale: any): ComprobanteParaPDF {
  return {
    tipo: sale.tipo,
    numero: sale.numero,
    fechaEmision: format(new Date(sale.created_at), "dd/MM/yyyy"),
    moneda: "PEN",
    emisorRuc: import.meta.env.VITE_SUNAT_RUC ?? "00000000000",
    emisorRazon: "G&M MUEBLERIA",
    emisorDireccion: "Lima, Perú",
    receptorDoc: sale.customers
      ? `${sale.customers.doc_tipo}: ${sale.customers.doc_numero}`
      : "Sin documento",
    receptorNombre: sale.customers?.nombre ?? "Consumidor final",
    receptorDireccion: sale.customers?.direccion,
    receptorEmail: sale.customers?.email,
    items: (sale.sale_items ?? []).map((it: any) => ({
      codigo: it.sku ?? "PROD",
      descripcion: it.title,
      unidad: "NIU",
      cantidad: Number(it.qty),
      precioUnitario: Number(it.unit_price),
      total: Number(it.total),
    })),
    subtotal: Number(sale.subtotal),
    igv: Number(sale.igv),
    total: Number(sale.total),
    notas: sale.notas,
    estado: sale.estado,
  };
}

function saleToXmlData(sale: any): ComprobanteData {
  const tipoDocReceptor = sale.customers?.doc_tipo === "RUC" ? "6"
    : sale.customers?.doc_tipo === "CE" ? "4"
    : sale.customers?.doc_tipo === "PASAPORTE" ? "7" : "1";
  return {
    tipo: sale.tipo === "nota" ? "nota_credito" : sale.tipo,
    serie: sale.numero?.split("-")[0] ?? "B001",
    correlativo: sale.numero?.split("-")[1] ?? "00000001",
    fechaEmision: format(new Date(sale.created_at), "yyyy-MM-dd"),
    moneda: "PEN",
    emisor: {
      ruc: import.meta.env.SUNAT_RUC ?? "00000000000",
      razonSocial: "G&M MUEBLERIA",
      direccion: "Lima, Perú",
      ubigeo: "150101",
    },
    receptor: {
      tipoDoc: tipoDocReceptor as any,
      numDoc: sale.customers?.doc_numero ?? "00000000",
      razonSocial: sale.customers?.nombre ?? "Consumidor final",
      email: sale.customers?.email,
    },
    lineas: (sale.sale_items ?? []).map((it: any) => {
      const subtotalLinea = Number(it.total) / 1.18;
      const igvLinea = Number(it.total) - subtotalLinea;
      return {
        codigo: it.sku ?? "PROD",
        descripcion: it.title,
        unidad: "NIU",
        cantidad: Number(it.qty),
        valorUnitario: Number(it.unit_price) / 1.18,
        igvLinea: round2(igvLinea),
        totalLinea: round2(subtotalLinea),
      };
    }),
    subtotal: Number(sale.subtotal),
    igv: Number(sale.igv),
    total: Number(sale.total),
    observaciones: sale.notas,
  };
}
const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Componente de acciones del comprobante ───────────────────
function ComprobanteActions({ sale }: { sale: any }) {
  const qc = useQueryClient();
  const [confirmAnular, setConfirmAnular] = useState(false);
  const anularMut = useMutation({
    mutationFn: () => anularVenta({ data: { id: sale.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      toast.success("Comprobante anulado");
      setConfirmAnular(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const data = saleToComprobanteData(sale);
  const xmlData = saleToXmlData(sale);

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => printComprobante(data)}>
        <FileText className="h-3.5 w-3.5 mr-1" /> Ver / Imprimir
      </Button>
      <Button size="sm" variant="outline" onClick={() => downloadComprobanteHtml(data)}>
        <Download className="h-3.5 w-3.5 mr-1" /> PDF
      </Button>
      <Button
        size="sm" variant="outline"
        onClick={() => downloadComprobanteXml(buildInvoiceXml(xmlData), sale.numero)}
      >
        <FileDown className="h-3.5 w-3.5 mr-1" /> XML
      </Button>
      {sale.customers?.telefono && (
        <Button
          size="sm" variant="outline"
          onClick={() => whatsappShare(sale.customers.telefono, sale.numero, Number(sale.total), window.location.origin)}
        >
          <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
        </Button>
      )}
      {sale.customers?.email && (
        <Button
          size="sm" variant="outline"
          onClick={() => emailShare(sale.customers.email, sale.numero, "G&M Mueblería", Number(sale.total))}
        >
          <Mail className="h-3.5 w-3.5 mr-1" /> Correo
        </Button>
      )}
      {sale.estado !== "anulada" && (
        <Button size="sm" variant="destructive" onClick={() => setConfirmAnular(true)}>
          <XCircle className="h-3.5 w-3.5 mr-1" /> Anular
        </Button>
      )}

      <AlertDialog open={confirmAnular} onOpenChange={setConfirmAnular}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular comprobante?</AlertDialogTitle>
            <AlertDialogDescription>
              Se anulará el comprobante <strong>{sale.numero}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => anularMut.mutate()}
              disabled={anularMut.isPending}
            >
              {anularMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Sí, anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Descarga de XML por período ───────────────────────────────
function DescargaPeriodo({ sales }: { sales: any[] }) {
  const [mes, setMes] = useState(() => format(new Date(), "yyyy-MM"));

  const download = () => {
    const filtered = sales.filter((s) =>
      format(new Date(s.created_at), "yyyy-MM") === mes && s.sale_items
    );
    if (!filtered.length) { toast.error("No hay comprobantes en ese período"); return; }

    // Genera un ZIP conceptual: descarga cada XML como archivo individual
    // Para un ZIP real se necesitaría la librería jszip (se puede agregar)
    filtered.forEach((s) => {
      const xmlData = saleToXmlData(s);
      downloadComprobanteXml(buildInvoiceXml(xmlData), s.numero);
    });
    toast.success(`${filtered.length} XML descargados`);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Exportar período:</span>
      <Input
        type="month"
        value={mes}
        onChange={(e) => setMes(e.target.value)}
        className="w-40"
      />
      <Button size="sm" variant="outline" onClick={download}>
        <FileX className="h-4 w-4 mr-1" /> Descargar XML del período
      </Button>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
function VentasPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: () => listSales(),
  });
  const { data: dataUnificada, isLoading: isLoadingUnificada } = useQuery({
    queryKey: ["ventas-unificadas"],
    queryFn: () => listVentasUnificadas(),
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroCanal, setFiltroCanal] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");

  const { data: saleDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["sale", openId],
    queryFn: () => (openId ? getSale({ id: openId }) : null),
    enabled: !!openId,
  });

  const { data: orderDetail, isLoading: loadingOrderDetail } = useQuery({
    queryKey: ["order-detalle", openOrderId],
    queryFn: () => (openOrderId ? getOrderDetalle({ id: openOrderId }) : null),
    enabled: !!openOrderId,
  });

  const ventas = useMemo(() => {
    const all = dataUnificada?.ventas ?? [];
    return all.filter((v) => {
      const matchTipo = filtroTipo === "todos" || v.tipo === filtroTipo;
      const matchEstado = filtroEstado === "todos" || v.estado === filtroEstado;
      const matchCanal = filtroCanal === "todos" || v.canal === filtroCanal;
      const matchSearch =
        !busqueda ||
        v.numero?.toLowerCase().includes(busqueda.toLowerCase()) ||
        v.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase());
      return matchTipo && matchEstado && matchCanal && matchSearch;
    });
  }, [dataUnificada, filtroTipo, filtroEstado, filtroCanal, busqueda]);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold">Ventas</h1>
          <p className="text-muted-foreground">Boletas, facturas y guías de remisión</p>
        </div>
        {data?.sales && <DescargaPeriodo sales={data.sales} />}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <Input
          placeholder="Buscar por número o cliente…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="boleta">Boleta</SelectItem>
            <SelectItem value="factura">Factura</SelectItem>
            <SelectItem value="nota">Nota crédito</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="completada">Completada</SelectItem>
            <SelectItem value="anulada">Anulada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroCanal} onValueChange={setFiltroCanal}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los canales</SelectItem>
            <SelectItem value="local">🏪 Local</SelectItem>
            <SelectItem value="online">🌐 Online</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">Comprobante</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={`${v.canal}-${v.id}`} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Badge variant={tipoColor[v.tipo] ?? "outline"} className="mb-1">
                        {tipoLabel[v.tipo] ?? v.tipo}
                      </Badge>
                      <div className="font-mono text-xs">{v.numero}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">
                        {v.canal === "online" ? "🌐 Online" : "🏪 Local"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {v.cliente_nombre || (
                        <span className="text-muted-foreground">Sin cliente</span>
                      )}
                      {v.cliente_doc && (
                        <div className="text-xs text-muted-foreground">
                          DNI {v.cliente_doc}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {format(new Date(v.created_at), "dd/MM/yyyy HH:mm")}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {fmt(Number(v.total))}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={v.estado === "anulada" ? "destructive" : "default"}>
                        {v.estado}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          v.canal === "online" ? setOpenOrderId(v.id) : setOpenId(v.id)
                        }
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {ventas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground">
                      No se encontraron comprobantes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detalle / Acciones */}
      <Dialog open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del comprobante</DialogTitle>
            <DialogDescription>
              Opciones de impresión, descarga y envío
            </DialogDescription>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : saleDetail?.sale ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Número:</span> <strong>{saleDetail.sale.numero}</strong></div>
                <div><span className="text-muted-foreground">Tipo:</span> {tipoLabel[saleDetail.sale.tipo]}</div>
                <div><span className="text-muted-foreground">Fecha:</span> {format(new Date(saleDetail.sale.created_at), "dd/MM/yyyy HH:mm")}</div>
                <div><span className="text-muted-foreground">Total:</span> <strong>{fmt(Number(saleDetail.sale.total))}</strong></div>
                <div><span className="text-muted-foreground">Estado:</span>
                  <Badge className="ml-2" variant={saleDetail.sale.estado === "anulada" ? "destructive" : "default"}>
                    {saleDetail.sale.estado}
                  </Badge>
                </div>
              </div>

              {saleDetail.sale.customers && (
                <div className="bg-muted/30 rounded p-3 text-sm">
                  <p className="font-medium mb-1">Cliente</p>
                  <p>{saleDetail.sale.customers.nombre}</p>
                  <p className="text-muted-foreground">{saleDetail.sale.customers.doc_tipo} {saleDetail.sale.customers.doc_numero}</p>
                </div>
              )}

              <div>
                <p className="font-medium text-sm mb-2">Ítems</p>
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">Producto</th>
                        <th className="px-3 py-2 text-right">Cant.</th>
                        <th className="px-3 py-2 text-right">P. Unit.</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(saleDetail.sale.sale_items ?? []).map((it: any) => (
                        <tr key={it.id} className="border-t">
                          <td className="px-3 py-2">{it.title}</td>
                          <td className="px-3 py-2 text-right">{it.qty}</td>
                          <td className="px-3 py-2 text-right">{fmt(Number(it.unit_price))}</td>
                          <td className="px-3 py-2 text-right">{fmt(Number(it.total))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <ComprobanteActions sale={saleDetail.sale} />
            </div>
          ) : (
            <p className="text-muted-foreground">No se pudo cargar el detalle.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog para pedidos ONLINE ── */}
      <Dialog open={!!openOrderId} onOpenChange={(v) => !v && setOpenOrderId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido Online</DialogTitle>
            <DialogDescription>
              Detalle del pedido y opciones de comprobante
            </DialogDescription>
          </DialogHeader>
          {loadingOrderDetail ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : orderDetail?.order ? (
            <div className="space-y-4">
              {/* Info del pedido */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Número:</span> <strong>{orderDetail.order.order_number}</strong></div>
                <div><span className="text-muted-foreground">Estado:</span>
                  <Badge className="ml-2" variant={orderDetail.order.status === "cancelado" ? "destructive" : "default"}>
                    {orderDetail.order.status}
                  </Badge>
                </div>
                <div><span className="text-muted-foreground">Fecha:</span> {format(new Date(orderDetail.order.created_at), "dd/MM/yyyy HH:mm")}</div>
                <div><span className="text-muted-foreground">Total:</span> <strong>{fmt(Number(orderDetail.order.total))}</strong></div>
                {orderDetail.order.paid_at && (
                  <div><span className="text-muted-foreground">Pagado:</span> {format(new Date(orderDetail.order.paid_at), "dd/MM/yyyy HH:mm")}</div>
                )}
              </div>

              {/* Cliente */}
              <div className="bg-muted/30 rounded p-3 text-sm">
                <p className="font-medium mb-1">Cliente</p>
                <p>{orderDetail.order.nombre}</p>
                {orderDetail.order.dni && (
                  <p className="text-muted-foreground">DNI: {orderDetail.order.dni}</p>
                )}
                {orderDetail.order.email && (
                  <p className="text-muted-foreground">{orderDetail.order.email}</p>
                )}
                {orderDetail.order.telefono && (
                  <p className="text-muted-foreground">Tel: {orderDetail.order.telefono}</p>
                )}
                {orderDetail.order.direccion && (
                  <p className="text-muted-foreground">
                    {orderDetail.order.direccion}{orderDetail.order.distrito ? `, ${orderDetail.order.distrito}` : ""}{orderDetail.order.ciudad ? `, ${orderDetail.order.ciudad}` : ""}
                  </p>
                )}
              </div>

              {/* Ítems */}
              <div>
                <p className="font-medium text-sm mb-2">Ítems</p>
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">Producto</th>
                        <th className="px-3 py-2 text-right">Cant.</th>
                        <th className="px-3 py-2 text-right">P. Unit.</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(orderDetail.order.order_items ?? []).map((it: any) => (
                        <tr key={it.id} className="border-t">
                          <td className="px-3 py-2">{it.title}</td>
                          <td className="px-3 py-2 text-right">{it.qty}</td>
                          <td className="px-3 py-2 text-right">{fmt(Number(it.unit_price))}</td>
                          <td className="px-3 py-2 text-right">{fmt(Number(it.total))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30">
                      {Number(orderDetail.order.envio) > 0 && (
                        <tr className="border-t">
                          <td colSpan={3} className="px-3 py-2 text-right text-muted-foreground">Envío</td>
                          <td className="px-3 py-2 text-right">{fmt(Number(orderDetail.order.envio))}</td>
                        </tr>
                      )}
                      <tr className="border-t font-semibold">
                        <td colSpan={3} className="px-3 py-2 text-right">Total</td>
                        <td className="px-3 py-2 text-right">{fmt(Number(orderDetail.order.total))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Acciones de comprobante */}
              <ComprobanteActions sale={orderToSale(orderDetail.order)} />
            </div>
          ) : (
            <p className="text-muted-foreground">No se pudo cargar el pedido.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Adapta un order online al shape que espera ComprobanteActions/saleToComprobanteData ──
function orderToSale(order: any) {
  return {
    id: order.id,
    numero: order.order_number,
    tipo: "boleta" as const,
    created_at: order.created_at,
    estado: order.status === "cancelado" ? "anulada" : order.status,
    subtotal: Number(order.subtotal),
    igv: Math.round(Number(order.subtotal) * 0.18 * 100) / 100,
    total: Number(order.total),
    notas: order.notas,
    customers: {
      nombre: order.nombre,
      doc_tipo: "DNI",
      doc_numero: order.dni ?? "00000000",
      email: order.email,
      telefono: order.telefono,
      direccion: [order.direccion, order.distrito, order.ciudad].filter(Boolean).join(", "),
    },
    sale_items: (order.order_items ?? []).map((it: any) => ({
      id: it.id,
      sku: it.sku,
      title: it.title,
      qty: it.qty,
      unit_price: it.unit_price,
      total: it.total,
    })),
  };
}