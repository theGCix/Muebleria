-- Paso "En agencia" para pedidos a provincia (sin tocar el tipo order_status).
-- El pedido sigue en status = 'enviado'; "En agencia" es un sub-estado que se activa al registrar
-- la llegada (agencia_llegada_at). Así no cambia la validación de transiciones ni las notificaciones.
-- Requiere haber ejecutado antes 20261028b_flete_confirmacion.sql

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS agencia_preferida  TEXT,         -- la que elige el cliente (su agencia de confianza)
  ADD COLUMN IF NOT EXISTS agencia_nombre     TEXT,         -- agencia donde llegó realmente el pedido
  ADD COLUMN IF NOT EXISTS agencia_direccion  TEXT,
  ADD COLUMN IF NOT EXISTS agencia_guia       TEXT,         -- número de guía / seguimiento
  ADD COLUMN IF NOT EXISTS agencia_clave      TEXT,         -- clave de recojo (si la agencia la usa)
  ADD COLUMN IF NOT EXISTS agencia_llegada_at TIMESTAMPTZ;

-- El CLIENTE elige (o cambia) su agencia de confianza mientras el pedido aún no sale.
CREATE OR REPLACE FUNCTION public.elegir_agencia_cliente(_order_id UUID, _agencia TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _txt TEXT := NULLIF(btrim(_agencia), '');
BEGIN
  IF _txt IS NOT NULL AND char_length(_txt) > 120 THEN
    RAISE EXCEPTION 'El nombre de la agencia es demasiado largo';
  END IF;

  UPDATE public.orders
     SET agencia_preferida = _txt
   WHERE id = _order_id
     AND user_id = auth.uid()
     AND provincia IS NOT NULL
     AND COALESCE(metodo_entrega, 'domicilio') = 'domicilio'
     AND status NOT IN ('enviado', 'entregado', 'cancelado');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se puede elegir la agencia: pedido no encontrado o ya despachado';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.elegir_agencia_cliente(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.elegir_agencia_cliente(UUID, TEXT) TO authenticated;

-- El EQUIPO registra la llegada a la agencia (solo pedidos a provincia ya 'enviado').
CREATE OR REPLACE FUNCTION public.marcar_en_agencia(
  _order_id UUID, _agencia TEXT, _direccion TEXT, _guia TEXT, _clave TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor')) THEN
    RAISE EXCEPTION 'Sin permisos para registrar la llegada a la agencia';
  END IF;
  IF NULLIF(btrim(_agencia), '') IS NULL OR NULLIF(btrim(_guia), '') IS NULL THEN
    RAISE EXCEPTION 'Indica la agencia y el número de guía';
  END IF;

  UPDATE public.orders
     SET agencia_nombre     = btrim(_agencia),
         agencia_direccion  = NULLIF(btrim(_direccion), ''),
         agencia_guia       = btrim(_guia),
         agencia_clave      = NULLIF(btrim(_clave), ''),
         agencia_llegada_at = COALESCE(agencia_llegada_at, now()),
         updated_at         = now()
   WHERE id = _order_id
     AND status = 'enviado'
     AND provincia IS NOT NULL
     AND COALESCE(metodo_entrega, 'domicilio') = 'domicilio';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solo se puede registrar la agencia en pedidos a provincia que estén "En camino"';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.marcar_en_agencia(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_en_agencia(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
