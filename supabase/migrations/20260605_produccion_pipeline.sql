-- ============================================================
-- G&M Mueblería — Pipeline de producción
-- PASO 1: Extender enums (deben committearse solos)
-- ============================================================

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'en_produccion';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'control_calidad';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'listo_despacho';

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'carpintero';
