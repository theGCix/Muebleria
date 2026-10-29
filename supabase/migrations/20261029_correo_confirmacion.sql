-- Control de envío del correo de confirmación de pago (lo usa el flujo de n8n).
-- n8n busca pedidos pagados con correo_confirmacion_enviado_at NULL, envía el correo y lo marca.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS correo_confirmacion_enviado_at timestamptz;

-- MUY IMPORTANTE: marca todos los pedidos que ya existen como "avisados".
-- Sin esto, al activar el flujo se enviaría un correo de confirmación a clientes de pedidos antiguos.
UPDATE public.orders
   SET correo_confirmacion_enviado_at = now()
 WHERE correo_confirmacion_enviado_at IS NULL;
