-- Segmentación de clientes en la captura de leads.
--   segmento: «¿para qué es?» (lo elige el cliente en la portada y en los formularios)
--   ambiente: sala, comedor, recámara… (lo elige en «A medida» o en el formulario)
-- Ambos son opcionales: un lead sin segmento sigue siendo válido. Los valores permitidos deben
-- coincidir con src/lib/segmentos.ts (SEGMENTO_IDS y AMBIENTE_IDS).
-- Si esta migración aún no se aplicó, el front reintenta el envío sin estos campos (no se pierden leads).

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS segmento TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ambiente TEXT;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_segmento_valido;
ALTER TABLE public.leads ADD CONSTRAINT leads_segmento_valido CHECK (
  segmento IS NULL OR segmento IN
    ('primer-hogar', 'familia', 'remodelacion', 'regalo', 'negocio', 'proyecto')
);

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_ambiente_valido;
ALTER TABLE public.leads ADD CONSTRAINT leads_ambiente_valido CHECK (
  ambiente IS NULL OR ambiente IN ('sala', 'comedor', 'recamara', 'separador', 'otro')
);

CREATE INDEX IF NOT EXISTS leads_segmento_idx ON public.leads (segmento) WHERE segmento IS NOT NULL;

COMMENT ON COLUMN public.leads.segmento IS 'Para qué compra: primer-hogar | familia | remodelacion | regalo | negocio | proyecto';
COMMENT ON COLUMN public.leads.ambiente IS 'Ambiente a amueblar: sala | comedor | recamara | separador | otro';
