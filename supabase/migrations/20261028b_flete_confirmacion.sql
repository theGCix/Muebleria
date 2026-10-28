-- Confirmación del flete a provincias (cotizar → cliente acepta → pago → despacho).
-- Requiere haber ejecutado antes 20261028_envio_nacional.sql

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS envio_final        NUMERIC(12,2) CHECK (envio_final IS NULL OR envio_final > 0),
  ADD COLUMN IF NOT EXISTS envio_modo_pago    TEXT CHECK (envio_modo_pago IN ('transferencia', 'destino')),
  ADD COLUMN IF NOT EXISTS envio_cotizado_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS envio_aceptado_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS envio_pagado_at    TIMESTAMPTZ;

-- Estados: por_confirmar / por_cotizar (pendiente de ventas) → cotizado (ventas fijó el monto)
--          → aceptado (el cliente aceptó) → pagado (ventas verificó el pago). 'confirmado' = Lima/recojo.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_envio_estado_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_envio_estado_check
  CHECK (envio_estado IN ('confirmado', 'por_confirmar', 'por_cotizar', 'cotizado', 'aceptado', 'pagado'));

-- El CLIENTE solo puede aceptar la cotización de SU pedido, y solo si está en estado 'cotizado'.
-- (No tiene permiso de UPDATE sobre orders: pasa por esta función.)
CREATE OR REPLACE FUNCTION public.aceptar_flete_provincia(_order_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.orders
     SET envio_estado = 'aceptado', envio_aceptado_at = now()
   WHERE id = _order_id
     AND user_id = auth.uid()
     AND envio_estado = 'cotizado'
     AND envio_final IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se puede aceptar: pedido no encontrado o sin cotización vigente';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.aceptar_flete_provincia(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aceptar_flete_provincia(UUID) TO authenticated;

-- Protección para G&M: un pedido a provincia no puede pasar a 'enviado' / 'entregado'
-- hasta que el flete esté pagado, o aceptado con pago en destino.
CREATE OR REPLACE FUNCTION public.fn_bloquear_despacho_sin_flete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('enviado', 'entregado')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.provincia IS NOT NULL
     AND COALESCE(NEW.metodo_entrega, 'domicilio') = 'domicilio'
     AND NOT (NEW.envio_estado = 'pagado'
              OR (NEW.envio_estado = 'aceptado' AND NEW.envio_modo_pago = 'destino')) THEN
    RAISE EXCEPTION 'Pedido a provincia: el flete aún no está aceptado/pagado por el cliente (estado del flete: %)', NEW.envio_estado;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bloquear_despacho_sin_flete ON public.orders;
CREATE TRIGGER trg_bloquear_despacho_sin_flete
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_bloquear_despacho_sin_flete();
