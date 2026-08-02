import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { validarCupon } from "./validarCupon";

// service_role key: SOLO en el servidor, nunca la expongas al cliente
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const cuponesRouter = Router();

// POST /api/cupones/validar
// body: { codigo, customerId, items: [{ product_id, categoria, combo_id, qty, unit_price }] }
cuponesRouter.post("/validar", async (req, res) => {
  const { codigo, customerId, items } = req.body;

  if (!codigo || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ valid: false, error: "Datos incompletos" });
  }

  const resultado = await validarCupon({
    supabase,
    codigo,
    customerId: customerId ?? null,
    items,
  });

  return res.status(resultado.valid ? 200 : 400).json(resultado);
});