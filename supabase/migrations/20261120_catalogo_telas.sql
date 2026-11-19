-- ════════════════════════════════════════════════════════════════
-- Catálogo de telas para el selector de tapizado (vistas 3D de la ficha)
--
--  · tela_categorias (5) → telas (36 muestras del catálogo) · tela_tonos (colores para probar).
--  · Lectura pública (el cliente las ve sin iniciar sesión); escritura SOLO admin.
--  · Las imágenes viven en public/telas/NN.webp (no en Storage).
--  · Idempotente: se puede ejecutar más de una vez.
-- No ejecutar sin confirmación del dueño (regla 10).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tela_categorias (
  id      smallint PRIMARY KEY,
  nombre  text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.telas (
  id           text PRIMARY KEY,
  numero       smallint NOT NULL UNIQUE,
  categoria_id smallint NOT NULL REFERENCES public.tela_categorias(id),
  nombre       text NOT NULL,
  descripcion  text NOT NULL DEFAULT '',
  imagen       text NOT NULL,
  hex          text NOT NULL CHECK (hex ~ '^#[0-9a-fA-F]{6}$'),
  patron       boolean NOT NULL DEFAULT false,  -- tela con dibujo: la vista 3D conserva todo el contraste de la muestra
  activo       boolean NOT NULL DEFAULT true
);

ALTER TABLE public.telas ADD COLUMN IF NOT EXISTS patron boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.tela_tonos (
  id      text PRIMARY KEY,
  nombre  text NOT NULL,
  hex     text CHECK (hex IS NULL OR hex ~ '^#[0-9a-fA-F]{6}$'),  -- NULL = color propio de la tela
  orden   smallint NOT NULL DEFAULT 0
);

ALTER TABLE public.tela_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tela_tonos      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tela_categorias','telas','tela_tonos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select_publico" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "%1$s_select_publico" ON public.%1$s FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_escritura_admin" ON public.%1$s', t);
    EXECUTE format('CREATE POLICY "%1$s_escritura_admin" ON public.%1$s FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))', t);
  END LOOP;
END $$;

INSERT INTO public.tela_categorias (id, nombre) VALUES
  (1, 'Aterciopeladas y suaves'),
  (2, 'Tejidas y decorativas'),
  (3, 'Sintéticas y de alto rendimiento'),
  (4, 'Apariencia de cuero'),
  (5, 'Diseños y texturas')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;

INSERT INTO public.telas (id, numero, categoria_id, nombre, descripcion, imagen, hex, patron) VALUES
  ('velvet-terciopelo', 1, 1, 'Velvet (Terciopelo)', 'Elegancia y suavidad', '/telas/01.webp', '#1c4e9a', false),
  ('chenille', 2, 1, 'Chenille', 'Textura afelpada', '/telas/02.webp', '#c2a68d', false),
  ('suede-gamuzado', 3, 1, 'Suede (Gamuzado)', 'Apariencia de gamuza', '/telas/03.webp', '#535056', false),
  ('microfibra', 4, 1, 'Microfibra', 'Fácil mantenimiento', '/telas/04.webp', '#985651', false),
  ('teddy', 5, 1, 'Teddy', 'Suavidad envolvente', '/telas/05.webp', '#d9c0a9', false),
  ('boucle', 6, 1, 'Bouclé', 'Textura con bucles', '/telas/06.webp', '#dbccbf', false),
  ('jacquard', 7, 2, 'Jacquard', 'Diseños únicos', '/telas/07.webp', '#867e7b', true),
  ('lino', 8, 2, 'Lino', 'Natural y elegante', '/telas/08.webp', '#b0937a', false),
  ('algodon', 9, 2, 'Algodón', 'Fresco y confortable', '/telas/09.webp', '#2d4f72', false),
  ('lona', 10, 2, 'Lona', 'Resistente y firme', '/telas/10.webp', '#b79f8a', false),
  ('sarga-twill', 11, 2, 'Sarga (Twill)', 'Tejido diagonal', '/telas/11.webp', '#9e8a7f', false),
  ('corduroy-pana', 12, 2, 'Corduroy (Pana)', 'Con canales', '/telas/12.webp', '#b5601f', false),
  ('tapiz-gobelino', 13, 2, 'Tapiz (Gobelino)', 'Decorativa', '/telas/13.webp', '#cbb690', true),
  ('espiga', 14, 2, 'Espiga', 'Diseño clásico', '/telas/14.webp', '#947f71', false),
  ('poliester-tejido', 15, 2, 'Poliéster tejido', 'Versátil', '/telas/15.webp', '#655f5f', false),
  ('tejido-de-punto', 16, 2, 'Tejido de punto', 'Flexible', '/telas/16.webp', '#8e7e74', false),
  ('tela-antimanchas', 17, 3, 'Tela antimanchas', 'Fácil limpieza', '/telas/17.webp', '#c3aa95', false),
  ('repelente-al-agua', 18, 3, 'Repelente al agua', 'Protege de líquidos', '/telas/18.webp', '#1f5983', false),
  ('impermeable', 19, 3, 'Impermeable', 'Mayor protección', '/telas/19.webp', '#292e38', false),
  ('olefina', 20, 3, 'Olefina', 'Ideal para exterior', '/telas/20.webp', '#838f71', false),
  ('acrilica', 21, 3, 'Acrílica', 'Resistente al sol', '/telas/21.webp', '#d75818', false),
  ('polipropileno', 22, 3, 'Polipropileno', 'Gran durabilidad', '/telas/22.webp', '#80828e', false),
  ('cuero-sintetico-pu', 23, 4, 'Cuero sintético (PU)', 'Elegancia y estilo', '/telas/23.webp', '#381f1a', false),
  ('cuerina-pvc', 24, 4, 'Cuerina (PVC)', 'Fácil limpieza', '/telas/24.webp', '#2b2b2c', false),
  ('cuero-sintetico-gamuza', 25, 4, 'Cuero sintético (Gamuza)', 'Suave y moderno', '/telas/25.webp', '#885034', false),
  ('cuero-natural', 26, 4, 'Cuero natural', 'Gama alta', '/telas/26.webp', '#a46c45', false),
  ('cuero-grabado', 27, 4, 'Cuero grabado', 'Diseño exclusivo', '/telas/27.webp', '#7d584f', false),
  ('nobuck', 28, 4, 'Nobuck', 'Acabado aterciopelado', '/telas/28.webp', '#834f33', false),
  ('piel-de-potro', 29, 5, 'Piel de potro', 'Estampado natural', '/telas/29.webp', '#ccc0b8', true),
  ('jaguar', 30, 5, 'Jaguar', 'Estampado animal', '/telas/30.webp', '#a27b5d', true),
  ('dino', 31, 5, 'Dino', 'Relieve geométrico', '/telas/31.webp', '#7a7a80', true),
  ('iker', 32, 5, 'Iker', 'Patrón moderno', '/telas/32.webp', '#928274', true),
  ('floral', 33, 5, 'Floral', 'Estampado floral', '/telas/33.webp', '#d9c3a0', true),
  ('geometrica', 34, 5, 'Geométrica', 'Patrón geométrico', '/telas/34.webp', '#807a77', true),
  ('texturizada', 35, 5, 'Texturizada', 'Relieve sutil', '/telas/35.webp', '#81818e', false),
  ('estampada', 36, 5, 'Estampada', 'Diseño artístico', '/telas/36.webp', '#97a1a3', true)
ON CONFLICT (id) DO UPDATE SET numero = EXCLUDED.numero, categoria_id = EXCLUDED.categoria_id, nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion, imagen = EXCLUDED.imagen, hex = EXCLUDED.hex, patron = EXCLUDED.patron;

INSERT INTO public.tela_tonos (id, nombre, hex, orden) VALUES
  ('original', 'Original', NULL, 0),
  ('crema', 'Crema', '#e6dcc8', 1),
  ('gris', 'Gris', '#8a8d90', 2),
  ('azul-marino', 'Azul marino', '#2f4a6b', 3),
  ('verde', 'Verde', '#4f6b4a', 4),
  ('terracota', 'Terracota', '#a65d44', 5),
  ('vino', 'Vino', '#6e2a3a', 6),
  ('negro', 'Negro', '#232323', 7)
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, hex = EXCLUDED.hex, orden = EXCLUDED.orden;
