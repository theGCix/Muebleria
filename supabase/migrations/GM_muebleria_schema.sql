-- ============================================================
-- G&M Mueblería — Schema: Pedidos + Pipeline de Producción
-- PostgreSQL 14+
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USUARIOS Y CLIENTES
-- ============================================================

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      VARCHAR(120) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol         VARCHAR(30) NOT NULL DEFAULT 'cliente'
                CHECK (rol IN ('admin', 'carpintero', 'vendedor', 'cliente')),
  activo      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clientes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  nombre      VARCHAR(120) NOT NULL,          -- puede ser diferente al user
  email       VARCHAR(255),
  telefono    VARCHAR(20),
  direccion   TEXT,
  distrito    VARCHAR(80),
  segmento    VARCHAR(20) DEFAULT 'nuevo'
                CHECK (segmento IN ('nuevo', 'recurrente', 'vip', 'inactivo')),
  notas       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATÁLOGO DE PRODUCTOS
-- ============================================================

CREATE TABLE categorias (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      VARCHAR(80) NOT NULL,
  descripcion TEXT
);

CREATE TABLE productos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  categoria_id  UUID REFERENCES categorias(id),
  nombre        VARCHAR(150) NOT NULL,
  descripcion   TEXT,
  precio_base   DECIMAL(10,2) NOT NULL,
  tiempo_prod_dias INTEGER DEFAULT 7,        -- días estimados de fabricación
  permite_personalizar BOOLEAN DEFAULT TRUE,
  activo        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PEDIDOS
-- ============================================================

CREATE TYPE estado_pedido AS ENUM (
  'pendiente',
  'aprobado',
  'en_produccion',
  'control_calidad',
  'listo_despacho',
  'en_camino',
  'entregado',
  'cancelado'
);

CREATE TABLE pedidos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_pedido     VARCHAR(20) UNIQUE NOT NULL,  -- ej: GM-2024-0042
  cliente_id        UUID NOT NULL REFERENCES clientes(id),
  estado            estado_pedido NOT NULL DEFAULT 'pendiente',
  
  -- Totales
  subtotal          DECIMAL(10,2) NOT NULL DEFAULT 0,
  descuento         DECIMAL(10,2) DEFAULT 0,
  igv               DECIMAL(10,2) DEFAULT 0,      -- 18% en Perú
  total             DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Entrega
  tipo_entrega      VARCHAR(20) DEFAULT 'delivery'
                      CHECK (tipo_entrega IN ('delivery', 'recojo_tienda')),
  direccion_entrega TEXT,
  fecha_entrega_est DATE,
  fecha_entrega_real DATE,
  
  -- Pago
  estado_pago       VARCHAR(20) DEFAULT 'pendiente'
                      CHECK (estado_pago IN ('pendiente', 'parcial', 'pagado', 'reembolsado')),
  metodo_pago       VARCHAR(30),               -- culqi, transferencia, efectivo
  referencia_pago   VARCHAR(100),              -- ID de transacción Culqi
  
  notas_cliente     TEXT,
  notas_internas    TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Generar número de pedido automáticamente
CREATE SEQUENCE pedido_seq START 1;

CREATE OR REPLACE FUNCTION generar_numero_pedido()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero_pedido := 'GM-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
                       LPAD(nextval('pedido_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_numero_pedido
  BEFORE INSERT ON pedidos
  FOR EACH ROW EXECUTE FUNCTION generar_numero_pedido();

-- ============================================================
-- ÍTEMS DEL PEDIDO
-- ============================================================

CREATE TABLE pedido_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id       UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id     UUID REFERENCES productos(id),
  
  nombre_producto VARCHAR(150) NOT NULL,      -- snapshot del nombre al momento del pedido
  cantidad        INTEGER NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal        DECIMAL(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  
  -- Personalización del cliente
  personalizacion JSONB DEFAULT '{}',
  -- Ejemplo: {"madera": "cedro", "acabado": "barniz mate", "medidas": "1.80x0.90"}
  
  notas           TEXT
);

-- Recalcular totales del pedido al insertar/actualizar ítems
CREATE OR REPLACE FUNCTION recalcular_totales_pedido()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
  FROM pedido_items
  WHERE pedido_id = COALESCE(NEW.pedido_id, OLD.pedido_id);
  
  UPDATE pedidos SET
    subtotal   = v_subtotal,
    igv        = ROUND(v_subtotal * 0.18, 2),
    total      = ROUND(v_subtotal * 1.18, 2),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.pedido_id, OLD.pedido_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_totales_pedido
  AFTER INSERT OR UPDATE OR DELETE ON pedido_items
  FOR EACH ROW EXECUTE FUNCTION recalcular_totales_pedido();

-- ============================================================
-- PRODUCCIÓN
-- ============================================================

CREATE TYPE estado_produccion AS ENUM (
  'pendiente',
  'en_proceso',
  'pausado',
  'terminado',
  'rechazado_calidad'
);

CREATE TABLE produccion (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id       UUID NOT NULL REFERENCES pedidos(id),
  asignado_a      UUID REFERENCES users(id),     -- carpintero responsable
  
  estado          estado_produccion DEFAULT 'pendiente',
  prioridad       SMALLINT DEFAULT 2             -- 1=alta, 2=normal, 3=baja
                    CHECK (prioridad BETWEEN 1 AND 3),
  
  fecha_inicio    DATE,
  fecha_fin_est   DATE,
  fecha_fin_real  DATE,
  
  -- Control de calidad
  calidad_aprobada    BOOLEAN,
  calidad_revisado_por UUID REFERENCES users(id),
  calidad_notas       TEXT,
  
  observaciones   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HISTORIAL DE ESTADOS (auditoría completa)
-- ============================================================

CREATE TABLE estado_historial (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id       UUID NOT NULL REFERENCES pedidos(id),
  estado_anterior estado_pedido,
  estado_nuevo    estado_pedido NOT NULL,
  cambiado_por    UUID REFERENCES users(id),
  motivo          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Registrar automáticamente cada cambio de estado
CREATE OR REPLACE FUNCTION registrar_cambio_estado()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    INSERT INTO estado_historial (pedido_id, estado_anterior, estado_nuevo)
    VALUES (NEW.id, OLD.estado, NEW.estado);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_historial_estado
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION registrar_cambio_estado();

-- ============================================================
-- NOTIFICACIONES
-- ============================================================

CREATE TABLE notificaciones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id   UUID REFERENCES pedidos(id),
  cliente_id  UUID REFERENCES clientes(id),
  tipo        VARCHAR(40) NOT NULL,
  -- 'pedido_confirmado' | 'en_produccion' | 'listo_despacho' | 'entregado' | 'solicitud_resena'
  canal       VARCHAR(20) DEFAULT 'email'
                CHECK (canal IN ('email', 'sms', 'whatsapp')),
  asunto      VARCHAR(255),
  mensaje     TEXT,
  enviado     BOOLEAN DEFAULT FALSE,
  enviado_at  TIMESTAMPTZ,
  error       TEXT,                              -- guardar error si falla el envío
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_pedidos_cliente    ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_estado     ON pedidos(estado);
CREATE INDEX idx_pedidos_fecha      ON pedidos(created_at DESC);
CREATE INDEX idx_pedido_items_ped   ON pedido_items(pedido_id);
CREATE INDEX idx_produccion_pedido  ON produccion(pedido_id);
CREATE INDEX idx_produccion_asig    ON produccion(asignado_a);
CREATE INDEX idx_historial_pedido   ON estado_historial(pedido_id);
CREATE INDEX idx_notif_pedido       ON notificaciones(pedido_id);
CREATE INDEX idx_notif_enviado      ON notificaciones(enviado) WHERE enviado = FALSE;

-- ============================================================
-- VISTAS ÚTILES
-- ============================================================

-- Vista del panel admin: todos los pedidos activos con info de cliente
CREATE VIEW v_pedidos_activos AS
SELECT
  p.id,
  p.numero_pedido,
  p.estado,
  p.total,
  p.fecha_entrega_est,
  p.created_at,
  c.nombre  AS cliente_nombre,
  c.telefono AS cliente_tel,
  pr.estado AS estado_produccion,
  u.nombre  AS carpintero
FROM pedidos p
JOIN clientes c ON c.id = p.cliente_id
LEFT JOIN produccion pr ON pr.pedido_id = p.id
LEFT JOIN users u ON u.id = pr.asignado_a
WHERE p.estado NOT IN ('entregado', 'cancelado')
ORDER BY p.fecha_entrega_est ASC NULLS LAST;

-- Vista del dashboard de producción
CREATE VIEW v_produccion_hoy AS
SELECT
  pr.id,
  p.numero_pedido,
  c.nombre AS cliente,
  pr.estado,
  pr.prioridad,
  pr.fecha_fin_est,
  u.nombre AS carpintero,
  COUNT(pi.id) AS num_items
FROM produccion pr
JOIN pedidos p ON p.id = pr.pedido_id
JOIN clientes c ON c.id = p.cliente_id
LEFT JOIN users u ON u.id = pr.asignado_a
LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
WHERE pr.estado IN ('pendiente', 'en_proceso')
GROUP BY pr.id, p.numero_pedido, c.nombre, pr.estado, pr.prioridad, pr.fecha_fin_est, u.nombre
ORDER BY pr.prioridad ASC, pr.fecha_fin_est ASC;