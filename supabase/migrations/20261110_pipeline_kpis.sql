-- ============================================================
-- A4 · Pipeline: estado operativo actual vs métricas históricas
--
-- Reemplaza get_dashboard_kpis (misma firma, SECURITY DEFINER, mismo guard de staff).
-- No toca tablas ni políticas. Antes de ejecutar, guarda la definición actual:
--   select pg_get_functiondef('public.get_dashboard_kpis(text,text)'::regprocedure);
--
-- Cambios respecto de 20261109_metricas_conversion.sql:
--  1. ESTADO ACTUAL (no depende del período): prod_pendientes, prod_en_proceso y los nuevos
--     prod_pausadas, prod_rechazadas y prod_activas (= producción distinta de «terminado»),
--     más prod_vencidas y los ord_* de siempre. «Órdenes activas» deja de olvidar las
--     pausadas / rechazadas en calidad.
--  2. HISTÓRICO (depende del período): prod_terminadas y tiempo_prod_promedio_dias se miden en la
--     fecha en que terminó la orden (fecha_fin_real; si falta, la fecha de actualización en hora
--     de Lima). Antes usaban updated_at, que cambia con cualquier edición posterior.
-- ============================================================

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
  _prod_activas           BIGINT;
  _prod_pausadas          BIGINT;
  _prod_rechazadas        BIGINT;
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

  -- Producción · ESTADO ACTUAL (no depende del período): pendiente, en proceso, pausada,
  -- rechazada en calidad y activas (= todo lo que no está terminado).
  SELECT
    COUNT(*) FILTER (WHERE p.status = 'pendiente'),
    COUNT(*) FILTER (WHERE p.status = 'en_proceso'),
    COUNT(*) FILTER (WHERE p.status = 'pausado'),
    COUNT(*) FILTER (WHERE p.status = 'rechazado_calidad'),
    COUNT(*) FILTER (WHERE p.status <> 'terminado'),
    COUNT(*) FILTER (WHERE p.status <> 'terminado' AND p.fecha_fin_estimada < _hoy)
  INTO _prod_pendientes, _prod_en_proceso, _prod_pausadas, _prod_rechazadas, _prod_activas, _prod_vencidas
  FROM public.produccion p;

  -- Producción · HISTÓRICO (depende del período): se cuenta en la fecha en que terminó
  -- (fecha_fin_real; si falta, la fecha de la última actualización, en hora de Lima).
  SELECT COUNT(*)
  INTO _prod_terminadas_periodo
  FROM public.produccion p
  WHERE p.status = 'terminado'
    AND COALESCE(p.fecha_fin_real, (p.updated_at AT TIME ZONE 'America/Lima')::DATE) BETWEEN _d_desde AND _d_hasta;

  SELECT COALESCE(AVG(fecha_fin_real - fecha_inicio), 0)
  INTO _tiempo_prod_promedio
  FROM public.produccion
  WHERE status = 'terminado'
    AND fecha_fin_real IS NOT NULL
    AND fecha_inicio IS NOT NULL
    AND fecha_fin_real BETWEEN _d_desde AND _d_hasta;

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
    'prod_activas',              _prod_activas,
    'prod_pausadas',             _prod_pausadas,
    'prod_rechazadas',           _prod_rechazadas,
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
