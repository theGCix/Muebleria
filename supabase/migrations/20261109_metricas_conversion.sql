-- ============================================================
-- A3 · Conversión web  +  A9 · Consolidación de métricas
--
-- Reemplaza (CREATE OR REPLACE, misma firma, SECURITY DEFINER y mismo guard_staff):
--   · public.get_marketing_analytics(_desde text, _hasta text)
--   · public.get_dashboard_kpis(_desde text, _hasta text)
-- No toca tablas, políticas RLS ni permisos. get_dashboard_series NO se modifica.
--
-- RESPALDO: antes de ejecutar, guarda la definición actual de ambas funciones
--   select pg_get_functiondef(oid) from pg_proc
--    where proname in ('get_marketing_analytics','get_dashboard_kpis');
-- Para volver atrás basta con volver a ejecutar esas definiciones.
--
-- Qué cambia y por qué
--  1. Conversión web: se agregan al funnel `sesiones` (sesiones únicas = DISTINCT session_id
--     de TODOS los eventos del período) y `pedidos_pagados` (pedidos web pagados desde `orders`).
--     La conversión se calcula como pedidos_pagados / sesiones × 100. Antes dependía del evento
--     `orden_pagada` (0 eventos este mes) y de `vistas` (solo sesiones con `pagina_vista`).
--     Los campos anteriores del funnel se conservan.
--  2. «Pedido pagado» = orders.status NOT IN ('pendiente','cancelado'): es la misma definición
--     que ya usaba get_dashboard_kpis. get_marketing_analytics contaba también los pendientes
--     (sin pagar) como ventas web → Analytics y Dashboard no coincidían.
--     Se excluyen de las métricas de VENTAS las órdenes internas de fabricación
--     (orders.notas empieza con «[MRP]», total 0, creadas por «Enviar a producción»): al avanzar
--     de estado dejarían de ser «pendiente» y se contarían como pedidos online (inflarían el
--     conteo, bajarían el ticket promedio y subirían la conversión). Siguen contando en los
--     conteos de pipeline (ord_control_calidad / ord_listo_despacho / ord_enviado).
--  3. Zona horaria: get_marketing_analytics usaba medianoche UTC y get_dashboard_kpis
--     `created_at::DATE` (UTC); get_dashboard_series ya usaba America/Lima. Un pedido de
--     las 19:00–23:59 (Lima) caía en el día siguiente. Ahora los tres usan America/Lima.
--  4. get_dashboard_kpis devuelve además `ord_control_calidad`, `ord_listo_despacho`,
--     `ord_enviado` (conteos reales de orders.status) para el pipeline de Central, que
--     mostraba 0 fijo en esos tres pasos.
--  5. get_marketing_analytics deja de calcular `segmentos` (devolvía un único segmento
--     «cliente») y `top_productos` (duplica el Dashboard); la pantalla ya no los usa.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_marketing_analytics(_desde text DEFAULT NULL::text, _hasta text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_desde  TIMESTAMPTZ;
  v_hasta  TIMESTAMPTZ;   -- límite superior EXCLUSIVO (medianoche Lima del día siguiente)
  v_result JSONB;
BEGIN
  /* guard_staff */
  IF NOT (
        coalesce(auth.role(), '') = 'service_role'
     OR session_user IN ('postgres', 'supabase_admin')
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'vendedor'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  v_desde := CASE
    WHEN _desde IS NOT NULL THEN (_desde::DATE)::TIMESTAMP AT TIME ZONE 'America/Lima'
    ELSE date_trunc('month', now() AT TIME ZONE 'America/Lima') AT TIME ZONE 'America/Lima'
  END;

  v_hasta := CASE
    WHEN _hasta IS NOT NULL THEN ((_hasta::DATE) + 1)::TIMESTAMP AT TIME ZONE 'America/Lima'
    ELSE (((now() AT TIME ZONE 'America/Lima')::DATE) + 1)::TIMESTAMP AT TIME ZONE 'America/Lima'
  END;

  WITH
  pos_data AS (
    SELECT
      'POS'::TEXT                  AS canal,
      COUNT(*)::INT                AS transacciones,
      COALESCE(SUM(total), 0)     AS ingresos,
      COALESCE(AVG(total), 0)     AS ticket_promedio
    FROM public.sales
    WHERE created_at >= v_desde
      AND created_at <  v_hasta
      AND estado = 'completada'
  ),
  ec_data AS (
    SELECT
      'Ecommerce'::TEXT            AS canal,
      COUNT(*)::INT                AS transacciones,
      COALESCE(SUM(total), 0)     AS ingresos,
      COALESCE(AVG(total), 0)     AS ticket_promedio
    FROM public.orders
    WHERE created_at >= v_desde
      AND created_at <  v_hasta
      AND status NOT IN ('pendiente', 'cancelado')
      AND COALESCE(notas, '') NOT LIKE '[MRP]%'
  ),
  utm_data AS (
    SELECT
      COALESCE(utm_source, 'directo') AS fuente,
      COUNT(DISTINCT session_id)::INT AS pedidos,
      COALESCE(SUM(valor), 0)        AS ingresos
    FROM public.eventos_web
    WHERE tipo = 'orden_pagada'
      AND created_at >= v_desde
      AND created_at <  v_hasta
    GROUP BY fuente
    ORDER BY ingresos DESC
    LIMIT 10
  ),
  geo_data AS (
    SELECT
      COALESCE(distrito, 'Sin distrito') AS distrito,
      COUNT(*)::INT                      AS pedidos,
      COALESCE(SUM(total), 0)           AS ingresos
    FROM public.orders
    WHERE created_at >= v_desde
      AND created_at <  v_hasta
      AND status NOT IN ('pendiente', 'cancelado')
      AND COALESCE(notas, '') NOT LIKE '[MRP]%'
      AND distrito IS NOT NULL
    GROUP BY distrito
    ORDER BY pedidos DESC
    LIMIT 10
  ),
  cat_pos AS (
    SELECT
      COALESCE(pr.categoria, 'Sin categoría') AS categoria,
      COUNT(DISTINCT s.id)::INT               AS pedidos,
      SUM(si.qty)::INT                        AS unidades,
      SUM(si.total)                           AS ingresos
    FROM public.sale_items si
    JOIN public.sales       s  ON s.id  = si.sale_id
    LEFT JOIN public.products pr ON pr.sku = si.sku
    WHERE s.created_at >= v_desde
      AND s.created_at <  v_hasta
      AND s.estado = 'completada'
    GROUP BY categoria
  ),
  cat_ec AS (
    SELECT
      COALESCE(pr.categoria, 'Sin categoría') AS categoria,
      COUNT(DISTINCT oi.order_id)::INT        AS pedidos,
      SUM(oi.qty)::INT                        AS unidades,
      SUM(oi.total)                           AS ingresos
    FROM public.order_items oi
    JOIN public.orders        o  ON o.id  = oi.order_id
    LEFT JOIN public.products pr ON pr.id = oi.product_id
    WHERE o.created_at >= v_desde
      AND o.created_at <  v_hasta
      AND o.status NOT IN ('pendiente', 'cancelado')
      AND COALESCE(o.notas, '') NOT LIKE '[MRP]%'
    GROUP BY categoria
  ),
  categorias AS (
    SELECT
      categoria,
      SUM(pedidos)::INT  AS pedidos,
      SUM(unidades)::INT AS unidades,
      SUM(ingresos)      AS ingresos
    FROM (SELECT * FROM cat_pos UNION ALL SELECT * FROM cat_ec) x
    GROUP BY categoria
    ORDER BY ingresos DESC
    LIMIT 10
  ),
  -- Funnel por SESIONES únicas (DISTINCT session_id). `sesiones` cuenta todas las sesiones con
  -- cualquier evento; `vistas` (compatibilidad) solo las que registraron `pagina_vista`.
  -- `pedidos_pagados` sale de `orders`, no de eventos del navegador.
  funnel AS (
    SELECT
      COUNT(DISTINCT session_id)::INT                                                  AS sesiones,
      COUNT(DISTINCT CASE WHEN tipo = 'pagina_vista'      THEN session_id END)::INT AS vistas,
      COUNT(DISTINCT CASE WHEN tipo = 'producto_visto'    THEN session_id END)::INT AS productos_vistos,
      COUNT(DISTINCT CASE WHEN tipo = 'carrito_iniciado'  THEN session_id END)::INT AS carritos,
      COUNT(DISTINCT CASE WHEN tipo = 'checkout_iniciado' THEN session_id END)::INT AS checkouts,
      COUNT(DISTINCT CASE WHEN tipo = 'orden_pagada'      THEN session_id END)::INT AS compras
    FROM public.eventos_web
    WHERE created_at >= v_desde
      AND created_at <  v_hasta
  ),
  pagados AS (
    SELECT COUNT(*)::INT AS pedidos_pagados
    FROM public.orders
    WHERE created_at >= v_desde
      AND created_at <  v_hasta
      AND status NOT IN ('pendiente', 'cancelado')
      AND COALESCE(notas, '') NOT LIKE '[MRP]%'
  ),
  retencion AS (
    SELECT
      COUNT(DISTINCT CASE WHEN cnt > 1 THEN customer_id END)::INT AS clientes_recurrentes,
      COUNT(DISTINCT customer_id)::INT                            AS clientes_periodo
    FROM (
      SELECT customer_id, COUNT(*) AS cnt
      FROM public.sales
      WHERE created_at >= v_desde
        AND created_at <  v_hasta
        AND estado = 'completada'
        AND customer_id IS NOT NULL
      GROUP BY customer_id
    ) x
  ),
  serie_ec AS (
    SELECT
      (created_at AT TIME ZONE 'America/Lima')::DATE::TEXT AS fecha,
      COUNT(*)::INT                  AS pedidos,
      COALESCE(SUM(total), 0)       AS ingresos
    FROM public.orders
    WHERE created_at >= v_desde
      AND created_at <  v_hasta
      AND status NOT IN ('pendiente', 'cancelado')
      AND COALESCE(notas, '') NOT LIKE '[MRP]%'
    GROUP BY (created_at AT TIME ZONE 'America/Lima')::DATE
    ORDER BY fecha
  )

  SELECT jsonb_build_object(
    'canales',       (SELECT jsonb_agg(row_to_json(x)) FROM (SELECT * FROM pos_data UNION ALL SELECT * FROM ec_data) x),
    'utm_fuentes',   (SELECT jsonb_agg(row_to_json(x)) FROM utm_data x),
    'geo_distritos', (SELECT jsonb_agg(row_to_json(x)) FROM geo_data x),
    'categorias',    (SELECT jsonb_agg(row_to_json(x)) FROM categorias x),
    'funnel',        (SELECT row_to_json(x) FROM (SELECT f.*, p.pedidos_pagados FROM funnel f, pagados p) x),
    'retencion',     (SELECT row_to_json(x) FROM retencion x),
    'serie_ec',      (SELECT jsonb_agg(row_to_json(x)) FROM serie_ec x),
    'periodo_desde', ((v_desde AT TIME ZONE 'America/Lima')::DATE)::TEXT,
    'periodo_hasta', (((v_hasta AT TIME ZONE 'America/Lima')::DATE) - 1)::TEXT
  ) INTO v_result;

  RETURN v_result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(_desde text DEFAULT NULL::text, _hasta text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _hoy     DATE := (now() AT TIME ZONE 'America/Lima')::DATE;
  _d_desde DATE := CASE WHEN _desde IS NOT NULL THEN _desde::DATE ELSE date_trunc('month', _hoy)::DATE END;
  _d_hasta DATE := CASE WHEN _hasta IS NOT NULL THEN _hasta::DATE ELSE _hoy END;

  _is_admin BOOLEAN := true;
  _result  JSONB;

  _ventas_pos_periodo     NUMERIC(12,2);
  _ventas_pos_mes_ant     NUMERIC(12,2);
  _ventas_pos_count       BIGINT;
  _ticket_promedio_pos    NUMERIC(12,2);

  _ventas_ec_periodo      NUMERIC(12,2);
  _ventas_ec_mes_ant      NUMERIC(12,2);
  _pedidos_ec_count       BIGINT;

  _ingresos_totales       NUMERIC(12,2);
  _ingresos_mes_ant       NUMERIC(12,2);

  _clientes_nuevos        BIGINT;
  _clientes_total         BIGINT;

  _prod_pendientes        BIGINT;
  _prod_en_proceso        BIGINT;
  _prod_vencidas          BIGINT;
  _prod_terminadas_periodo BIGINT;
  _tiempo_prod_promedio   NUMERIC(5,1);

  _ord_control_calidad    BIGINT;
  _ord_listo_despacho     BIGINT;
  _ord_enviado            BIGINT;

  _insumos_stock_bajo     BIGINT;

  _oc_pendientes          BIGINT;
  _oc_monto_pendiente     NUMERIC(12,2);

  _dias_periodo   INT;
  _desde_ant      DATE;
  _hasta_ant      DATE;
BEGIN
  /* guard_staff */
  IF NOT (
        coalesce(auth.role(), '') = 'service_role'
     OR session_user IN ('postgres', 'supabase_admin')
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'vendedor'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  _dias_periodo := _d_hasta - _d_desde + 1;
  _hasta_ant    := _d_desde - 1;
  _desde_ant    := _d_desde - _dias_periodo;

  -- Ventas POS (fecha en hora de Lima)
  SELECT
    COALESCE(SUM(total) FILTER (WHERE (created_at AT TIME ZONE 'America/Lima')::DATE BETWEEN _d_desde AND _d_hasta AND estado = 'completada'), 0),
    COALESCE(SUM(total) FILTER (WHERE (created_at AT TIME ZONE 'America/Lima')::DATE BETWEEN _desde_ant AND _hasta_ant AND estado = 'completada'), 0),
    COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'America/Lima')::DATE BETWEEN _d_desde AND _d_hasta AND estado = 'completada')
  INTO _ventas_pos_periodo, _ventas_pos_mes_ant, _ventas_pos_count
  FROM public.sales;

  _ticket_promedio_pos := CASE WHEN _ventas_pos_count > 0
    THEN ROUND(_ventas_pos_periodo / _ventas_pos_count, 2)
    ELSE 0 END;

  -- Ecommerce: pedido pagado = status distinto de pendiente / cancelado
  SELECT
    COALESCE(SUM(total) FILTER (WHERE (created_at AT TIME ZONE 'America/Lima')::DATE BETWEEN _d_desde AND _d_hasta), 0),
    COALESCE(SUM(total) FILTER (WHERE (created_at AT TIME ZONE 'America/Lima')::DATE BETWEEN _desde_ant AND _hasta_ant), 0),
    COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'America/Lima')::DATE BETWEEN _d_desde AND _d_hasta)
  INTO _ventas_ec_periodo, _ventas_ec_mes_ant, _pedidos_ec_count
  FROM public.orders
  WHERE status NOT IN ('pendiente', 'cancelado')
    AND COALESCE(notas, '') NOT LIKE '[MRP]%';

  _ingresos_totales := _ventas_pos_periodo + _ventas_ec_periodo;
  _ingresos_mes_ant := _ventas_pos_mes_ant + _ventas_ec_mes_ant;

  -- Clientes
  SELECT
    COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'America/Lima')::DATE BETWEEN _d_desde AND _d_hasta),
    COUNT(*)
  INTO _clientes_nuevos, _clientes_total
  FROM public.customers;

  -- Producción
  SELECT
    COUNT(*) FILTER (WHERE p.status = 'pendiente'),
    COUNT(*) FILTER (WHERE p.status = 'en_proceso'),
    COUNT(*) FILTER (WHERE p.status NOT IN ('terminado') AND p.fecha_fin_estimada < _hoy),
    COUNT(*) FILTER (WHERE p.status = 'terminado' AND (p.updated_at AT TIME ZONE 'America/Lima')::DATE BETWEEN _d_desde AND _d_hasta)
  INTO _prod_pendientes, _prod_en_proceso, _prod_vencidas, _prod_terminadas_periodo
  FROM public.produccion p;

  SELECT COALESCE(AVG(fecha_fin_real - fecha_inicio), 0)
  INTO _tiempo_prod_promedio
  FROM public.produccion
  WHERE status = 'terminado'
    AND fecha_fin_real IS NOT NULL
    AND fecha_inicio IS NOT NULL
    AND (updated_at AT TIME ZONE 'America/Lima')::DATE BETWEEN _d_desde AND _d_hasta;

  -- Pedidos en las etapas posteriores a producción (conteo actual, sin período)
  SELECT
    COUNT(*) FILTER (WHERE status::TEXT = 'control_calidad'),
    COUNT(*) FILTER (WHERE status::TEXT = 'listo_despacho'),
    COUNT(*) FILTER (WHERE status::TEXT = 'enviado')
  INTO _ord_control_calidad, _ord_listo_despacho, _ord_enviado
  FROM public.orders;

  -- Stock MRP
  SELECT COUNT(*)
  INTO _insumos_stock_bajo
  FROM public.insumos
  WHERE activo = true AND stock_actual < stock_minimo;

  -- Órdenes de compra
  SELECT
    COUNT(*) FILTER (WHERE status IN ('enviada', 'confirmada')),
    COALESCE(SUM(total) FILTER (WHERE status IN ('enviada', 'confirmada')), 0)
  INTO _oc_pendientes, _oc_monto_pendiente
  FROM public.ordenes_compra;

  _result := jsonb_build_object(
    'ingresos_totales',          _ingresos_totales,
    'ingresos_mes_ant',          _ingresos_mes_ant,
    'ingresos_var_pct',          CASE WHEN _ingresos_mes_ant > 0
                                   THEN ROUND(((_ingresos_totales - _ingresos_mes_ant) / _ingresos_mes_ant * 100)::NUMERIC, 1)
                                   ELSE NULL END,
    'ventas_pos',                _ventas_pos_periodo,
    'ventas_pos_count',          _ventas_pos_count,
    'ticket_promedio_pos',       _ticket_promedio_pos,
    'ventas_ecommerce',          _ventas_ec_periodo,
    'pedidos_ec_count',          _pedidos_ec_count,
    'clientes_nuevos',           _clientes_nuevos,
    'clientes_total',            _clientes_total,
    'prod_pendientes',           _prod_pendientes,
    'prod_en_proceso',           _prod_en_proceso,
    'prod_vencidas',             _prod_vencidas,
    'prod_terminadas',           _prod_terminadas_periodo,
    'tiempo_prod_promedio_dias', _tiempo_prod_promedio,
    'ord_control_calidad',       _ord_control_calidad,
    'ord_listo_despacho',        _ord_listo_despacho,
    'ord_enviado',               _ord_enviado,
    'insumos_stock_bajo',        _insumos_stock_bajo,
    'oc_pendientes',             _oc_pendientes,
    'oc_monto_pendiente',        _oc_monto_pendiente,
    'periodo_desde',             _d_desde::TEXT,
    'periodo_hasta',             _d_hasta::TEXT,
    'is_admin',                  _is_admin
  );

  RETURN _result;
END;
$function$;
