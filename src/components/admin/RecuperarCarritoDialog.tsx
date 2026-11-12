import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Loader2, Mail, MessageCircle, Ticket } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  obtenerCuponRecuperacion, registrarContactoCarrito, type CarritoAbandonado,
} from "@/lib/carrito.functions";
import { whatsappLink } from "@/lib/despachos.functions";
import {
  asuntoCorreo, construirMensaje, esCorreoValido, mailtoLink, PLANTILLAS,
  type CanalRecuperacion, type PlantillaId,
} from "@/lib/recuperacionCarrito";

const fecha = (iso: string) => format(new Date(iso), "d MMM, HH:mm", { locale: es });

/** ¿Hay datos de contacto REALES para este carrito? (no se inventa ningún teléfono ni correo) */
export function canalesDisponibles(c: Pick<CarritoAbandonado, "telefono" | "email">) {
  return { whatsapp: !!whatsappLink(c.telefono, "x"), correo: esCorreoValido(c.email) };
}

/** Qué ya se hizo con este carrito (aviso automático de n8n o contacto manual). */
export function historialContacto(c: CarritoAbandonado): string[] {
  const l: string[] = [];
  if (c.recordatorio_enviado) {
    if (c.recordatorio_2_at) l.push(`Aviso automático 2 (con cupón) enviado el ${fecha(c.recordatorio_2_at)}`);
    else if (c.recordatorio_1_at) l.push(`Aviso automático 1 enviado el ${fecha(c.recordatorio_1_at)}`);
    else l.push("Ya se envió un aviso automático");
  } else if (c.recordatorio_1_at || c.recordatorio_2_at) {
    l.push("El seguimiento automático está cerrado (no se envió ningún correo automático)");
  }
  if (c.estado === "contactado" && !c.recordatorio_enviado) l.push("Ya está marcado como contactado");
  return l;
}

export function RecuperarCarritoDialog({
  carrito, esAdmin, onClose,
}: { carrito: CarritoAbandonado; esAdmin: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const disp = canalesDisponibles(carrito);
  const [canal, setCanal] = useState<CanalRecuperacion | null>(disp.correo ? "correo" : disp.whatsapp ? "whatsapp" : null);
  const [plantilla, setPlantilla] = useState<PlantillaId>("recordatorio");
  const [pausar, setPausar] = useState(true);
  const [forzar, setForzar] = useState(false);
  const [abierto, setAbierto] = useState(false);          // ya se abrió WhatsApp / el correo
  const [editado, setEditado] = useState<{ clave: string; texto: string } | null>(null);
  const enviando = useRef(false);                           // guard síncrono contra toques repetidos

  const historial = historialContacto(carrito);
  const previo = carrito.estado === "contactado" || carrito.recordatorio_enviado;

  // Cupón (solo administrador): se obtiene o se crea UNA sola vez por carrito.
  const cuponMut = useMutation({
    mutationFn: () => obtenerCuponRecuperacion({ id: carrito.id }),
    onError: (e: Error) => toast.error(e.message),
  });
  const cupon = cuponMut.data;
  const cuponOk = !!cupon && cupon.estado !== "no_disponible";

  const clave = `${canal}|${plantilla}|${cuponOk ? cupon!.codigo : ""}`;
  const generado = useMemo(() => {
    if (!canal) return "";
    return construirMensaje({
      canal, plantilla,
      carrito: { nombre: carrito.nombre, items: carrito.items, subtotal: carrito.subtotal },
      cuponCodigo: cuponOk ? cupon!.codigo : null,
    });
  }, [canal, plantilla, carrito, cuponOk, cupon]);
  const texto = editado?.clave === clave ? editado.texto : generado;

  const registrar = useMutation({
    mutationFn: () => registrarContactoCarrito({ id: carrito.id, pausarAvisos: pausar }),
    onSuccess: (r) => {
      toast.success(r.ya_contactado ? "Contacto registrado (ya figuraba como contactado)" : "Carrito marcado como contactado");
      qc.invalidateQueries({ queryKey: ["carritos-abandonados"] });
      qc.invalidateQueries({ queryKey: ["sidebar-counts"] });
      onClose();
    },
    onError: (e: Error) => { enviando.current = false; toast.error(e.message); },
  });

  const elegirPlantilla = (id: PlantillaId) => {
    setPlantilla(id);
    if (id === "cupon" && !cuponMut.data && !cuponMut.isPending) cuponMut.mutate();
  };

  const bloqueado =
    !canal || !texto.trim() ||
    (plantilla === "cupon" && !cuponOk) ||
    cuponMut.isPending ||
    (previo && !forzar);

  const abrir = () => {
    if (bloqueado || !canal) return;
    const url = canal === "whatsapp"
      ? whatsappLink(carrito.telefono, texto)
      : carrito.email ? mailtoLink(carrito.email, asuntoCorreo(plantilla, carrito.nombre), texto) : null;
    if (!url) return;
    window.open(url, canal === "correo" ? "_self" : "_blank", "noopener,noreferrer");
    setAbierto(true);
  };

  const confirmar = () => {
    if (enviando.current) return;
    enviando.current = true;
    registrar.mutate();
  };

  const titulo = carrito.nombre || carrito.email || "Visitante sin nombre";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Recuperar carrito</DialogTitle>
          <DialogDescription>
            {titulo} · {carrito.items.length} {carrito.items.length === 1 ? "producto" : "productos"}
          </DialogDescription>
        </DialogHeader>

        {!canal ? (
          <p role="alert" className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            Este carrito no tiene un teléfono ni un correo válidos, así que no hay a quién escribirle.
            No se inventan datos de contacto.
          </p>
        ) : (
          <div className="space-y-4">
            {historial.length > 0 && (
              <div role="alert" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <ul className="space-y-0.5">{historial.map((h) => <li key={h}>{h}</li>)}</ul>
                </div>
                {previo && (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={forzar} onCheckedChange={(v) => setForzar(v === true)} aria-label="Contactar de todos modos" />
                    Contactar de todos modos
                  </label>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Canal">
              <Button
                type="button" variant={canal === "correo" ? "default" : "outline"} className="h-11 gap-2"
                disabled={!disp.correo || abierto} onClick={() => { setCanal("correo"); }}
              >
                <Mail className="h-4 w-4" /> Correo
              </Button>
              <Button
                type="button" variant={canal === "whatsapp" ? "default" : "outline"} className="h-11 gap-2"
                disabled={!disp.whatsapp || abierto} onClick={() => { setCanal("whatsapp"); }}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
            </div>
            {(!disp.correo || !disp.whatsapp) && (
              <p className="-mt-2 text-xs text-muted-foreground">
                {!disp.correo && "Sin correo válido. "}{!disp.whatsapp && "Sin teléfono válido."}
              </p>
            )}

            <div className="space-y-1">
              <Label htmlFor="rc-plantilla" className="text-xs text-muted-foreground">Plantilla</Label>
              <Select value={plantilla} onValueChange={(v) => elegirPlantilla(v as PlantillaId)} disabled={abierto}>
                <SelectTrigger id="rc-plantilla" className="h-11" aria-label="Plantilla">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PLANTILLAS) as PlantillaId[]).map((id) => (
                    <SelectItem key={id} value={id} disabled={PLANTILLAS[id].requiereCupon && !esAdmin}>
                      {PLANTILLAS[id].label}{PLANTILLAS[id].requiereCupon && !esAdmin ? " (solo administrador)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{PLANTILLAS[plantilla].descripcion}</p>
            </div>

            {plantilla === "cupon" && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm" aria-live="polite">
                <Ticket className="mt-0.5 h-4 w-4 shrink-0" />
                {cuponMut.isPending ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Obteniendo el cupón…</span>
                ) : cupon ? (
                  cuponOk ? (
                    <span>
                      <strong className="font-mono">{cupon.codigo}</strong> · {cupon.valor}% · válido hasta {cupon.vence_el ? fecha(cupon.vence_el) : "—"}
                      {cupon.estado === "existente" && " · ya existía: se reutiliza el mismo cupón"}
                    </span>
                  ) : (
                    <span className="text-red-700">
                      El cupón de este carrito ({cupon.codigo}) ya {cupon.motivo === "usado" ? "se usó" : cupon.motivo === "vencido" ? "venció" : "está desactivado"}.
                      No se genera otro automáticamente: usa la plantilla «Recordatorio» o créalo en Cupones.
                    </span>
                  )
                ) : (
                  <span>No se pudo obtener el cupón.</span>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="rc-mensaje" className="text-xs text-muted-foreground">
                Mensaje (puedes editarlo antes de enviarlo)
              </Label>
              <Textarea
                id="rc-mensaje" rows={9} className="text-sm" value={texto} disabled={abierto}
                onChange={(e) => setEditado({ clave, texto: e.target.value })}
              />
            </div>

            <label className="flex min-h-11 cursor-pointer items-start gap-2 text-sm">
              <Checkbox checked={pausar} onCheckedChange={(v) => setPausar(v === true)} className="mt-0.5" aria-label="Pausar avisos automáticos" />
              <span>
                Pausar los avisos automáticos de este carrito
                <span className="block text-xs text-muted-foreground">Recomendado: evita que n8n le escriba además de ti.</span>
              </span>
            </label>

            {!abierto ? (
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="h-11 sm:h-9" onClick={onClose}>Cancelar</Button>
                <Button className="h-11 gap-2 sm:h-9" disabled={bloqueado} onClick={abrir}>
                  {canal === "correo" ? <Mail className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                  {canal === "correo" ? "Abrir en mi correo" : "Abrir WhatsApp"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">¿Ya enviaste el mensaje?</p>
                <p className="text-xs text-muted-foreground">
                  {canal === "correo"
                    ? "Se abrió tu programa de correo: revisa y pulsa «Enviar» allí."
                    : "Se abrió WhatsApp: revisa y pulsa «Enviar» allí."}{" "}
                  Solo cuando lo hayas enviado, márcalo para que nadie más lo repita.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="h-11 sm:h-9" onClick={onClose}>Todavía no</Button>
                  <Button className="h-11 sm:h-9" disabled={registrar.isPending || registrar.isSuccess} onClick={confirmar}>
                    {registrar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sí, marcar como contactado
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
