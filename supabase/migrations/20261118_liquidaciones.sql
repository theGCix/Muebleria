-- ════════════════════════════════════════════════════════════════
-- Liquidación — banners del home por categoría (admin: Catálogo → Liquidación)
--
--  · Cada fila enlaza un producto con un banner (foto de fondo, textos, envío, regalo de cojines).
--  · El PRECIO REAL sigue siendo el de products (descuento_porcentaje): al guardar una liquidación el descuento
--    se aplica al producto en la misma transacción y REEMPLAZA a la oferta que tuviera (oferta_vence_el = NULL).
--    El banner lee el precio del producto, así que nunca queda desactualizado.
--  · Al quitar la liquidación se retira el descuento del producto, pero solo si sigue siendo el que ella aplicó
--    (si alguien lo cambió luego desde Productos, no se toca).
--  · Las escrituras van SOLO por las funciones guardar_liquidacion / quitar_liquidacion (solo admin).
--  · envio_tipo / envio_descuento: hoy solo se muestran en el banner; el cobro del envío NO cambia (server/pagos.js).
-- No ejecutar sin confirmación del dueño (regla 10).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.liquidaciones (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria          text NOT NULL,
  product_id         uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  imagen_url         text NOT NULL,
  kicker             text,
  nombre             text NOT NULL,
  detalle            text,
  descuento_aplicado integer NOT NULL CHECK (descuento_aplicado BETWEEN 1 AND 90),
  envio_tipo         text NOT NULL DEFAULT 'ninguno' CHECK (envio_tipo IN ('ninguno', 'gratis', 'descuento')),
  envio_descuento    numeric(10,2) CHECK (envio_descuento IS NULL OR envio_descuento > 0),
  regalo_cojines     boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT liquidaciones_envio_descuento_chk CHECK (envio_tipo <> 'descuento' OR envio_descuento IS NOT NULL)
);

-- Un producto solo puede estar una vez en liquidación
CREATE UNIQUE INDEX IF NOT EXISTS liquidaciones_product_uk ON public.liquidaciones (product_id);
CREATE INDEX IF NOT EXISTS liquidaciones_categoria_idx ON public.liquidaciones (categoria, created_at DESC);

ALTER TABLE public.liquidaciones ENABLE ROW LEVEL SECURITY;

-- Lectura pública (el home); sin políticas de INSERT/UPDATE/DELETE: se escribe solo con las funciones de abajo.
DROP POLICY IF EXISTS "liquidaciones_select_publico" ON public.liquidaciones;
CREATE POLICY "liquidaciones_select_publico" ON public.liquidaciones
  FOR SELECT TO anon, authenticated USING (true);

-- ── Guardar (crear o editar) ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guardar_liquidacion(_datos jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id    uuid    := NULLIF(_datos->>'id', '')::uuid;
  _pid   uuid    := NULLIF(_datos->>'product_id', '')::uuid;
  _desc  integer := NULLIF(_datos->>'descuento', '')::integer;
  _tipo  text    := COALESCE(NULLIF(_datos->>'envio_tipo', ''), 'ninguno');
  _envio numeric := NULLIF(_datos->>'envio_descuento', '')::numeric;
  _cat   text    := btrim(COALESCE(_datos->>'categoria', ''));
  _img   text    := btrim(COALESCE(_datos->>'imagen_url', ''));
  _nom   text    := btrim(COALESCE(_datos->>'nombre', ''));
  _viejo public.liquidaciones%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede gestionar liquidaciones' USING ERRCODE = '42501';
  END IF;
  IF _pid IS NULL THEN RAISE EXCEPTION 'Elige un producto'; END IF;
  IF _cat = '' THEN RAISE EXCEPTION 'Elige una categoría'; END IF;
  IF _img !~* '^https://' THEN RAISE EXCEPTION 'Sube la imagen de fondo'; END IF;
  IF _nom = '' THEN RAISE EXCEPTION 'Escribe el nombre que irá en el banner'; END IF;
  IF _desc IS NULL OR _desc < 1 OR _desc > 90 THEN RAISE EXCEPTION 'El descuento debe estar entre 1 y 90 %%'; END IF;
  IF _tipo NOT IN ('ninguno', 'gratis', 'descuento') THEN RAISE EXCEPTION 'Tipo de envío no válido'; END IF;
  IF _tipo = 'descuento' AND (_envio IS NULL OR _envio <= 0) THEN RAISE EXCEPTION 'Indica cuántos soles se descuentan del envío'; END IF;
  IF _tipo <> 'descuento' THEN _envio := NULL; END IF;

  -- Bloquea el producto mientras se cambia su precio
  PERFORM 1 FROM public.products WHERE id = _pid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El producto no existe'; END IF;

  IF EXISTS (SELECT 1 FROM public.liquidaciones WHERE product_id = _pid AND id IS DISTINCT FROM _id) THEN
    RAISE EXCEPTION 'Ese producto ya está en liquidación';
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.liquidaciones
      (categoria, product_id, imagen_url, kicker, nombre, detalle, descuento_aplicado, envio_tipo, envio_descuento, regalo_cojines)
    VALUES
      (_cat, _pid, _img, NULLIF(btrim(COALESCE(_datos->>'kicker', '')), ''), _nom,
       NULLIF(btrim(COALESCE(_datos->>'detalle', '')), ''), _desc, _tipo, _envio,
       COALESCE((_datos->>'regalo_cojines')::boolean, false))
    RETURNING id INTO _id;
  ELSE
    SELECT * INTO _viejo FROM public.liquidaciones WHERE id = _id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La liquidación no existe'; END IF;
    -- Si cambió de producto, el anterior vuelve a su precio normal (solo si conserva el descuento que puso esta liquidación)
    IF _viejo.product_id <> _pid THEN
      UPDATE public.products SET descuento_porcentaje = NULL, oferta_vence_el = NULL
       WHERE id = _viejo.product_id AND descuento_porcentaje = _viejo.descuento_aplicado;
    END IF;
    UPDATE public.liquidaciones SET
      categoria = _cat, product_id = _pid, imagen_url = _img,
      kicker = NULLIF(btrim(COALESCE(_datos->>'kicker', '')), ''), nombre = _nom,
      detalle = NULLIF(btrim(COALESCE(_datos->>'detalle', '')), ''),
      descuento_aplicado = _desc, envio_tipo = _tipo, envio_descuento = _envio,
      regalo_cojines = COALESCE((_datos->>'regalo_cojines')::boolean, false), updated_at = now()
    WHERE id = _id;
  END IF;

  -- La liquidación reemplaza a la oferta: mismo mecanismo de precio que ya cobra el servidor
  UPDATE public.products SET descuento_porcentaje = _desc, oferta_vence_el = NULL WHERE id = _pid;
  RETURN _id;
END;
$$;

-- ── Quitar ───────────────────────────────────────────────────────────────────────
-- Devuelve true si también se retiró el descuento del producto.
CREATE OR REPLACE FUNCTION public.quitar_liquidacion(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _liq public.liquidaciones%ROWTYPE;
  _n   integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede gestionar liquidaciones' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _liq FROM public.liquidaciones WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La liquidación no existe'; END IF;

  UPDATE public.products SET descuento_porcentaje = NULL, oferta_vence_el = NULL
   WHERE id = _liq.product_id AND descuento_porcentaje = _liq.descuento_aplicado;
  GET DIAGNOSTICS _n = ROW_COUNT;

  DELETE FROM public.liquidaciones WHERE id = _id;
  RETURN _n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_liquidacion(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quitar_liquidacion(uuid)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_liquidacion(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quitar_liquidacion(uuid)   TO authenticated;
