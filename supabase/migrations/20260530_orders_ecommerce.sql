-- Crear función si no existe
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ═══════════════════════════════════════════════════════════
-- Pedidos ecommerce (Niubiz)
-- ═══════════════════════════════════════════════════════════

CREATE TYPE public.order_status AS ENUM (
  'pendiente', 'pagado', 'en_preparacion', 'enviado', 'entregado', 'cancelado'
);

CREATE TABLE public.orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        TEXT NOT NULL UNIQUE,
  nombre              TEXT NOT NULL,
  email               TEXT NOT NULL,
  telefono            TEXT,
  dni                 TEXT,
  direccion           TEXT,
  distrito            TEXT,
  ciudad              TEXT,
  notas               TEXT,
  subtotal            NUMERIC(12,2) NOT NULL,
  envio               NUMERIC(12,2) NOT NULL DEFAULT 0,
  total               NUMERIC(12,2) NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'PEN',
  niubiz_session_key  TEXT,
  niubiz_token        TEXT,
  niubiz_auth_code    TEXT,
  niubiz_ref_code     TEXT,
  status              public.order_status NOT NULL DEFAULT 'pendiente',
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES public.products(id) ON DELETE SET NULL,
  sku         TEXT,
  title       TEXT NOT NULL,
  qty         INTEGER NOT NULL,
  unit_price  NUMERIC(12,2) NOT NULL,
  total       NUMERIC(12,2) NOT NULL,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_status     ON public.orders(status);
CREATE INDEX idx_orders_email      ON public.orders(email);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.orders      TO anon;
GRANT INSERT ON public.order_items TO anon;
GRANT SELECT ON public.orders      TO anon;
GRANT SELECT ON public.order_items TO anon;
GRANT ALL   ON public.orders       TO service_role;
GRANT ALL   ON public.order_items  TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.orders      TO authenticated;
GRANT SELECT, INSERT         ON public.order_items TO authenticated;

CREATE POLICY "Anon puede crear pedido"    ON public.orders FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Admin ve todos los pedidos" ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Admin actualiza pedidos"    ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anon puede crear items" ON public.order_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Admin ve items"         ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id));