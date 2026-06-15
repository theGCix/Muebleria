-- ============================================================
-- POLÍTICAS RLS COMPLETAS — G&M Mueblería
-- Ejecutar en Supabase → SQL Editor
-- ============================================================
-- IMPORTANTE: Primero verifica si ya existen políticas con:
--   SELECT * FROM pg_policies WHERE tablename = 'nombre_tabla';
-- Si hay duplicados, elimínalos antes con DROP POLICY.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. ORDER_ITEMS
--    Problema raíz: causaba el error que bloqueaba todo
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Lectura: usuarios autenticados pueden ver los items de sus órdenes
CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND (
          orders.user_id = auth.uid()  -- cliente dueño del pedido
          OR EXISTS (                   -- o es staff (tiene algún rol)
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
          )
        )
    )
  );

-- Insertar: solo staff puede insertar items de orden (POS/admin)
CREATE POLICY "order_items_insert"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
    )
  );

-- Actualizar/Eliminar: solo staff
CREATE POLICY "order_items_update"
  ON public.order_items FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );

CREATE POLICY "order_items_delete"
  ON public.order_items FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────
-- 2. ORDERS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Cliente ve sus propios pedidos; staff ve todos
CREATE POLICY "orders_select"
  ON public.orders FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid()
    )
  );

-- Cualquier autenticado puede crear un pedido (checkout)
CREATE POLICY "orders_insert"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (true);

-- Solo staff puede actualizar órdenes
CREATE POLICY "orders_update"
  ON public.orders FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────
-- 3. PRODUCCION
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.produccion ENABLE ROW LEVEL SECURITY;

-- Carpintero ve las órdenes asignadas a él; admin ve todo
CREATE POLICY "produccion_select"
  ON public.produccion FOR SELECT TO authenticated
  USING (
    asignado_a = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'vendedor')
    )
  );

-- Solo staff puede insertar/actualizar registros de producción
CREATE POLICY "produccion_insert"
  ON public.produccion FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "produccion_update"
  ON public.produccion FOR UPDATE TO authenticated
  USING (
    asignado_a = auth.uid()  -- carpintero puede actualizar su propia orden
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin')
    )
  );


-- ────────────────────────────────────────────────────────────
-- 4. INSUMOS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

-- Staff puede ver y gestionar insumos
CREATE POLICY "insumos_select"
  ON public.insumos FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );

CREATE POLICY "insumos_insert"
  ON public.insumos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "insumos_update"
  ON public.insumos FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );


-- ────────────────────────────────────────────────────────────
-- 5. BOM_ITEMS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bom_items_select"
  ON public.bom_items FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );

CREATE POLICY "bom_items_write"
  ON public.bom_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );


-- ────────────────────────────────────────────────────────────
-- 6. INSUMO_MOVIMIENTOS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.insumo_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insumo_movimientos_select"
  ON public.insumo_movimientos FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );

CREATE POLICY "insumo_movimientos_insert"
  ON public.insumo_movimientos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────
-- 7. SALES / SALE_ITEMS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_select"
  ON public.sales FOR SELECT TO authenticated
  USING (
    vendedor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "sales_insert"
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );

CREATE POLICY "sales_update"
  ON public.sales FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_items_all"
  ON public.sale_items FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────
-- 8. CUSTOMERS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Cliente puede ver/editar su propio registro; staff ve todos
CREATE POLICY "customers_select"
  ON public.customers FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "customers_insert"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "customers_update"
  ON public.customers FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid()
    )
  );


-- ────────────────────────────────────────────────────────────
-- 9. PROFILES / USER_ROLES
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Cualquier autenticado puede leer roles (necesario para las verificaciones)
CREATE POLICY "user_roles_select"
  ON public.user_roles FOR SELECT TO authenticated
  USING (true);

-- Solo admin puede asignar roles
CREATE POLICY "user_roles_write"
  ON public.user_roles FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );


-- ────────────────────────────────────────────────────────────
-- 10. PROVEEDORES / ORDENES_COMPRA / ORDEN_COMPRA_ITEMS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedores_all"
  ON public.proveedores FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );

ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ordenes_compra_all"
  ON public.ordenes_compra FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );

ALTER TABLE public.orden_compra_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orden_compra_items_all"
  ON public.orden_compra_items FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────
-- 11. PRODUCTS / WISHLIST
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver productos activos (tienda pública)
CREATE POLICY "products_select_public"
  ON public.products FOR SELECT
  USING (activo = true);

-- Staff ve todos (incluyendo inactivos)
CREATE POLICY "products_select_staff"
  ON public.products FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );

-- Solo admin puede modificar productos
CREATE POLICY "products_write"
  ON public.products FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wishlist_own"
  ON public.wishlist FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 12. NOTIFICACIONES / ORDER_ESTADO_HISTORIAL / EVENTOS_WEB
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificaciones_staff"
  ON public.notificaciones FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );

ALTER TABLE public.order_estado_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_estado_historial_select"
  ON public.order_estado_historial FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_estado_historial.order_id
        AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "order_estado_historial_insert"
  ON public.order_estado_historial FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid())
  );

ALTER TABLE public.eventos_web ENABLE ROW LEVEL SECURITY;

-- Cualquier autenticado puede insertar eventos (tracking)
CREATE POLICY "eventos_web_insert"
  ON public.eventos_web FOR INSERT TO authenticated
  WITH CHECK (true);

-- Solo admin puede leer los eventos de analytics
CREATE POLICY "eventos_web_select"
  ON public.eventos_web FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );


-- ============================================================
-- VERIFICAR después de ejecutar:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
-- ============================================================