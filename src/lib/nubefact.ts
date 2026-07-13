// ════════════════════════════════════════════════════════════════
// NUBEFACT — PSE para emisión de comprobantes electrónicos SUNAT
// Docs: https://www.nubefact.com/api-cpe/
// ════════════════════════════════════════════════════════════════
//
// VARIABLES DE ENTORNO REQUERIDAS:
//   NUBEFACT_TOKEN      → desde app.nubefact.com → Configuración → Token
//   NUBEFACT_RUC        → RUC del emisor (G&M Mueblería)
//   NUBEFACT_AMBIENTE   → "demo" | "produccion"
// ════════════════════════════════════════════════════════════════

// ── URLs por ambiente ────────────────────────────────────────────
const NUBEFACT_URL = {
  demo:       "https://demo-api.nubefact.com/api/v1",
  produccion: "https://api.nubefact.com/api/v1",
} as const;

function getApiBase(): string {
  const env = (process.env.NUBEFACT_AMBIENTE ?? "demo") as keyof typeof NUBEFACT_URL;
  return NUBEFACT_URL[env] ?? NUBEFACT_URL.demo;
}

function getToken(): string {
  const token = process.env.NUBEFACT_TOKEN;
  if (!token) throw new Error("NUBEFACT_TOKEN no configurado en variables de entorno");
  return token;
}

// ── Tipos ────────────────────────────────────────────────────────

export type TipoComprobante = "boleta" | "factura";

/** Ítem de línea para Nubefact */
export interface NubefactItem {
  unidad_de_medida: string;          // "NIU" (unidad) | "ZZ" (servicio)
  codigo: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;            // sin IGV
  precio_unitario: number;           // con IGV (valor_unitario * 1.18)
  descuento: number;                 // 0 si no aplica
  subtotal: number;                  // cantidad * valor_unitario
  tipo_de_igv: number;               // 1 = gravado, 8 = inafecto, 9 = exonerado
  igv: number;                       // cantidad * valor_unitario * 0.18
  total: number;                     // subtotal + igv
  anticipo_regularizacion: boolean;
  anticipo_documento_serie: string;
  anticipo_documento_numero: number;
}

/** Payload completo para emitir un comprobante vía Nubefact */
export interface NubefactPayload {
  operacion: "generar_comprobante";
  tipo_de_comprobante: number;       // 2 = boleta, 1 = factura
  serie: string;                     // "B001" | "F001"
  numero: number;                    // correlativo numérico
  sunat_transaction: number;         // 1 = venta normal
  cliente_tipo_de_documento: number; // 1=DNI, 6=RUC, 4=CE, 0=varios
  cliente_numero_de_documento: string;
  cliente_denominacion: string;
  cliente_direccion: string;
  cliente_email: string;
  cliente_email_1?: string;
  fecha_de_emision: string;          // "dd-mm-yyyy"
  fecha_de_vencimiento?: string;
  moneda: number;                    // 1 = PEN, 2 = USD
  tipo_de_cambio: number;            // 0 si moneda = PEN
  porcentaje_de_igv: number;         // 18
  descuento_global: number;
  total_descuento: number;
  total_anticipo: number;
  total_gravada: number;
  total_inafecta: number;
  total_exonerada: number;
  total_igv: number;
  total_gratuita: number;
  total_otros_cargos: number;
  total: number;
  percepcion_tipo?: number;
  percepcion_base_imponible?: number;
  total_percepcion?: number;
  total_incluido_percepcion?: number;
  detraccion?: boolean;
  observaciones?: string;
  documento_que_se_modifica_tipo?: number;
  documento_que_se_modifica_serie?: string;
  documento_que_se_modifica_numero?: number;
  tipo_de_nota_de_credito?: number;
  tipo_de_nota_de_debito?: number;
  enviar_automaticamente_a_la_sunat: boolean;
  enviar_automaticamente_al_cliente: boolean;
  codigo_unico?: string;
  condiciones_de_pago?: string;
  medio_de_pago?: string;
  placa_vehiculo?: string;
  orden_compra_servicio?: string;
  items: NubefactItem[];
}

/** Respuesta de la API de Nubefact */
export interface NubefactRespuesta {
  aceptado_por_sunat: boolean;
  serie: string;
  numero: number;
  tipo_de_comprobante: number;
  sunat_description: string;
  sunat_note: string;
  sunat_responsecode: string;
  sunat_soap_error: string;
  enlace_del_pdf: string;
  enlace_del_xml: string;
  enlace_del_cdr: string;
  codigo_hash: string;
  // campos adicionales de error
  errors?: Record<string, string[]>;
}

// ── Helpers ──────────────────────────────────────────────────────

function formatFecha(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Extrae serie y correlativo de un número de comprobante tipo "B001-00000042" */
function parsearNumero(numero: string): { serie: string; correlativo: number } {
  const partes = numero.split("-");
  if (partes.length !== 2) throw new Error(`Número de comprobante inválido: ${numero}`);
  return {
    serie: partes[0],
    correlativo: parseInt(partes[1], 10),
  };
}

// ── Función principal: emitir comprobante ────────────────────────

/**
 * Emite un comprobante electrónico (boleta o factura) via Nubefact.
 * 
 * @param params - Datos de la venta
 * @returns Respuesta de Nubefact con enlace PDF, XML, CDR y hash
 * 
 * @example
 * const resp = await emitirComprobante({
 *   tipo: "boleta",
 *   numero: "B001-00000042",
 *   fecha: new Date(),
 *   cliente: {
 *     tipoDoc: "1",     // 1=DNI
 *     numDoc: "12345678",
 *     nombre: "Juan Pérez",
 *     email: "juan@email.com",
 *   },
 *   items: [
 *     {
 *       descripcion: "Sofá Londres 3 cuerpos",
 *       codigo: "SOF-LON-3",
 *       cantidad: 1,
 *       valorUnitario: 1694.92,  // sin IGV
 *     }
 *   ],
 *   subtotal: 1694.92,
 *   igv: 305.08,
 *   total: 2000.00,
 * });
 */
export async function emitirComprobante(params: {
  tipo: TipoComprobante;
  numero: string;                     // e.g. "B001-00000042"
  fecha?: Date | string;
  cliente: {
    tipoDoc: "0" | "1" | "4" | "6";  // 0=varios, 1=DNI, 4=CE, 6=RUC
    numDoc: string;
    nombre: string;
    direccion?: string;
    email?: string;
  };
  items: {
    descripcion: string;
    codigo: string;
    cantidad: number;
    valorUnitario: number;            // SIN IGV
    unidad?: string;                  // default "NIU"
  }[];
  subtotal: number;
  igv: number;
  total: number;
  observaciones?: string;
  moneda?: "PEN" | "USD";
}): Promise<NubefactRespuesta> {
  const { serie, correlativo } = parsearNumero(params.numero);
  const fecha = params.fecha ? formatFecha(params.fecha) : formatFecha(new Date());
  const moneda = params.moneda ?? "PEN";
  const tipoCpe = params.tipo === "boleta" ? 2 : 1;
  const tipoDocCliente = parseInt(params.cliente.tipoDoc, 10);

  const items: NubefactItem[] = params.items.map((it) => {
    const igvLinea  = parseFloat((it.valorUnitario * it.cantidad * 0.18).toFixed(2));
    const subtotal  = parseFloat((it.valorUnitario * it.cantidad).toFixed(2));
    const total     = parseFloat((subtotal + igvLinea).toFixed(2));
    return {
      unidad_de_medida:               it.unidad ?? "NIU",
      codigo:                         it.codigo,
      descripcion:                    it.descripcion,
      cantidad:                       it.cantidad,
      valor_unitario:                 parseFloat(it.valorUnitario.toFixed(6)),
      precio_unitario:                parseFloat((it.valorUnitario * 1.18).toFixed(6)),
      descuento:                      0,
      subtotal,
      tipo_de_igv:                    1,   // gravado
      igv:                            igvLinea,
      total,
      anticipo_regularizacion:        false,
      anticipo_documento_serie:       "",
      anticipo_documento_numero:      0,
    };
  });

  const payload: NubefactPayload = {
    operacion:                          "generar_comprobante",
    tipo_de_comprobante:                tipoCpe,
    serie,
    numero:                             correlativo,
    sunat_transaction:                  1,
    cliente_tipo_de_documento:          tipoDocCliente,
    cliente_numero_de_documento:        params.cliente.numDoc,
    cliente_denominacion:               params.cliente.nombre,
    cliente_direccion:                  params.cliente.direccion ?? "",
    cliente_email:                      params.cliente.email ?? "",
    fecha_de_emision:                   fecha,
    moneda:                             moneda === "PEN" ? 1 : 2,
    tipo_de_cambio:                     0,
    porcentaje_de_igv:                  18,
    descuento_global:                   0,
    total_descuento:                    0,
    total_anticipo:                     0,
    total_gravada:                      parseFloat(params.subtotal.toFixed(2)),
    total_inafecta:                     0,
    total_exonerada:                    0,
    total_igv:                          parseFloat(params.igv.toFixed(2)),
    total_gratuita:                     0,
    total_otros_cargos:                 0,
    total:                              parseFloat(params.total.toFixed(2)),
    observaciones:                      params.observaciones ?? "",
    enviar_automaticamente_a_la_sunat:  true,
    enviar_automaticamente_al_cliente:  params.cliente.email ? true : false,
    items,
  };

  const resp = await fetch(`${getApiBase()}/${process.env.NUBEFACT_RUC}/comprobantes/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Token ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });

  const json: NubefactRespuesta = await resp.json();

  if (!resp.ok) {
    const errMsg = json.errors
      ? Object.entries(json.errors).map(([k, v]) => `${k}: ${v.join(", ")}`).join(" | ")
      : `HTTP ${resp.status}`;
    throw new Error(`Nubefact error: ${errMsg}`);
  }

  return json;
}

// ── Consultar estado de un comprobante ───────────────────────────

export async function consultarComprobante(params: {
  tipo: TipoComprobante;
  numero: string;   // "B001-00000042"
}): Promise<NubefactRespuesta> {
  const { serie, correlativo } = parsearNumero(params.numero);
  const tipoCpe = params.tipo === "boleta" ? 2 : 1;

  const ruc = process.env.NUBEFACT_RUC;
  const url = `${getApiBase()}/${ruc}/comprobantes/${tipoCpe}/${serie}/${correlativo}/`;

  const resp = await fetch(url, {
    headers: { "Authorization": `Token ${getToken()}` },
  });

  if (!resp.ok) {
    throw new Error(`Nubefact consulta error: HTTP ${resp.status}`);
  }

  return resp.json();
}

// ── Anular/Dar de baja un comprobante ───────────────────────────

export async function anularComprobante(params: {
  tipo: TipoComprobante;
  numero: string;       // "B001-00000042"
  motivo: string;
}): Promise<{ aceptado: boolean; descripcion: string }> {
  const { serie, correlativo } = parsearNumero(params.numero);
  const tipoCpe = params.tipo === "boleta" ? 2 : 1;

  const payload = {
    operacion:           "generar_anulacion",
    tipo_de_comprobante: tipoCpe,
    serie,
    numero:              correlativo,
    motivo:              params.motivo,
  };

  const resp = await fetch(`${getApiBase()}/${process.env.NUBEFACT_RUC}/comprobantes/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Token ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await resp.json();

  if (!resp.ok) {
    throw new Error(`Nubefact anulación error: HTTP ${resp.status} - ${JSON.stringify(json)}`);
  }

  return {
    aceptado:    json.aceptado_por_sunat ?? false,
    descripcion: json.sunat_description ?? "Procesado",
  };
}