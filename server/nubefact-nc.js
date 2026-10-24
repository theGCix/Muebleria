// server/nubefact-nc.js
// ════════════════════════════════════════════════════════════════
// NOTA DE CRÉDITO ELECTRÓNICA (Nubefact / SUNAT) para devoluciones
//
// Cómo conectarlo en server/index.js (2 líneas):
//   1) arriba, con los otros imports:
//        import { registerNotaCreditoRoutes } from "./nubefact-nc.js";
//   2) justo antes de `const PORT = ...` / app.listen():
//        registerNotaCreditoRoutes({ app, supabaseAdmin, requireAuth, getNubefactBase });
//
// Variables de entorno (opcionales; estos son los valores por defecto):
//   NUBEFACT_SERIE_NC_BOLETA  = BBB1   (serie de NC que modifica boletas)
//   NUBEFACT_SERIE_NC_FACTURA = FFF1   (serie de NC que modifica facturas)
// Las series deben estar registradas en tu cuenta de Nubefact.
// ════════════════════════════════════════════════════════════════

const MOTIVOS = {
  producto_defectuoso: "producto defectuoso",
  dano_en_transporte: "daño en el transporte",
  no_conforme: "producto no conforme",
  arrepentimiento: "cambio de decisión del cliente",
  error_de_pedido: "error en el pedido",
  otro: "otro motivo",
};

const TIPO_DOC = { DNI: 1, RUC: 6, CE: 4, PASAPORTE: 7 };

function fechaLima() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(new Date()).replace(/\//g, "-"); // dd-mm-yyyy
}

export function registerNotaCreditoRoutes({ app, supabaseAdmin, requireAuth, getNubefactBase }) {
  // POST /api/nubefact/nota-credito   Body: { devolucion_id }
  app.post("/api/nubefact/nota-credito", requireAuth, async (req, res) => {
    try {
      const { devolucion_id } = req.body ?? {};
      if (!devolucion_id) return res.status(400).json({ error: "devolucion_id requerido" });

      // 1. Solo admin o vendedor
      const { data: roles } = await supabaseAdmin
        .from("user_roles").select("role").eq("user_id", req.user.id);
      if (!(roles ?? []).some((r) => r.role === "admin" || r.role === "vendedor")) {
        return res.status(403).json({ error: "Sin permisos" });
      }

      // 2. Devolución + ítems + venta original + cliente
      const { data: dev, error: devErr } = await supabaseAdmin
        .from("devoluciones")
        .select(`
          id, numero, estado, total, motivo, detalle, nc_estado, nc_serie, nc_numero,
          devolucion_items ( sku, title, qty, unit_price ),
          sales ( numero, tipo, subtotal, igv, total,
                  customers ( doc_tipo, doc_numero, nombre, email, direccion ) )
        `)
        .eq("id", devolucion_id)
        .single();
      if (devErr || !dev) return res.status(404).json({ error: "Devolución no encontrada" });

      if (dev.estado !== "registrada") {
        return res.status(409).json({ error: "La devolución está anulada" });
      }
      if (dev.nc_estado === "aceptado") {
        return res.status(409).json({ error: "La nota de crédito ya fue aceptada por SUNAT" });
      }
      if (dev.nc_estado === "no_aplica") {
        return res.status(409).json({
          error: "Esta devolución no lleva nota de crédito (la venta no fue emitida y aceptada por SUNAT)",
        });
      }

      const sale = dev.sales;
      const cliente = sale?.customers;
      const esFactura = sale.tipo === "factura";
      const serie = esFactura
        ? (process.env.NUBEFACT_SERIE_NC_FACTURA || "FFF1")
        : (process.env.NUBEFACT_SERIE_NC_BOLETA || "BBB1");

      // 3. Correlativo: se reutiliza solo si el intento anterior no llegó a registrarse (error)
      let numero = dev.nc_numero;
      if (!(dev.nc_estado === "error" && dev.nc_serie === serie && numero)) {
        const { data: n, error: nErr } = await supabaseAdmin.rpc("next_nc_numero", { _serie: serie });
        if (nErr) return res.status(500).json({ error: nErr.message });
        numero = n;
      }
      await supabaseAdmin.from("devoluciones")
        .update({ nc_serie: serie, nc_numero: numero }).eq("id", dev.id);

      // 4. Comprobante que se modifica
      const [serieOrig, corrOrig] = String(sale.numero).split("-");

      // 5. Ítems (misma matemática que /api/nubefact/emitir)
      const items = (dev.devolucion_items ?? []).map((it) => {
        const valorUnit = parseFloat((it.unit_price / 1.18).toFixed(6));
        const subtotal = parseFloat((valorUnit * it.qty).toFixed(2));
        const igvLinea = parseFloat((subtotal * 0.18).toFixed(2));
        return {
          unidad_de_medida: "NIU",
          codigo: it.sku ?? "PROD",
          descripcion: it.title,
          cantidad: it.qty,
          valor_unitario: valorUnit,
          precio_unitario: parseFloat(Number(it.unit_price).toFixed(6)),
          descuento: 0,
          subtotal,
          tipo_de_igv: 1,
          igv: igvLinea,
          total: parseFloat((subtotal + igvLinea).toFixed(2)),
          anticipo_regularizacion: false,
          anticipo_documento_serie: "",
          anticipo_documento_numero: 0,
        };
      });

      const total = parseFloat(dev.total);
      const gravada = parseFloat((total / 1.18).toFixed(2));
      const igv = parseFloat((total - gravada).toFixed(2));
      const esTotal = total >= parseFloat(sale.total);

      const payload = {
        operacion: "generar_comprobante",
        tipo_de_comprobante: 3, // nota de crédito
        serie,
        numero,
        sunat_transaction: 1,
        cliente_tipo_de_documento: TIPO_DOC[cliente?.doc_tipo] ?? 1,
        cliente_numero_de_documento: cliente?.doc_numero ?? "00000000",
        cliente_denominacion: cliente?.nombre ?? "Cliente varios",
        cliente_direccion: cliente?.direccion ?? "",
        cliente_email: cliente?.email ?? "",
        fecha_de_emision: fechaLima(),
        moneda: 1,
        tipo_de_cambio: 0,
        porcentaje_de_igv: 18,
        descuento_global: 0,
        total_descuento: 0,
        total_anticipo: 0,
        total_gravada: gravada,
        total_inafecta: 0,
        total_exonerada: 0,
        total_igv: igv,
        total_gratuita: 0,
        total_otros_cargos: 0,
        total,
        observaciones: `Devolución ${dev.numero}: ${MOTIVOS[dev.motivo] ?? dev.motivo}${dev.detalle ? ` — ${dev.detalle}` : ""}`.slice(0, 250),
        documento_que_se_modifica_tipo: esFactura ? 1 : 2,
        documento_que_se_modifica_serie: serieOrig,
        documento_que_se_modifica_numero: parseInt(corrOrig, 10),
        tipo_de_nota_de_credito: esTotal ? 6 : 7, // 6 = devolución total, 7 = devolución por ítem
        enviar_automaticamente_a_la_sunat: true,
        enviar_automaticamente_al_cliente: !!cliente?.email,
        items,
      };

      // 6. Enviar a Nubefact
      let json;
      try {
        const nfRes = await fetch(
          `${getNubefactBase()}/${process.env.NUBEFACT_RUC}/comprobantes/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Token ${process.env.NUBEFACT_TOKEN}`,
            },
            body: JSON.stringify(payload),
          },
        );
        json = await nfRes.json();
        if (!nfRes.ok) {
          const msg = json.errors
            ? Object.entries(json.errors).map(([k, v]) => `${k}: ${[].concat(v).join(", ")}`).join(" | ")
            : JSON.stringify(json);
          await supabaseAdmin.from("devoluciones")
            .update({ nc_estado: "error", nc_error: msg }).eq("id", dev.id);
          return res.status(502).json({ error: msg });
        }
      } catch (err) {
        await supabaseAdmin.from("devoluciones")
          .update({ nc_estado: "error", nc_error: err.message }).eq("id", dev.id);
        return res.status(502).json({ error: err.message });
      }

      // 7. Guardar resultado
      const aceptado = !!json.aceptado_por_sunat;
      await supabaseAdmin.from("devoluciones").update({
        nc_estado: aceptado ? "aceptado" : "rechazado",
        nc_enlace: json.enlace_del_pdf ?? null,
        nc_xml: json.enlace_del_xml ?? null,
        nc_cdr: json.enlace_del_cdr ?? null,
        nc_hash: json.codigo_hash ?? null,
        nc_error: aceptado ? null : (json.sunat_description ?? "Rechazada por SUNAT"),
      }).eq("id", dev.id);

      return res.json({
        aceptado,
        enlace_pdf: json.enlace_del_pdf ?? null,
        descripcion: json.sunat_description ?? "",
        serie,
        numero,
      });
    } catch (err) {
      console.error("⚠️ Error emitiendo nota de crédito:", err);
      return res.status(500).json({ error: err.message ?? "Error interno" });
    }
  });
}
