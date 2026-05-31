// ════════════════════════════════════════════════════════════════
// Generador de PDF para comprobantes (Boleta / Factura / Guía)
// Estilo similar a KeyFacil.com — usa canvas/HTML → window.print()
// ════════════════════════════════════════════════════════════════

export interface ComprobanteParaPDF {
  tipo: "boleta" | "factura" | "nota" | "guia_remision";
  numero: string;          // B001-00000001
  fechaEmision: string;    // DD/MM/YYYY
  moneda: "PEN" | "USD";
  // Emisor
  emisorRuc: string;
  emisorRazon: string;
  emisorDireccion: string;
  // Receptor
  receptorDoc: string;
  receptorNombre: string;
  receptorDireccion?: string;
  receptorEmail?: string;
  // Items
  items: {
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
  }[];
  subtotal: number;
  igv: number;
  total: number;
  notas?: string;
  // Guía de remisión
  motivoTraslado?: string;
  direccionPartida?: string;
  direccionLlegada?: string;
  qrData?: string;   // Datos para QR (si se tiene firma digital)
  estado?: "completada" | "anulada";
}

const tipoLabel: Record<string, string> = {
  boleta: "BOLETA DE VENTA ELECTRÓNICA",
  factura: "FACTURA ELECTRÓNICA",
  nota: "NOTA DE CRÉDITO ELECTRÓNICA",
  guia_remision: "GUÍA DE REMISIÓN REMITENTE ELECTRÓNICA",
};

const monedaLabel: Record<string, string> = { PEN: "S/", USD: "$" };

/** Genera el HTML del comprobante para imprimir o descargar como PDF */
export function buildComprobanteHtml(data: ComprobanteParaPDF): string {
  const sym = monedaLabel[data.moneda] ?? "S/";
  const fmt = (n: number) => `${sym} ${n.toFixed(2)}`;
  const anulado = data.estado === "anulada";

  const itemsRows = data.items.map(
    (it) => `
    <tr>
      <td>${escH(it.codigo)}</td>
      <td>${escH(it.descripcion)}</td>
      <td style="text-align:center">${it.unidad}</td>
      <td style="text-align:right">${it.cantidad}</td>
      <td style="text-align:right">${fmt(it.precioUnitario)}</td>
      <td style="text-align:right">${fmt(it.total)}</td>
    </tr>`
  ).join("");

  const guiaExtra = data.motivoTraslado ? `
    <div class="section">
      <h3>Datos de traslado</h3>
      <table class="info-table">
        <tr><td>Motivo:</td><td>${escH(data.motivoTraslado)}</td></tr>
        ${data.direccionPartida ? `<tr><td>Partida:</td><td>${escH(data.direccionPartida)}</td></tr>` : ""}
        ${data.direccionLlegada ? `<tr><td>Llegada:</td><td>${escH(data.direccionLlegada)}</td></tr>` : ""}
      </table>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${tipoLabel[data.tipo] ?? "Comprobante"} ${data.numero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #222; background: #fff; }
    .page { width: 21cm; min-height: 29.7cm; margin: 0 auto; padding: 1.5cm; position: relative; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .emisor h1 { font-size: 16px; font-weight: bold; color: #1a56db; }
    .emisor p { font-size: 10px; color: #555; }
    .tipo-box { border: 2px solid #1a56db; border-radius: 4px; padding: 10px 16px; text-align: center; min-width: 200px; }
    .tipo-box .tipo { font-size: 11px; font-weight: bold; color: #1a56db; }
    .tipo-box .numero { font-size: 14px; font-weight: bold; margin-top: 4px; }
    .tipo-box .fecha { font-size: 10px; color: #555; margin-top: 4px; }
    .receptor-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; margin-bottom: 16px; }
    .receptor-box table td:first-child { font-weight: bold; width: 90px; color: #444; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .items-table th { background: #1a56db; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
    .items-table td { padding: 5px 8px; border-bottom: 1px solid #e8ecf0; font-size: 10px; }
    .items-table tr:nth-child(even) td { background: #f8fafc; }
    .totales { display: flex; justify-content: flex-end; margin-bottom: 16px; }
    .totales table { min-width: 220px; }
    .totales table td { padding: 3px 8px; font-size: 11px; }
    .totales table td:last-child { text-align: right; }
    .totales .total-row td { font-weight: bold; font-size: 13px; border-top: 2px solid #1a56db; padding-top: 6px; color: #1a56db; }
    .notas { font-size: 10px; color: #555; border-top: 1px dashed #ccc; padding-top: 8px; margin-bottom: 12px; }
    .footer { border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9px; color: #888; text-align: center; }
    .anulado-stamp { position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg);
      font-size: 80px; font-weight: 900; color: rgba(220,38,38,0.18); white-space: nowrap; pointer-events: none; z-index: 10; }
    .section { margin-bottom: 12px; }
    .section h3 { font-size: 11px; font-weight: bold; color: #444; margin-bottom: 6px; }
    .info-table td { padding: 2px 4px; font-size: 10px; }
    .info-table td:first-child { font-weight: bold; width: 100px; }
    @media print {
      body { background: white; }
      .page { margin: 0; padding: 1cm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
<div class="page">
  ${anulado ? '<div class="anulado-stamp">ANULADO</div>' : ""}
  
  <!-- Header -->
  <div class="header">
    <div class="emisor">
      <h1>${escH(data.emisorRazon)}</h1>
      <p>RUC: <strong>${escH(data.emisorRuc)}</strong></p>
      <p>${escH(data.emisorDireccion)}</p>
    </div>
    <div class="tipo-box">
      <div class="tipo">RUC ${escH(data.emisorRuc)}</div>
      <div class="tipo" style="margin-top:6px">${tipoLabel[data.tipo] ?? "COMPROBANTE"}</div>
      <div class="numero">${escH(data.numero)}</div>
      <div class="fecha">Fecha: ${escH(data.fechaEmision)}</div>
      ${anulado ? '<div style="color:#dc2626;font-weight:bold;margin-top:4px">ANULADO</div>' : ""}
    </div>
  </div>

  <!-- Receptor -->
  <div class="receptor-box">
    <table class="info-table">
      <tr><td>Cliente:</td><td>${escH(data.receptorNombre)}</td></tr>
      <tr><td>Doc:</td><td>${escH(data.receptorDoc)}</td></tr>
      ${data.receptorDireccion ? `<tr><td>Dirección:</td><td>${escH(data.receptorDireccion)}</td></tr>` : ""}
      ${data.receptorEmail ? `<tr><td>Email:</td><td>${escH(data.receptorEmail)}</td></tr>` : ""}
    </table>
  </div>

  ${guiaExtra}

  <!-- Items -->
  <table class="items-table">
    <thead>
      <tr>
        <th>Código</th>
        <th>Descripción</th>
        <th>U.M.</th>
        <th>Cant.</th>
        <th>P. Unit.</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <!-- Totales -->
  <div class="totales">
    <table>
      <tr><td>Subtotal:</td><td>${fmt(data.subtotal)}</td></tr>
      <tr><td>IGV (18%):</td><td>${fmt(data.igv)}</td></tr>
      <tr class="total-row"><td>TOTAL:</td><td>${fmt(data.total)}</td></tr>
    </table>
  </div>

  ${data.notas ? `<div class="notas"><strong>Notas:</strong> ${escH(data.notas)}</div>` : ""}

  <!-- Footer -->
  <div class="footer">
    <p>Representación impresa del comprobante de pago electrónico.</p>
    <p>Consulte su comprobante en: <strong>https://e-consulta.sunat.gob.pe</strong></p>
  </div>
</div>

<!-- Botones de acción (solo pantalla, no imprime) -->
<div class="no-print" style="position:fixed;bottom:20px;right:20px;display:flex;gap:8px;z-index:100">
  <button onclick="window.print()" 
    style="background:#1a56db;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:14px">
    🖨️ Imprimir / PDF
  </button>
  <button onclick="window.close()" 
    style="background:#6b7280;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:14px">
    ✕ Cerrar
  </button>
</div>
</body>
</html>`;
}

function escH(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Abre el comprobante en una nueva pestaña lista para imprimir */
export function printComprobante(data: ComprobanteParaPDF) {
  const html = buildComprobanteHtml(data);
  const win = window.open("", "_blank");
  if (!win) { alert("Permite las ventanas emergentes para imprimir."); return; }
  win.document.write(html);
  win.document.close();
}

/** Descarga el HTML del comprobante como archivo */
export function downloadComprobanteHtml(data: ComprobanteParaPDF) {
  const html = buildComprobanteHtml(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.numero}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Descarga el XML del comprobante */
export function downloadComprobanteXml(xmlContent: string, numero: string) {
  const blob = new Blob([xmlContent], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${numero}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Genera link de WhatsApp para compartir el comprobante */
export function whatsappShare(receptorTel: string, numero: string, total: number, appUrl: string) {
  const tel = receptorTel.replace(/\D/g, "");
  const msg = encodeURIComponent(
    `Hola! Te enviamos tu comprobante *${numero}* por S/ ${total.toFixed(2)}.\n` +
    `Puedes verlo aquí: ${appUrl}/comprobante/${numero}`
  );
  window.open(`https://wa.me/${tel.startsWith("51") ? tel : "51" + tel}?text=${msg}`, "_blank");
}

/** Genera mailto para enviar comprobante por correo */
export function emailShare(email: string, numero: string, emisorNombre: string, total: number) {
  const subject = encodeURIComponent(`Comprobante ${numero} — ${emisorNombre}`);
  const body = encodeURIComponent(
    `Estimado cliente,\n\nAdjuntamos su comprobante de pago:\n\n` +
    `Número: ${numero}\nTotal: S/ ${total.toFixed(2)}\n\n` +
    `Saludos,\n${emisorNombre}`
  );
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}
