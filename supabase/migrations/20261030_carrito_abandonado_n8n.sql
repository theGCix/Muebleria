-- Recordatorios de carrito abandonado con n8n.
-- n8n busca carritos con correo, sin actividad hace más de 1 h, y envía hasta 2 correos:
--   paso 1 (≈1 h sin actividad) y paso 2 (≈24 h sin actividad, con cupón).
-- Cada paso deja su marca de tiempo para no repetirse.
ALTER TABLE public.carritos
  ADD COLUMN IF NOT EXISTS recordatorio_1_at timestamptz,
  ADD COLUMN IF NOT EXISTS recordatorio_2_at timestamptz;

-- MUY IMPORTANTE: marca todos los carritos que ya existen como "atendidos".
-- Sin esto, al activar el flujo se escribiría a visitantes antiguos.
UPDATE public.carritos
   SET recordatorio_1_at = COALESCE(recordatorio_1_at, now()),
       recordatorio_2_at = COALESCE(recordatorio_2_at, now())
 WHERE recordatorio_1_at IS NULL OR recordatorio_2_at IS NULL;

-- Índice parcial: el sondeo de n8n solo mira carritos aún abiertos.
CREATE INDEX IF NOT EXISTS carritos_recordatorio_pendiente_idx
  ON public.carritos (last_activity_at)
  WHERE estado IN ('activo', 'contactado') AND recordatorio_2_at IS NULL;
