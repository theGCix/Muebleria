-- ============================================================
-- G&M Mueblería — Pipeline de producción
-- PASO 2: Tablas, triggers y funciones (enum ya commiteado)
-- ============================================================

-- ── PRODUCCIÓN ───────────────────────────────────────────────

CREATE TYPE public.produccion_status AS ENUM (
  'pendiente', 'en_proceso', 'pausado', 'terminado', 'rechazado_calidad'
);

CREATE TABLE public.produccion (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  asignado_a            UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  status                public.produccion_status NOT NULL DEFAULT 'pendiente',
  prioridad             SMALLINT NOT NULL DEFAULT 2 CHECK (prioridad BETWEEN 1 AND 3),

  fecha_inicio          DATE,
  fecha_fin_estimada    DATE,
  fecha_fin_real        DATE,

  calidad_aprobada      BOOLEAN,
  calidad_revisado_por  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  calidad_notas         TEXT,

  observaciones         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (order_id)
);

CREATE INDEX idx_produccion_order    ON public.produccion(order_id);
CREATE INDEX idx_produccion_asignado ON public.produccion(asignado_a);
CREATE INDEX idx_produccion_status   ON public.produccion(status);

CREATE TRIGGER produccion_updated_at
  BEFORE UPDATE ON public.produccion
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.produccion ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.produccion TO authenticated;
GRANT ALL ON public.produccion TO service_role;

CREATE POLICY "Staff ve produccion" ON public.produccion
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'vendedor') OR
    public.has_role(auth.uid(), 'carpintero')
  );

CREATE POLICY "Admin crea produccion" ON public.produccion
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));

CREATE POLICY "Staff actualiza produccion" ON public.produccion
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'vendedor') OR
    (public.has_role(auth.uid(), 'carpintero') AND asignado_a = auth.uid())
  );

-- ── HISTORIAL DE ESTADOS ─────────────────────────────────────

CREATE TABLE public.order_estado_historial (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  estado_anterior public.order_status,
  estado_nuevo    public.order_status NOT NULL,
  cambiado_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  motivo          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_historial_order ON public.order_estado_historial(order_id);
CREATE INDEX idx_historial_fecha ON public.order_estado_historial(created_at DESC);

ALTER TABLE public.order_estado_historial ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.order_estado_historial TO authenticated;
GRANT ALL ON public.order_estado_historial TO service_role;

CREATE POLICY "Staff ve historial" ON public.order_estado_historial
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));

CREATE POLICY "Authenticated inserta historial" ON public.order_estado_historial
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.registrar_cambio_estado_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_estado_historial
      (order_id, estado_anterior, estado_nuevo, cambiado_por)
    VALUES
      (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_historial_order_status
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.registrar_cambio_estado_order();

-- ── NOTIFICACIONES ───────────────────────────────────────────

CREATE TYPE public.notif_tipo AS ENUM (
  'pedido_confirmado', 'en_produccion', 'control_calidad',
  'listo_despacho', 'entregado', 'cancelado', 'solicitud_resena'
);

CREATE TYPE public.notif_canal AS ENUM ('email', 'sms', 'whatsapp');

CREATE TABLE public.notificaciones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  destinatario_email  TEXT,
  destinatario_nombre TEXT,
  tipo                public.notif_tipo NOT NULL,
  canal               public.notif_canal NOT NULL DEFAULT 'email',
  asunto              TEXT,
  mensaje             TEXT,
  enviado             BOOLEAN NOT NULL DEFAULT false,
  enviado_at          TIMESTAMPTZ,
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_order   ON public.notificaciones(order_id);
CREATE INDEX idx_notif_enviado ON public.notificaciones(enviado) WHERE enviado = false;

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.notificaciones TO authenticated;
GRANT ALL ON public.notificaciones TO service_role;

CREATE POLICY "Admin ve notificaciones" ON public.notificaciones
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));

CREATE POLICY "Service inserta notificaciones" ON public.notificaciones
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── FUNCIÓN: cambiar estado (valida transiciones) ─────────────

CREATE OR REPLACE FUNCTION public.cambiar_estado_pedido(
  _order_id     UUID,
  _nuevo_estado public.order_status,
  _motivo       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _order   public.orders;
  _ok      BOOLEAN := false;
BEGIN
  IF NOT (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'vendedor')) THEN
    RAISE EXCEPTION 'Sin permisos para cambiar estado de pedidos';
  END IF;

  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;

  -- Validar transición
  _ok := CASE _order.status
    WHEN 'pendiente'        THEN _nuevo_estado IN ('pagado', 'cancelado')
    WHEN 'pagado'           THEN _nuevo_estado IN ('en_produccion', 'cancelado')
    WHEN 'en_produccion'    THEN _nuevo_estado IN ('control_calidad', 'cancelado')
    WHEN 'control_calidad'  THEN _nuevo_estado IN ('listo_despacho', 'en_produccion')
    WHEN 'listo_despacho'   THEN _nuevo_estado IN ('enviado', 'entregado')
    WHEN 'enviado'          THEN _nuevo_estado IN ('entregado')
    ELSE false
  END;

  IF NOT _ok THEN
    RAISE EXCEPTION 'Transición inválida: % → %', _order.status, _nuevo_estado;
  END IF;

  UPDATE public.orders
  SET status = _nuevo_estado, updated_at = now()
  WHERE id = _order_id;

  -- Crear registro de producción al pasar a en_produccion
  IF _nuevo_estado = 'en_produccion' THEN
    INSERT INTO public.produccion (order_id, fecha_inicio, fecha_fin_estimada)
    VALUES (_order_id, now()::DATE, (now() + INTERVAL '7 days')::DATE)
    ON CONFLICT (order_id) DO UPDATE SET
      status     = 'en_proceso',
      fecha_inicio = COALESCE(produccion.fecha_inicio, now()::DATE),
      updated_at = now();
  END IF;

  -- Encolar notificación
  INSERT INTO public.notificaciones
    (order_id, destinatario_email, destinatario_nombre, tipo, canal, asunto)
  VALUES (
    _order_id,
    _order.email,
    _order.nombre,
    CASE _nuevo_estado
      WHEN 'pagado'          THEN 'pedido_confirmado'
      WHEN 'en_produccion'   THEN 'en_produccion'
      WHEN 'control_calidad' THEN 'control_calidad'
      WHEN 'listo_despacho'  THEN 'listo_despacho'
      WHEN 'entregado'       THEN 'entregado'
      WHEN 'cancelado'       THEN 'cancelado'
    END::public.notif_tipo,
    'email',
    CASE _nuevo_estado
      WHEN 'pagado'          THEN 'Pedido confirmado — G&M Mueblería'
      WHEN 'en_produccion'   THEN 'Tu mueble está en producción'
      WHEN 'listo_despacho'  THEN 'Tu pedido está listo para despacho'
      WHEN 'entregado'       THEN '¡Tu pedido fue entregado!'
      WHEN 'cancelado'       THEN 'Pedido cancelado'
      ELSE NULL
    END
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', _order_id,
    'estado_anterior', _order.status,
    'estado_nuevo', _nuevo_estado
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cambiar_estado_pedido TO authenticated;

-- ── VISTA: panel de producción ────────────────────────────────

CREATE OR REPLACE VIEW public.v_produccion_panel AS
SELECT
  p.id              AS produccion_id,
  o.id              AS order_id,
  o.order_number,
  o.nombre          AS cliente,
  o.email,
  o.telefono,
  o.total,
  o.status          AS order_status,
  o.created_at      AS pedido_fecha,
  p.status          AS prod_status,
  p.prioridad,
  p.fecha_inicio,
  p.fecha_fin_estimada,
  p.fecha_fin_real,
  p.calidad_aprobada,
  p.observaciones,
  prof.full_name    AS carpintero
FROM public.produccion p
JOIN public.orders o ON o.id = p.order_id
LEFT JOIN public.profiles prof ON prof.id = p.asignado_a
WHERE p.status NOT IN ('terminado');

GRANT SELECT ON public.v_produccion_panel TO authenticated;
