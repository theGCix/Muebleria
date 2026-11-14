-- Origen del producto (se muestra al cliente en la ficha, pestaña Descripción).
-- Forma esperada del JSON (todo opcional; lo vacío no se muestra):
--   { "material": "Madera tornillo", "procedencia": "Pucallpa", "artesano": "Taller G&M",
--     "dias_fabricacion": 15 }
-- Productos de manufactura: la ficha ya dice «Fabricado en nuestro taller»; estos datos lo detallan.
-- Productos retail (de proveedor): solo se muestra el bloque si hay `procedencia` o `material`.
-- Las políticas RLS de `products` ya cubren la columna nueva (lectura pública, escritura de admin).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS origen JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_origen_objeto;
ALTER TABLE public.products
  ADD CONSTRAINT products_origen_objeto CHECK (jsonb_typeof(origen) = 'object');

COMMENT ON COLUMN public.products.origen IS
  'Datos públicos de origen: material, procedencia, artesano, dias_fabricacion (todo opcional).';
