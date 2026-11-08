-- ============================================================
-- F8 · Fabricar (MRP) — operación atómica
--
-- Antes: el cliente hacía 4 inserts sueltos (orders, produccion, order_items,
-- insumo_movimientos); si uno fallaba quedaban datos a medias y al reintentar
-- se duplicaba la orden.
--
-- Ahora: una sola función, una sola transacción.
--  · SECURITY INVOKER → se aplica el RLS del usuario que llama (igual que antes).
--  · No crea tablas, columnas ni políticas. No cambia permisos de tablas.
--  · Idempotente: si ya existe una orden con el mismo _order_number devuelve esa
--    orden (duplicado = true) y NO vuelve a descontar stock.
--  · Serializa las llamadas (advisory lock), bloquea las filas de insumos (FOR UPDATE) y rechaza la operación si algún
--    insumo no alcanza: así el movimiento registrado siempre coincide con el
--    descuento real (el trigger actualizar_stock_insumo recorta en 0).
-- ============================================================

CREATE OR REPLACE FUNCTION public.fabricar_mrp(
  _order_number        TEXT,
  _descripcion         TEXT,
  _insumos             JSONB,          -- [{"insumo_id": "<uuid>", "cantidad": 1.5}, ...]
  _carpintero_id       UUID    DEFAULT NULL,
  _observaciones       TEXT    DEFAULT NULL,
  _fecha_fin_estimada  DATE    DEFAULT NULL,
  _prioridad           INTEGER DEFAULT 2
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _user_id    UUID := auth.uid();
  _notas      TEXT := '[MRP] ' || COALESCE(_descripcion, '');
  _order_id   UUID;
  _prod_id    UUID;
  _existente  RECORD;
  _item       RECORD;
  _items      JSONB;
  _problemas  TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Sesión no válida';
  END IF;
  IF COALESCE(btrim(_order_number), '') = '' OR COALESCE(btrim(_descripcion), '') = '' THEN
    RAISE EXCEPTION 'Faltan datos de la orden';
  END IF;
  IF _insumos IS NULL OR jsonb_typeof(_insumos) <> 'array' OR jsonb_array_length(_insumos) = 0 THEN
    RAISE EXCEPTION 'No hay insumos para descontar';
  END IF;
  IF COALESCE(_prioridad, 2) NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'Prioridad inválida';
  END IF;

  -- Serializa las fabricaciones (no requiere permisos): evita que dos llamadas
  -- simultáneas comprueben el mismo stock a la vez, aunque el RLS impida bloquear filas.
  PERFORM pg_advisory_xact_lock(hashtext('fabricar_mrp'));

  -- 1. Idempotencia: la misma clave no se procesa dos veces
  SELECT o.id, o.notas, p.id AS produccion_id
    INTO _existente
    FROM public.orders o
    LEFT JOIN public.produccion p ON p.order_id = o.id
   WHERE o.order_number = _order_number;
  IF FOUND THEN
    IF _existente.notas IS DISTINCT FROM _notas THEN
      RAISE EXCEPTION 'El número de orden % ya está en uso por otra orden', _order_number;
    END IF;
    RETURN jsonb_build_object(
      'ok', true, 'duplicado', true,
      'order_id', _existente.id, 'order_number', _order_number,
      'produccion_id', _existente.produccion_id
    );
  END IF;

  -- 2. Validar y consolidar insumos (un mismo insumo repetido se suma)
  SELECT jsonb_agg(jsonb_build_object('insumo_id', t.insumo_id, 'cantidad', t.cantidad))
    INTO _items
    FROM (
      SELECT (e->>'insumo_id')::uuid AS insumo_id,
             SUM((e->>'cantidad')::numeric) AS cantidad
        FROM jsonb_array_elements(_insumos) AS e
       GROUP BY 1
    ) t;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(_items) AS f(insumo_id uuid, cantidad numeric)
     WHERE f.insumo_id IS NULL OR f.cantidad IS NULL OR f.cantidad <= 0
  ) THEN
    RAISE EXCEPTION 'Datos inválidos en los insumos';
  END IF;

  -- 3. Bloquear filas de insumos (orden fijo → sin interbloqueos) y comprobar stock
  PERFORM 1
     FROM public.insumos i
    WHERE i.id IN (SELECT f.insumo_id FROM jsonb_to_recordset(_items) AS f(insumo_id uuid, cantidad numeric))
    ORDER BY i.id
      FOR UPDATE;

  SELECT string_agg(f.insumo_id::text, ', ')
    INTO _problemas
    FROM jsonb_to_recordset(_items) AS f(insumo_id uuid, cantidad numeric)
    LEFT JOIN public.insumos i ON i.id = f.insumo_id
   WHERE i.id IS NULL;

  IF _problemas IS NOT NULL THEN
    RAISE EXCEPTION 'Insumo no encontrado o sin acceso: %', _problemas;
  END IF;

  SELECT string_agg(format('%s (necesita %s, hay %s %s)', i.nombre, f.cantidad, i.stock_actual, i.unidad), '; ')
    INTO _problemas
    FROM jsonb_to_recordset(_items) AS f(insumo_id uuid, cantidad numeric)
    JOIN public.insumos i ON i.id = f.insumo_id
   WHERE i.stock_actual < f.cantidad;

  IF _problemas IS NOT NULL THEN
    RAISE EXCEPTION 'Stock insuficiente: %', _problemas;
  END IF;

  -- 4. Orden interna (misma forma que antes). Si otra llamada con la misma clave
  --    ganó la carrera, devolvemos esa orden.
  INSERT INTO public.orders (order_number, status, nombre, email, subtotal, envio, total, notas)
  VALUES (_order_number, 'pendiente', 'Producción interna', 'produccion@interno', 0, 0, 0, _notas)
  ON CONFLICT (order_number) DO NOTHING
  RETURNING id INTO _order_id;

  IF _order_id IS NULL THEN
    SELECT o.id, o.notas, p.id AS produccion_id
      INTO _existente
      FROM public.orders o
      LEFT JOIN public.produccion p ON p.order_id = o.id
     WHERE o.order_number = _order_number;
    IF NOT FOUND OR _existente.notas IS DISTINCT FROM _notas THEN
      RAISE EXCEPTION 'No se pudo registrar la orden %', _order_number;
    END IF;
    RETURN jsonb_build_object(
      'ok', true, 'duplicado', true,
      'order_id', _existente.id, 'order_number', _order_number,
      'produccion_id', _existente.produccion_id
    );
  END IF;

  -- 5. Producción
  INSERT INTO public.produccion
    (order_id, asignado_a, observaciones, fecha_fin_estimada, prioridad, status, fecha_inicio)
  VALUES
    (_order_id, _carpintero_id, _observaciones, _fecha_fin_estimada, COALESCE(_prioridad, 2), 'pendiente', CURRENT_DATE)
  RETURNING id INTO _prod_id;

  -- 6. El mueble a fabricar (una fila = un mueble)
  INSERT INTO public.order_items (order_id, sku, title, qty, unit_price, total)
  VALUES (_order_id, NULL, _descripcion, 1, 0, 0);

  -- 7. Salida de insumos (el trigger actualizar_stock_insumo descuenta el stock)
  FOR _item IN
    SELECT f.insumo_id, f.cantidad
      FROM jsonb_to_recordset(_items) AS f(insumo_id uuid, cantidad numeric)
     ORDER BY f.insumo_id
  LOOP
    INSERT INTO public.insumo_movimientos
      (insumo_id, tipo, cantidad, motivo, referencia, registrado_por)
    VALUES
      (_item.insumo_id, 'salida', _item.cantidad, 'Fabricación MRP: ' || _descripcion, _order_number, _user_id);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'duplicado', false,
    'order_id', _order_id, 'order_number', _order_number,
    'produccion_id', _prod_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fabricar_mrp(TEXT, TEXT, JSONB, UUID, TEXT, DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fabricar_mrp(TEXT, TEXT, JSONB, UUID, TEXT, DATE, INTEGER) TO authenticated;
