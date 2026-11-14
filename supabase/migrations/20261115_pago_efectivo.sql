-- ════════════════════════════════════════════════════════════════
-- Parte 8.4 — Pago en efectivo (recojo en tienda y contra entrega en Lima)
--
--  · Recojo en tienda + efectivo: el pedido nace «pendiente», sin cobro y SIN reservar stock.
--    Ventas lo confirma (confirmar_pedido_efectivo) → se reserva stock (procesar_pago_pedido).
--    El cobro se registra al recoger (registrar_cobro_pedido) → pasa a «pagado».
--  · Delivery Lima + efectivo (contra entrega): se paga ONLINE un adelanto (Niubiz); el pedido nace
--    «pagado» con saldo pendiente, que se cobra al entregar (registrar_cobro_pedido).
--
-- Antes de desplegar el servidor con este cambio, aplicar esta migración (el servidor ya escribe
-- metodo_pago y monto_pagado en cada pedido nuevo).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS metodo_pago      text,
  ADD COLUMN IF NOT EXISTS monto_pagado     numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmado_at    timestamptz,
  ADD COLUMN IF NOT EXISTS saldo_cobrado_at timestamptz;

COMMENT ON COLUMN public.orders.metodo_pago      IS 'tarjeta | yape_plin | efectivo (NULL en pedidos anteriores a la Parte 8.4)';
COMMENT ON COLUMN public.orders.monto_pagado     IS 'Dinero ya cobrado del pedido. Saldo pendiente = total - monto_pagado';
COMMENT ON COLUMN public.orders.confirmado_at    IS 'Pedidos en efectivo: cuándo ventas lo confirmó (y se reservó el stock)';
COMMENT ON COLUMN public.orders.saldo_cobrado_at IS 'Cuándo se completó el cobro (monto_pagado >= total)';

-- Pedidos ya cobrados antes de esta parte: se pagaron completos con tarjeta (Niubiz).
UPDATE public.orders
   SET monto_pagado     = total,
       metodo_pago      = COALESCE(metodo_pago, 'tarjeta'),
       saldo_cobrado_at = COALESCE(saldo_cobrado_at, paid_at, created_at)
 WHERE status NOT IN ('pendiente', 'cancelado')
   AND monto_pagado = 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_metodo_pago_check') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_metodo_pago_check
      CHECK (metodo_pago IS NULL OR metodo_pago IN ('tarjeta', 'yape_plin', 'efectivo'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_monto_pagado_check') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_monto_pagado_check
      CHECK (monto_pagado >= 0 AND monto_pagado <= total);
  END IF;
END $$;

-- Pedidos en efectivo que esperan confirmación / cobro (panel de ventas)
CREATE INDEX IF NOT EXISTS idx_orders_efectivo_por_cobrar
  ON public.orders (created_at DESC)
  WHERE metodo_pago = 'efectivo' AND saldo_cobrado_at IS NULL AND status <> 'cancelado';

-- ── Ventas confirma un pedido en efectivo (recojo): reserva el stock ─────────────
CREATE OR REPLACE FUNCTION public.confirmar_pedido_efectivo(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _o   public.orders;
  _r   jsonb;
BEGIN
  IF NOT (public.has_role(_uid, 'admin') OR public.has_role(_uid, 'vendedor')) THEN
    RAISE EXCEPTION 'Sin permisos para confirmar pedidos';
  END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;

  IF _o.metodo_pago IS DISTINCT FROM 'efectivo' THEN
    RAISE EXCEPTION 'Solo se confirman pedidos con pago en efectivo';
  END IF;
  IF _o.status <> 'pendiente' THEN
    RAISE EXCEPTION 'El pedido ya no está pendiente (estado: %)', _o.status;
  END IF;
  IF _o.confirmado_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'ya_confirmado', true);
  END IF;

  UPDATE public.orders SET confirmado_at = now(), updated_at = now() WHERE id = _order_id;
  _r := public.procesar_pago_pedido(_order_id);   -- reserva stock, backorder y despachos (idempotente)

  RETURN jsonb_build_object('ok', true, 'procesado', _r);
END;
$$;

-- ── Ventas registra un cobro en efectivo (al recoger o contra entrega) ───────────
CREATE OR REPLACE FUNCTION public.registrar_cobro_pedido(_order_id uuid, _monto numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid   uuid := auth.uid();
  _o     public.orders;
  _nuevo numeric(12,2);
BEGIN
  IF NOT (public.has_role(_uid, 'admin') OR public.has_role(_uid, 'vendedor')) THEN
    RAISE EXCEPTION 'Sin permisos para registrar cobros';
  END IF;
  IF _monto IS NULL OR _monto <= 0 THEN
    RAISE EXCEPTION 'El monto del cobro debe ser mayor a cero';
  END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;

  IF _o.metodo_pago IS DISTINCT FROM 'efectivo' THEN
    RAISE EXCEPTION 'Solo se registran cobros en pedidos con pago en efectivo';
  END IF;
  IF _o.status = 'cancelado' THEN
    RAISE EXCEPTION 'El pedido está cancelado';
  END IF;

  _nuevo := round(_o.monto_pagado + _monto, 2);
  IF _nuevo > _o.total THEN
    RAISE EXCEPTION 'El cobro supera el saldo pendiente (S/ %)', round(_o.total - _o.monto_pagado, 2);
  END IF;

  UPDATE public.orders
     SET monto_pagado     = _nuevo,
         saldo_cobrado_at = CASE WHEN _nuevo >= total THEN now() ELSE saldo_cobrado_at END,
         status           = CASE WHEN status = 'pendiente' THEN 'pagado'::public.order_status ELSE status END,
         paid_at          = CASE WHEN status = 'pendiente' THEN now() ELSE paid_at END,
         confirmado_at    = COALESCE(confirmado_at, now()),
         updated_at       = now()
   WHERE id = _order_id;

  -- Cobro de un pedido que seguía «pendiente» (recojo): si nadie lo había confirmado, reserva el stock ahora.
  IF _o.status = 'pendiente' AND _o.confirmado_at IS NULL THEN
    PERFORM public.procesar_pago_pedido(_order_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'monto_pagado', _nuevo, 'saldo', round(_o.total - _nuevo, 2));
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_pedido_efectivo(uuid)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_cobro_pedido(uuid, numeric)  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirmar_pedido_efectivo(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_cobro_pedido(uuid, numeric) TO authenticated;
