// ════════════════════════════════════════════════════════════════
// SUNAT / Facturación Electrónica
// Integración con API de Seguridad SUNAT + emisión de comprobantes
// Manual: SIRE Ventas v29 (Canvia)
// ════════════════════════════════════════════════════════════════

const SUNAT_AMBIENTE = import.meta.env.SUNAT_AMBIENTE ?? "beta";

// URLs según ambiente
const URLS = {
  beta: {
    seguridad: "https://api-seguridad.sunat.gob.pe/v1/clientessol",
    sire: "https://api-sire.sunat.gob.pe",
    cpe: "https://e-beta.sunat.gob.pe/ol-ti-itcpegem/billService",
  },
  produccion: {
    seguridad: "https://api-seguridad.sunat.gob.pe/v1/clientessol",
    sire: "https://api-sire.sunat.gob.pe",
    cpe: "https://e-factura.sunat.gob.pe/ol-ti-itcpegem/billService",
  },
} as const;

export const SUNAT_URLS = URLS[SUNAT_AMBIENTE as keyof typeof URLS] ?? URLS.beta;

// ── Token cache (server-side sólo) ──────────────────────────
let _tokenCache: { access_token: string; expires_at: number } | null = null;

/**
 * Obtiene un Bearer token de la API de Seguridad SUNAT.
 * Ref: Manual §5.1 — POST /clientessol/{client_id}/oauth2/token/
 *
 * Requiere env:
 *   SUNAT_CLIENT_ID, SUNAT_CLIENT_SECRET,
 *   SUNAT_RUC, SUNAT_USUARIO_SOL, SUNAT_CLAVE_SOL
 */
export async function getSunatToken(): Promise<string> {
  if (_tokenCache && _tokenCache.expires_at > Date.now() + 60_000) {
    return _tokenCache.access_token;
  }

  const clientId = process.env.SUNAT_CLIENT_ID;
  const clientSecret = process.env.SUNAT_CLIENT_SECRET;
  const ruc = process.env.SUNAT_RUC;
  const usuario = process.env.SUNAT_USUARIO_SOL;
  const clave = process.env.SUNAT_CLAVE_SOL;

  if (!clientId || !clientSecret || !ruc || !usuario || !clave) {
    throw new Error(
      "Credenciales SUNAT no configuradas. Configura SUNAT_CLIENT_ID, SUNAT_CLIENT_SECRET, SUNAT_RUC, SUNAT_USUARIO_SOL, SUNAT_CLAVE_SOL en .env"
    );
  }

  const body = new URLSearchParams({
    grant_type: "password",
    scope: "https://api.sunat.gob.pe/v1/contribuyente/migeigv",
    client_id: clientId,
    client_secret: clientSecret,
    username: `${ruc}${usuario}`,
    password: clave,
  });

  const res = await fetch(
    `${SUNAT_URLS.seguridad}/${clientId}/oauth2/token/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SUNAT auth error ${res.status}: ${err}`);
  }

  const json = await res.json();
  _tokenCache = {
    access_token: json.access_token,
    expires_at: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return _tokenCache.access_token;
}

// ── Tipos de comprobante ─────────────────────────────────────
export type TipoComprobante = "boleta" | "factura" | "nota_credito" | "guia_remision";

export interface LineaComprobante {
  codigo: string;
  descripcion: string;
  unidad: string; // NIU = unidad, ZZ = servicio
  cantidad: number;
  valorUnitario: number; // sin IGV
  igvLinea: number;
  totalLinea: number;
}

export interface DatosEmisor {
  ruc: string;
  razonSocial: string;
  direccion: string;
  ubigeo: string;
}

export interface DatosReceptor {
  tipoDoc: "1" | "6" | "4" | "7"; // 1=DNI, 6=RUC, 4=CE, 7=PASAPORTE
  numDoc: string;
  razonSocial: string;
  direccion?: string;
  email?: string;
}

export interface ComprobanteData {
  tipo: TipoComprobante;
  serie: string; // B001, F001, etc
  correlativo: string; // 00000001
  fechaEmision: string; // YYYY-MM-DD
  moneda: "PEN" | "USD";
  emisor: DatosEmisor;
  receptor: DatosReceptor;
  lineas: LineaComprobante[];
  subtotal: number;
  igv: number;
  total: number;
  observaciones?: string;
  // Para guía de remisión
  motivoTraslado?: string;
  direccionPartida?: string;
  direccionLlegada?: string;
  transportista?: { ruc: string; razon: string };
  pesoTotal?: number;
}

// ── Conversión a UBL XML (formato SUNAT) ─────────────────────
// Implementación simplificada del UBL 2.1 requerido por SUNAT
export function buildInvoiceXml(data: ComprobanteData): string {
  const tipoDoc = data.tipo === "boleta" ? "03" : data.tipo === "factura" ? "01" : "07";
  const xmlns = data.tipo === "guia_remision"
    ? 'xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"'
    : 'xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"';

  const lineasXml = data.lineas.map((l, i) => `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${l.unidad}">${l.cantidad}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${data.moneda}">${l.totalLinea.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:PricingReference>
        <cac:AlternativeConditionPrice>
          <cbc:PriceAmount currencyID="${data.moneda}">${(l.valorUnitario * 1.18).toFixed(2)}</cbc:PriceAmount>
          <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
        </cac:AlternativeConditionPrice>
      </cac:PricingReference>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${data.moneda}">${l.igvLinea.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
          <cbc:TaxableAmount currencyID="${data.moneda}">${(l.totalLinea - l.igvLinea).toFixed(2)}</cbc:TaxableAmount>
          <cbc:TaxAmount currencyID="${data.moneda}">${l.igvLinea.toFixed(2)}</cbc:TaxAmount>
          <cac:TaxCategory>
            <cbc:ID>S</cbc:ID>
            <cbc:Percent>18</cbc:Percent>
            <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>
            <cac:TaxScheme>
              <cbc:ID>1000</cbc:ID>
              <cbc:Name>IGV</cbc:Name>
              <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
            </cac:TaxScheme>
          </cac:TaxCategory>
        </cac:TaxSubtotal>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Description>${escapeXml(l.descripcion)}</cbc:Description>
        <cac:SellersItemIdentification>
          <cbc:ID>${escapeXml(l.codigo)}</cbc:ID>
        </cac:SellersItemIdentification>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${data.moneda}">${l.valorUnitario.toFixed(6)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice ${xmlns}
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${data.serie}-${data.correlativo}</cbc:ID>
  <cbc:IssueDate>${data.fechaEmision}</cbc:IssueDate>
  <cbc:InvoiceTypeCode listID="${tipoDoc}">${tipoDoc}</cbc:InvoiceTypeCode>
  <cbc:Note languageLocaleID="1000"><![CDATA[${numToLetras(data.total, data.moneda)}]]></cbc:Note>
  <cbc:DocumentCurrencyCode>${data.moneda}</cbc:DocumentCurrencyCode>
  <cac:Signature>
    <cbc:ID>IDSignKG</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${data.emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name><![CDATA[${data.emisor.razonSocial}]]></cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#SignatureKG</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${data.emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${data.emisor.razonSocial}]]></cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:ID>${data.emisor.ubigeo}</cbc:ID>
          <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
          <cbc:CityName>LIMA</cbc:CityName>
          <cbc:CountrySubentity>LIMA</cbc:CountrySubentity>
          <cbc:District>LIMA</cbc:District>
          <cac:AddressLine>
            <cbc:Line><![CDATA[${data.emisor.direccion}]]></cbc:Line>
          </cac:AddressLine>
          <cac:Country>
            <cbc:IdentificationCode>PE</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${data.receptor.tipoDoc}">${data.receptor.numDoc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName><![CDATA[${data.receptor.razonSocial}]]></cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${data.moneda}">${data.igv.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${data.moneda}">${data.subtotal.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${data.moneda}">${data.igv.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${data.moneda}">${data.subtotal.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="${data.moneda}">${data.total.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${data.moneda}">${data.total.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${lineasXml}
</Invoice>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Convierte número a letras para la nota del XML (simplificado)
function numToLetras(n: number, moneda: string): string {
  const entero = Math.floor(n);
  const dec = Math.round((n - entero) * 100);
  const currency = moneda === "PEN" ? "SOLES" : "DÓLARES";
  return `SON ${entero} ${currency} CON ${String(dec).padStart(2, "0")}/100`;
}

// ── Cliente Supabase storage para comprobantes ───────────────
// Los XML se guardan en Supabase Storage bucket "comprobantes"
export const BUCKET = "comprobantes";
