-- ════════════════════════════════════════════════════════════════
-- Modelos 3D (.glb) en la ficha del producto — Supabase Storage
--
--  · Bucket PÚBLICO «modelos-3d» (el navegador del cliente descarga el .glb directo, sin pasar por el servidor).
--  · Escritura (subir, reemplazar, borrar) SOLO admin. Límite 5 MB por archivo.
--  · products.modelo_3d_url ya existe en producción; el IF NOT EXISTS lo deja idempotente.
-- No ejecutar sin confirmación del dueño (regla 10).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS modelo_3d_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('modelos-3d', 'modelos-3d', true, 5242880, ARRAY['model/gltf-binary', 'application/octet-stream'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "modelos3d_insert_admin" ON storage.objects;
CREATE POLICY "modelos3d_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'modelos-3d' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "modelos3d_update_admin" ON storage.objects;
CREATE POLICY "modelos3d_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'modelos-3d' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'modelos-3d' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "modelos3d_delete_admin" ON storage.objects;
CREATE POLICY "modelos3d_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'modelos-3d' AND public.has_role(auth.uid(), 'admin'::public.app_role));
