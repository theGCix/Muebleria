-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor', 'cliente');

-- Comprobante type
CREATE TYPE public.comprobante_tipo AS ENUM ('boleta', 'factura', 'nota');
CREATE TYPE public.payment_method AS ENUM ('efectivo', 'tarjeta', 'transferencia', 'yape_plin');
CREATE TYPE public.sale_status AS ENUM ('completada', 'anulada');
CREATE TYPE public.doc_tipo AS ENUM ('DNI', 'RUC', 'CE', 'PASAPORTE');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles RLS
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins manage profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles RLS
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_tipo public.doc_tipo NOT NULL DEFAULT 'DNI',
  doc_numero TEXT NOT NULL,
  nombre TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(doc_tipo, doc_numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view customers" ON public.customers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Staff can create customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Staff can update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Admins delete customers" ON public.customers
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Sequences for comprobantes
CREATE SEQUENCE public.seq_boleta START 1;
CREATE SEQUENCE public.seq_factura START 1;
CREATE SEQUENCE public.seq_nota START 1;

-- Sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  tipo public.comprobante_tipo NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
  vendedor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  igv NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  metodo_pago public.payment_method NOT NULL DEFAULT 'efectivo',
  estado public.sale_status NOT NULL DEFAULT 'completada',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX idx_sales_vendedor ON public.sales(vendedor_id);
CREATE INDEX idx_sales_customer ON public.sales(customer_id);

CREATE POLICY "Admins see all sales" ON public.sales
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Vendedores see own sales" ON public.sales
  FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid() AND public.has_role(auth.uid(), 'vendedor'));
CREATE POLICY "Staff create sales" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (
    vendedor_id = auth.uid()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'))
  );
CREATE POLICY "Admins update sales" ON public.sales
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Sale items
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  shopify_product_id TEXT,
  shopify_variant_id TEXT,
  sku TEXT,
  title TEXT NOT NULL,
  qty NUMERIC(12,2) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON public.sale_items(shopify_product_id);

CREATE POLICY "View items of accessible sales" ON public.sale_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id
    AND (public.has_role(auth.uid(), 'admin') OR s.vendedor_id = auth.uid())));
CREATE POLICY "Insert items into own sales" ON public.sale_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_items.sale_id
    AND s.vendedor_id = auth.uid()));

-- Trigger: create profile + assign role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO is_first;
  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendedor');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generate comprobante number
CREATE OR REPLACE FUNCTION public.next_comprobante_numero(_tipo public.comprobante_tipo)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix TEXT;
  n BIGINT;
BEGIN
  CASE _tipo
    WHEN 'boleta' THEN prefix := 'B001'; n := nextval('public.seq_boleta');
    WHEN 'factura' THEN prefix := 'F001'; n := nextval('public.seq_factura');
    WHEN 'nota' THEN prefix := 'N001'; n := nextval('public.seq_nota');
  END CASE;
  RETURN prefix || '-' || lpad(n::TEXT, 8, '0');
END;
$$;

-- Create sale (transactional)
CREATE OR REPLACE FUNCTION public.create_sale(
  _tipo public.comprobante_tipo,
  _customer_id UUID,
  _metodo public.payment_method,
  _items JSONB,
  _notas TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user UUID := auth.uid();
  _sale_id UUID;
  _numero TEXT;
  _subtotal NUMERIC(12,2) := 0;
  _igv NUMERIC(12,2);
  _total NUMERIC(12,2) := 0;
  _item JSONB;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT (public.has_role(_user, 'admin') OR public.has_role(_user, 'vendedor')) THEN
    RAISE EXCEPTION 'Sin permisos para crear ventas';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _total := _total + ((_item->>'qty')::NUMERIC * (_item->>'unit_price')::NUMERIC);
  END LOOP;

  _subtotal := round(_total / 1.18, 2);
  _igv := round(_total - _subtotal, 2);
  _numero := public.next_comprobante_numero(_tipo);

  INSERT INTO public.sales (numero, tipo, customer_id, vendedor_id, subtotal, igv, total, metodo_pago, notas)
  VALUES (_numero, _tipo, _customer_id, _user, _subtotal, _igv, _total, _metodo, _notas)
  RETURNING id INTO _sale_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    INSERT INTO public.sale_items (sale_id, shopify_product_id, shopify_variant_id, sku, title, qty, unit_price, total)
    VALUES (
      _sale_id,
      _item->>'shopify_product_id',
      _item->>'shopify_variant_id',
      _item->>'sku',
      _item->>'title',
      (_item->>'qty')::NUMERIC,
      (_item->>'unit_price')::NUMERIC,
      (_item->>'qty')::NUMERIC * (_item->>'unit_price')::NUMERIC
    );
  END LOOP;

  RETURN _sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sale TO authenticated;