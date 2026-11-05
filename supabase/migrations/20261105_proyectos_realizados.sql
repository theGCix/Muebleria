-- Proyectos realizados (Fase 2/B): distrito, tiempo de ejecución, materiales y fotos antes/después.
-- Todo es opcional: un campo vacío no se muestra en la página pública. Idempotente.
-- Sin cambios de RLS: las columnas nuevas siguen las políticas de fila ya vigentes en `proyectos`
-- (lectura pública solo de `publicado = true`; escritura de staff). Verifica con:
--   select policyname, cmd, qual from pg_policies where tablename = 'proyectos';
ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS distrito text,
  ADD COLUMN IF NOT EXISTS tiempo_ejecucion text,
  ADD COLUMN IF NOT EXISTS materiales text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fotos_antes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fotos_despues text[] NOT NULL DEFAULT '{}',
  -- El cliente autorizó mostrar su distrito y sus fotos. Sin esto la web no publica esos datos.
  ADD COLUMN IF NOT EXISTS autorizacion_cliente boolean NOT NULL DEFAULT false;
