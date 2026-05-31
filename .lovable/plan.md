## Fase 1 — Sistema POS para Mueblería G&M

Construiré un sistema POS interno con login, roles y dashboard, manteniendo la web pública actual que vende vía Shopify. Los productos se leen desde Shopify (fuente única de verdad del catálogo); las ventas, usuarios y reportes viven en Lovable Cloud.

### 1. Backend (Lovable Cloud)

Habilitaré Lovable Cloud y crearé estas tablas:

- `profiles` — datos de cada usuario logueado (nombre, teléfono, link a `auth.users`).
- `user_roles` — tabla separada con enum `app_role` (`admin`, `vendedor`, `cliente`) + función `has_role()` SECURITY DEFINER (evita escalada de privilegios).
- `customers` — clientes finales (pueden o no tener login). Campos: nombre, documento (DNI/RUC), tipo_doc, email, teléfono, dirección, `user_id` opcional para portal.
- `sales` — venta/boleta. Campos: número correlativo, vendedor_id, customer_id, tipo (boleta/factura/nota), subtotal, igv, total, método_pago, estado, fecha.
- `sale_items` — líneas: sale_id, shopify_product_id, shopify_variant_id, title, sku, qty, unit_price, total.

RLS:
- Admin ve y edita todo.
- Vendedor: ve sus propias ventas, las crea, ve clientes.
- Cliente (rol futuro): ve solo sus propias ventas/boletas.

Todas las tablas con GRANTs explícitos a `authenticated` y `service_role`.

### 2. Autenticación

- Login con email + contraseña (Lovable Cloud Auth).
- Página `/login` pública.
- Layout protegido `_authenticated` que redirige a `/login` si no hay sesión.
- Trigger en `auth.users` que crea `profiles` y asigna rol `vendedor` por defecto (admin lo cambia luego).
- Primer usuario que se registre se marca como `admin` automáticamente (bootstrap).

### 3. Sistema POS (`/pos`)

Pantalla tipo terminal de venta:
- Búsqueda de productos desde Shopify (Storefront API ya integrada) por título/SKU.
- Carrito de venta lateral con cantidad, precio editable, descuento por línea.
- Selector de cliente (buscar por DNI/RUC o crear nuevo en modal).
- Selector tipo comprobante: Boleta / Factura / Nota de venta.
- Método de pago: efectivo / tarjeta / transferencia / Yape-Plin.
- Cálculo automático de IGV 18% (Perú).
- Botón "Cobrar" que guarda la venta y genera PDF de comprobante interno (sin SUNAT en esta fase).

### 4. Dashboard (`/dashboard`)

KPIs y gráficos (recharts):
- Ventas hoy / semana / mes / trimestre / año (con comparativa).
- Top 10 productos más vendidos (período seleccionable).
- Top vendedor del período.
- Top cliente del período.
- Gráfico de barras de ventas por mes (últimos 12).
- Gráfico de líneas de ventas por trimestre.
- Tabla de últimas 10 ventas con link al detalle.

Vendedor ve una versión recortada (solo sus propios números y comisiones); admin ve todo.

### 5. Gestión

- `/admin/usuarios` — admin: lista de usuarios, cambio de rol, alta de nuevos vendedores.
- `/admin/clientes` — CRUD de clientes.
- `/admin/ventas` — lista filtrable con detalle e impresión.
- `/admin/productos` — lectura desde Shopify con link al admin de Shopify para editar (no duplicamos catálogo).

### 6. Navegación y diseño

- Header del POS con sidebar colapsable (shadcn sidebar) con secciones: POS, Dashboard, Ventas, Clientes, Productos, Usuarios.
- Mantengo la estética actual de madera cálida pero el área `/app/*` usa una variante más limpia/clara optimizada para uso intensivo: tipografía Inter, bordes redondeados suaves, sombras sutiles, mucho whitespace, hover states en todos los botones.
- 100% responsive: el POS funciona en tablet (caso de uso típico en tienda).
- Footer global con enlaces legales (Términos, Privacidad) y redes sociales.

### 7. Diferido a Fase 2 (no incluido ahora)

- Integración SUNAT vía Nubefact/Apisperu (facturación electrónica real, XML firmado, envío y CDR).
- Guía de remisión electrónica.
- Portal de cliente (`/mi-cuenta`) con historial y descarga de boletas.
- Comisiones automáticas por vendedor configurables.

### Detalles técnicos

- Stack: TanStack Start + Lovable Cloud (Supabase). Server functions con `requireSupabaseAuth` para todas las mutaciones.
- Las ventas se crean en una server function transaccional que inserta `sales` + `sale_items` y devuelve el número correlativo.
- Numeración de boletas: secuencia Postgres por tipo de comprobante (`B001-00000001`, `F001-00000001`).
- PDFs generados client-side con `jspdf` para Fase 1 (sin firma digital).
- Productos de Shopify se cachean con TanStack Query; el POS los lee directamente, sin duplicar a Cloud.

¿Procedo con esta Fase 1?