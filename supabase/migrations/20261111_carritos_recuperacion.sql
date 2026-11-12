-- ============================================================
-- A8 · Carritos abandonados — recuperación manual (WhatsApp / correo)
--
-- Por qué existe:
--  · `carritos` NO tiene política de UPDATE para el personal (solo SELECT y DELETE de admin), así
--    que el cambio de estado desde el panel («Contactado», «Perdido»…) se descartaba sin error.
--  · n8n (Gmail) ya envía el aviso 1 (≈1 h) y el aviso 2 con cupón (≥24 h) y deja marcas en
--    recordatorio_1_at / recordatorio_2_at / recordatorio_enviado / estado. Un contacto manual debe
--    coordinarse con esas marcas para no duplicar.
--
-- Cómo: tres funciones SECURITY DEFINER con el mismo guard de staff que get_dashboard_kpis.
-- NO crea tablas ni columnas, NO cambia políticas ni permisos de tablas (solo GRANT EXECUTE de las
-- funciones a `authenticated`).
--
--  1. cambiar_estado_carrito(_carrito_id, _estado)      → admin / vendedor
--  2. registrar_contacto_carrito(_carrito_id, _pausar)  → admin / vendedor. Pasa el carrito a
--     «contactado» y, si _pausar, cierra el seguimiento automático con la MISMA marca que ya usa
--     n8n para los carritos que no puede avisar (recordatorio_1_at y recordatorio_2_at = now() si
--     estaban vacíos). No toca recordatorio_enviado: ese indicador queda reservado a los correos
--     que n8n realmente envió.
--  3. cupon_recuperacion_carrito(_carrito_id)           → SOLO admin (como la pantalla Cupones).
--     Obtiene o crea UN cupón por carrito con el mismo código y los mismos campos que n8n
--     (VUELVE-XXXXXXXX, 5 %, 48 h, un solo uso, origen carrito_abandonado) + carrito_origen_id.
--     Si el cupón ya existe y sigue vigente, lo reutiliza (también el que creó n8n); si venció o ya
--     se usó, NO crea otro. n8n inserta con on_conflict=codigo e ignora duplicados, así que no choca.
--
-- Antes de ejecutar no hace falta respaldo (son funciones nuevas). Ejecutar en el SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cambiar_estado_carrito(_carrito_id uuid, _estado text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _filas INTEGER;
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

  IF _estado IS NULL OR _estado NOT IN ('activo', 'contactado', 'recuperado', 'perdido') THEN
    RAISE EXCEPTION 'Estado no válido';
  END IF;

  UPDATE public.carritos SET estado = _estado WHERE id = _carrito_id;
  GET DIAGNOSTICS _filas = ROW_COUNT;
  IF _filas = 0 THEN RAISE EXCEPTION 'Carrito no encontrado'; END IF;

  RETURN jsonb_build_object('ok', true, 'estado', _estado);
END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_contacto_carrito(_carrito_id uuid, _pausar_avisos boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _c       public.carritos;
  _previo  TEXT;
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

  SELECT * INTO _c FROM public.carritos WHERE id = _carrito_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carrito no encontrado'; END IF;
  IF _c.estado NOT IN ('activo', 'contactado') THEN
    RAISE EXCEPTION 'Este carrito ya está marcado como %', _c.estado;
  END IF;

  _previo := _c.estado;

  UPDATE public.carritos SET
    estado            = 'contactado',
    recordatorio_1_at = CASE WHEN COALESCE(_pausar_avisos, true) THEN COALESCE(recordatorio_1_at, now()) ELSE recordatorio_1_at END,
    recordatorio_2_at = CASE WHEN COALESCE(_pausar_avisos, true) THEN COALESCE(recordatorio_2_at, now()) ELSE recordatorio_2_at END
  WHERE id = _carrito_id;

  RETURN jsonb_build_object(
    'ok', true,
    'ya_contactado', _previo = 'contactado',
    'avisos_pausados', COALESCE(_pausar_avisos, true)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cupon_recuperacion_carrito(_carrito_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  -- Mismos valores que n8n/armar-correo-carrito.js (CUPON_PORCENTAJE y CUPON_HORAS)
  _PORCENTAJE CONSTANT NUMERIC := 5;
  _HORAS      CONSTANT INTEGER := 48;
  _c          public.carritos;
  _k          public.cupones;
  _codigo     TEXT;
  _creado     BOOLEAN := false;
  _filas      INTEGER;
  _estado     TEXT;
  _motivo     TEXT;
BEGIN
  /* guard_admin */
  IF NOT (
        coalesce(auth.role(), '') = 'service_role'
     OR session_user IN ('postgres', 'supabase_admin')
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede generar cupones' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _c FROM public.carritos WHERE id = _carrito_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carrito no encontrado'; END IF;
  IF _c.estado NOT IN ('activo', 'contactado') THEN
    RAISE EXCEPTION 'Este carrito ya está marcado como %', _c.estado;
  END IF;

  _codigo := 'VUELVE-' || upper(substr(replace(_carrito_id::text, '-', ''), 1, 8));

  SELECT * INTO _k FROM public.cupones WHERE codigo = _codigo;
  IF NOT FOUND THEN
    INSERT INTO public.cupones (
      codigo, descripcion, tipo_descuento, valor, monto_minimo_compra, aplica_a, solo_primera_compra,
      uso_maximo_total, uso_maximo_por_cliente, vigente_desde, vence_el, activo, origen,
      carrito_origen_id, notas, creado_por
    ) VALUES (
      _codigo, 'Recuperación de carrito abandonado (' || _PORCENTAJE || '%)', 'porcentaje', _PORCENTAJE, 0, 'todo', false,
      1, 1, now(), now() + make_interval(hours => _HORAS), true, 'carrito_abandonado',
      _carrito_id, 'Generado manualmente para el carrito ' || _carrito_id, auth.uid()
    )
    ON CONFLICT (codigo) DO NOTHING;
    GET DIAGNOSTICS _filas = ROW_COUNT;
    _creado := _filas > 0;
    SELECT * INTO _k FROM public.cupones WHERE codigo = _codigo;   -- por si otra llamada lo creó antes
  END IF;

  IF NOT _k.activo THEN
    _estado := 'no_disponible'; _motivo := 'desactivado';
  ELSIF _k.vence_el IS NOT NULL AND _k.vence_el <= now() THEN
    _estado := 'no_disponible'; _motivo := 'vencido';
  ELSIF _k.uso_maximo_total IS NOT NULL AND _k.usos_actuales >= _k.uso_maximo_total THEN
    _estado := 'no_disponible'; _motivo := 'usado';
  ELSE
    _estado := CASE WHEN _creado THEN 'creado' ELSE 'existente' END; _motivo := NULL;
  END IF;

  RETURN jsonb_build_object(
    'estado', _estado, 'motivo', _motivo, 'codigo', _k.codigo,
    'valor', _k.valor, 'tipo_descuento', _k.tipo_descuento, 'vence_el', _k.vence_el
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cambiar_estado_carrito(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_contacto_carrito(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cupon_recuperacion_carrito(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cambiar_estado_carrito(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_contacto_carrito(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cupon_recuperacion_carrito(uuid) TO authenticated;
