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

---
# PROPUESTA D1/D2 — Opciones por producto (modelo "completo")
Estado: **diseño, pendiente de aprobación. Sin código.** Reglas: migraciones idempotentes, RLS con `has_role()`, RPC `SECURITY DEFINER`, sin dependencias nuevas.

## Tablas nuevas
**`producto_opcion_grupos`**: id, product_id (FK), tipo (`color` | `tapizado` | `firmeza` | `patas` | otro), etiqueta, obligatorio (bool), orden.
**`producto_opcion_valores`**: id, grupo_id (FK), valor, descripcion, material, cuidado, hex, image_url, ajuste_precio (numeric, default 0), es_default (bool), activo (bool), orden.
- Lectura pública solo de activos; escritura solo admin (`has_role`).

## Cambios en tablas existentes
**`order_items`**: `opciones jsonb` (foto fija: tipo, valor, material, ajuste, valor_id) y `precio_opciones numeric default 0`. El `title` queda como respaldo (pedidos antiguos).

## Reglas
- Precio unitario = precio base/oferta + suma de `ajuste_precio` de las opciones válidas, calculado SIEMPRE en el servidor. El cliente solo envía ids de valores.
- El servidor valida que cada valor pertenezca al producto y esté activo, arma el `title` y el `opciones` snapshot (deja de confiar en el `title` del navegador).
- Stock: se mantiene a nivel de producto (sin stock por variante) en esta etapa.
- Imágenes: `image_url` del valor reemplaza al mapa `fotoColores` por índice de foto, que queda como respaldo.
- Materiales: el tapizado elegido (material, cuidado) tiene prioridad sobre el texto por categoría de `productProfiles.ts`, que queda como respaldo. Corrige casos como Imperial cuero vs. Velvet.

## Frontend
- `cartStore`: cada línea tiene `lineId` = id de producto + ids de valores ordenados; `addItem`, `updateQty` y `removeItem` pasan a usar `lineId`. Carritos guardados sin `lineId` usan su `id` (migración por `version` de zustand).
- Ficha de producto: lee opciones de la BD; si el producto no tiene, usa las listas fijas actuales (Suave/Equilibrado/Firme; Dorado/Negro).
- Mis pedidos y `OrdenCard`: muestran `opciones` como etiquetas; si es nulo, muestran `title`.
- `PasosFabricacion`: detecta tapizado por la opción `tapizado`, no por palabras del título.
- Vista del carpintero (`v_mi_produccion`): hay que exponer `opciones`. Antes se extrae su definición con `pg_get_functiondef()` porque no está versionada.

## Fases (se aprueba cada una)
1. **BD:** migración con tablas, columnas y RLS (sin cambios visibles). Script para extraer `v_mi_produccion`.
2. **Servidor:** validación, precio, snapshot y `title` en `server/pagos.js` e `index.js`. Compatible con el formato antiguo.
3. **Carrito y ficha:** `lineId` y lectura de opciones con respaldo.
4. **Visualización:** Mis pedidos, `OrdenCard`, `v_mi_produccion`, `PasosFabricacion`.
5. **Admin y datos:** editor de opciones en el panel y carga de datos reales (plantilla CSV para el dueño).

## Puntos de atención
- Fiscal: el `ajuste_precio` cambia el total antes de la fórmula base = total/1.18; no se toca el IGV, pero se mostrará la fórmula antes de aplicar.
- RLS nuevas: requieren confirmación del dueño antes de ejecutarse.
- Combos: sus piezas entran sin opciones; falta definir si eligen opciones.

---
# ESTADO ACTUAL (2026-11-05)

## Opciones por producto (D1/D2)
- Fases 1–4 del diseño anterior implementadas en el repo (fases 1 y 2 reportadas como culminadas por el dueño). `v_mi_produccion` no requirió cambios.
- Fase 5 (editor admin + datos reales con plantilla CSV): pendiente de verificar.

## `products` — columnas reales (consulta del dueño, 2026-11-05)
id, nombre, descripcion, sku, precio, stock, categoria, imagen_url, imagen_public_id, activo, created_at, updated_at, proveedor_id, modelo_3d_url, imagenes (jsonb), subcategoria, material_base, tipo_gestion (enum), descuento_porcentaje, oferta_vence_el, volumen_m3, peso_kg.

## Propuesta D7 (no aplicada; requiere migración y aprobación)
`products`: `alto_cm`, `ancho_cm`, `fondo_cm` (numeric, opcionales, > 0), `plazas` (smallint, opcional, ≥ 1), `esquema_url` (text). Sin cambios de RLS (la lectura pública de `products` ya existe). Si una misma ficha tiene tallas con medidas distintas, haría falta una tabla de variantes; por definir con el dueño.

## Notas
- `src/integrations/supabase/types.ts` está en UTF-16 (no compila como TS) y no refleja las tablas nuevas: el front consulta esas tablas con el cliente sin tipar.
## Reacciones a proyectos (2026-11-05) — migración lista, sin ejecutar
- `proyecto_reacciones(id, proyecto_id → proyectos, user_id → auth.users default auth.uid(), tipo, created_at)`; `tipo` ∈ `me_gusta | me_encanta | impresionante | lo_quiero`; única `(proyecto_id, user_id)`.
- RLS (authenticated): select/update propios; insert con `user_id = auth.uid()`; delete propio o admin (`has_role`). Anónimos no escriben ni leen filas.
- Vista `v_proyecto_reacciones_conteo(proyecto_id, tipo, total)`: lectura pública (anon y authenticated), corre con permisos del dueño a propósito para exponer solo conteos.
- Supuesto: `proyectos.id` es `uuid` (lo valida `proyectos.functions.ts`). La tabla `proyectos` no tiene migración en el repo: verificar `\d proyectos` antes de ejecutar.

## Estado D7 (2026-11-05)
- Decisión: sin tallas; cada producto tiene una o más **piezas**, cada una con sus medidas y plazas.
- `products.piezas jsonb` (opcional, debe ser un arreglo): `[{"nombre":"Sofá 3 plazas","alto_cm":85,"ancho_cm":210,"fondo_cm":95,"plazas":3}]`. La validación de cada pieza vive en el front (`src/lib/piezas.ts`) y en el futuro editor del admin; la BD solo exige que sea un arreglo. Migración `20261105_piezas_producto.sql` (con rollback y verificación): entregada, **ejecución sin confirmar**.
- `products.esquema_url` (text, URL https de Cloudinary): creada con `20261105_medidas_producto.sql`, ejecutada y verificada por el dueño.
- `products.alto_cm`, `ancho_cm`, `fondo_cm`, `plazas` (de la misma migración, todas en NULL): quedan **sin uso**; eliminarlas está pendiente de aprobación.
- Las migraciones se corrieron en el SQL Editor y no están en `supabase/migrations/` del repo.

## Función `fabricar_mrp` (2026-11-08)
- Archivo: `supabase/migrations/20261108_fabricar_mrp.sql` (**ejecutar en el SQL Editor**, igual que las demás migraciones). No crea tablas ni columnas ni políticas.
- `SECURITY INVOKER` (RLS del usuario que llama). `GRANT EXECUTE` solo a `authenticated`; `REVOKE` a `PUBLIC`.
- Entrada: `_order_number` (clave de idempotencia), `_descripcion`, `_insumos` (`[{"insumo_id","cantidad"}]`), `_carpintero_id`, `_observaciones`, `_fecha_fin_estimada`, `_prioridad`.
- Efecto: `orders` (interna, `[MRP] <descripcion>`) + `produccion` + `order_items` (1 fila) + `insumo_movimientos` (`salida`, referencia = `order_number`). El trigger `actualizar_stock_insumo` descuenta el stock.
- Errores: «Stock insuficiente: …», «Insumo no encontrado o sin acceso: …», «El número de orden … ya está en uso por otra orden», «Datos inválidos en los insumos».
