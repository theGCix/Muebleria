-- Reacciones («me gusta», «me encanta», …) a los proyectos de la vitrina /proyectos.
-- Reglas: solo con sesión; 1 reacción por persona y proyecto (se puede cambiar de tipo o quitar);
-- el conteo es público pero NO se expone quién reaccionó. Idempotente: se puede ejecutar más de una vez.
-- REQUIERE CONFIRMACIÓN DEL DUEÑO ANTES DE EJECUTAR (crea políticas RLS).

CREATE TABLE IF NOT EXISTS public.proyecto_reacciones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('me_gusta', 'me_encanta', 'impresionante', 'lo_quiero')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proyecto_reacciones_unica UNIQUE (proyecto_id, user_id)
);

CREATE INDEX IF NOT EXISTS proyecto_reacciones_proyecto_tipo_idx
  ON public.proyecto_reacciones (proyecto_id, tipo);

ALTER TABLE public.proyecto_reacciones ENABLE ROW LEVEL SECURITY;

-- Cada persona ve y modifica SOLO su propia reacción; el admin puede ver y quitar cualquiera (moderación).
DROP POLICY IF EXISTS "reacciones_select" ON public.proyecto_reacciones;
CREATE POLICY "reacciones_select" ON public.proyecto_reacciones
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "reacciones_insert" ON public.proyecto_reacciones;
CREATE POLICY "reacciones_insert" ON public.proyecto_reacciones
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "reacciones_update" ON public.proyecto_reacciones;
CREATE POLICY "reacciones_update" ON public.proyecto_reacciones
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "reacciones_delete" ON public.proyecto_reacciones;
CREATE POLICY "reacciones_delete" ON public.proyecto_reacciones
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proyecto_reacciones TO authenticated;

-- Conteo público por proyecto y tipo. La vista corre con los permisos de su dueño (a propósito:
-- así el visitante ve cuántas reacciones hay sin poder leer filas ni user_id). Solo expone conteos.
CREATE OR REPLACE VIEW public.v_proyecto_reacciones_conteo AS
  SELECT proyecto_id, tipo, count(*)::int AS total
  FROM public.proyecto_reacciones
  GROUP BY proyecto_id, tipo;

GRANT SELECT ON public.v_proyecto_reacciones_conteo TO anon, authenticated;

-- ── Verificación (ejecutar después) ──────────────────────────────────────────
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'proyecto_reacciones';   -- 4 políticas
-- SELECT * FROM public.v_proyecto_reacciones_conteo;                                  -- vacío al inicio

-- ── Rollback (solo si hace falta deshacer; NO ejecutar con la migración) ─────
-- DROP VIEW IF EXISTS public.v_proyecto_reacciones_conteo;
-- DROP TABLE IF EXISTS public.proyecto_reacciones;
