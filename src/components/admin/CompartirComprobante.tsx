// src/components/admin/CompartirComprobante.tsx
// Botón «Compartir» de una boleta/factura: WhatsApp o correo, con teléfono/correo precargados del cliente
// (o escritos a mano si faltan). Solo vive dentro del panel; no crea enlaces públicos.
import { useState } from "react";
import { MessageCircle, Mail, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  armarMensajeComprobante, emailValido, normalizarTelefono, urlCorreo, urlWhatsApp,
  type ComprobanteCompartible,
} from "@/lib/compartirComprobante";

export function CompartirComprobante({ sale, className }: { sale: ComprobanteCompartible; className?: string }) {
  const [abierto, setAbierto] = useState(false);
  const msg = armarMensajeComprobante(sale);
  const [tel, setTel] = useState("");
  const [mail, setMail] = useState("");

  const abrir = () => {
    setTel(sale.customers?.telefono ?? "");
    setMail(sale.customers?.email ?? "");
    setAbierto(true);
  };

  const enviarWhatsApp = () => {
    const n = normalizarTelefono(tel);
    if (!n) { toast.error("Escribe un celular válido (9 dígitos, o con + y código de país)"); return; }
    window.open(urlWhatsApp(n, msg.texto), "_blank", "noopener,noreferrer");
  };
  const enviarCorreo = () => {
    if (!emailValido(mail)) { toast.error("Escribe un correo válido"); return; }
    window.location.href = urlCorreo(mail, msg.asunto, msg.texto);
  };

  return (
    <>
      <Button size="sm" variant="outline" className={className} onClick={abrir}>
        <Share2 className="mr-1 h-3.5 w-3.5" /> Compartir
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compartir {sale.numero}</DialogTitle>
            <DialogDescription>
              Se envía un resumen del comprobante{msg.enlace ? " con el enlace oficial de SUNAT/Nubefact" : ""}.
              {!msg.enlace && " Sin enlace: este comprobante aún no está aceptado por SUNAT."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Mensaje</Label>
            <Textarea readOnly value={msg.texto} rows={6} className="text-sm" />
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cmp-tel">Celular (WhatsApp)</Label>
              <Input id="cmp-tel" type="tel" inputMode="tel" autoComplete="off" placeholder="987 654 321"
                value={tel} onChange={(e) => setTel(e.target.value)} className="h-11 sm:h-9" />
              <Button className="h-11 w-full sm:h-9" onClick={enviarWhatsApp}>
                <MessageCircle className="mr-1.5 h-4 w-4" /> Enviar por WhatsApp
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cmp-mail">Correo</Label>
              <Input id="cmp-mail" type="email" inputMode="email" autoComplete="off" placeholder="cliente@correo.com"
                value={mail} onChange={(e) => setMail(e.target.value)} className="h-11 sm:h-9" />
              <Button variant="outline" className="h-11 w-full sm:h-9" onClick={enviarCorreo}>
                <Mail className="mr-1.5 h-4 w-4" /> Enviar por correo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
