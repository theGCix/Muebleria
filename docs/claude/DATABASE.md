# DATABASE — Supabase (PostgreSQL)

> Sin esquema verificado aún. Pendiente: revisar migraciones en `supabase/migrations/` y extraer objetos no versionados.

## Convenciones conocidas
- Migraciones idempotentes (`CREATE OR REPLACE`, `IF NOT EXISTS`).
- RLS con helper `has_role()`.
- RPCs `SECURITY DEFINER`.
- RPCs creados en SQL Editor y no versionados (`recibir_orden_compra`, `cambiar_estado_pedido`, `v_mi_produccion`): extraer con `pg_get_functiondef()` antes de modificar.

## Por investigar (D1/D2/H1)
- Dónde viven materiales/tapizados/opciones por producto (columnas, JSON, tablas).
- Cómo se guardan color/firmeza/patas en ítems de carrito y de pedido.
- Origen del stock "5 unidades" (¿seed/migración/dato por defecto?).

## Propuesta preliminar (D1) — a validar tras inspección
Estructura por producto, p. ej.: tabla de opciones (tipo: tapizado/color/firmeza/patas), valores con atributos (material, tratamiento), ajuste de precio, imagen asociada y disponibilidad. Se definirá tras ver el esquema real.
