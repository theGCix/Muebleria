# MODULES — Módulos relevantes (Parte 3/8)

> Rutas por verificar en el repo; lo siguiente es la lista de lo que se debe inspeccionar, no hallazgos.

## Footer / Legal (T1)
- Componente de footer y layout raíz.
- Páginas legales: términos, privacidad, libro de reclamaciones (existencia por confirmar).
- Config de contacto/redes (¿constantes o tabla en Supabase?).

## Catálogo y detalle de producto (D1, D2, H1, H2)
- Ruta de detalle de producto y selectores de opciones (color, firmeza, patas, tapizado).
- Tarjetas de producto / listados (badges de stock).
- Hooks de TanStack Query de productos.

## Carrito y checkout (D2)
- Store del carrito (Zustand) y sus ítems: ¿persiste opciones elegidas?
- Creación de pedido (`POST /api/orders` / RPC) y tabla de ítems del pedido.

## Post-venta (D2)
- "Mis pedidos" (cliente).
- "Mis órdenes" / `v_mi_produccion` (carpintero; muestra BOM).

## Stock (H1)
- Stock por almacén/ubicación; diferenciación retail vs manufactura (backorder).

## Imágenes (H2)
- Cloudinary: URLs por producto; tabla de imágenes de producto.

---
## Hallazgos verificados en el repo (commit 7cd97c0, 2026-11-04)

**T1 Footer/legal**
- `src/components/Footer.tsx`: columnas Empresa y Legal (Términos, Privacidad, Envíos, Libro de Reclamaciones), redes e © año. NO tiene: dirección, horarios, WhatsApp/teléfono, logos de pago.
- `src/config.ts`: `LIBRO_RECLAMACIONES_URL`, `EMPRESA {razonSocial, ruc, direccion, email}`, `REDES`, `WHATSAPP_NUMBER`; todo vacío en el repo, se llena por variables VITE_* en Render (valores no visibles desde el repo). Lo vacío no se muestra.
- `src/routes/privacidad.tsx` (123 líneas): borrador con aviso "revísalo con un abogado"; sección de derechos (Ley 29733) usa `EMPRESA.email`. `src/components/LegalPage.tsx` → `DatosEmpresa`.
- `src/routes/terminos.tsx`, `src/routes/envios.tsx`, `src/components/checkout/TerminosCheckout.tsx`.

**D1 Materiales**
- Los materiales/tapizados NO están por producto: son texto fijo por categoría en `src/lib/productProfiles.ts` (`resolveProfile` por categoría/nombre). Ej.: perfil `sala` → "Velvet importado + antifluida" (aplica a todo lo de categoría `muebles`).
- `ProductDetail.tsx` repite textos de materiales y cuidado ("Para el velvet…") por su cuenta (posible duplicado/inconsistencia con productProfiles).
- `products` tiene `material_base`, `subcategoria`, `categoria` (solo para filtrar), sin columnas de tapizado/opciones.

**D2 Opciones y pedidos**
- Firmeza y patas: listas fijas en `SignatureModules.tsx`; se guardan con `setPref` en `product.$handle.tsx`.
- Las opciones viajan SOLO como texto dentro de `title` del ítem: `"Nombre (Color, Firmeza, Patas)"`.
- `cartStore.ts`: ítem identificado solo por `id` de producto; al agregar el mismo producto con otra opción se suma `qty` y se pierde la segunda opción.
- Servidor (`server/pagos.js` `calcularPedido`): precio siempre de la BD; las opciones no alteran precio. `title` viene del navegador (`...it`).
- `order_items` guarda `title` e `image_url`, sin columna de opciones.
- Mis pedidos (`perfil/pedidos.tsx`) y carpintero (`OrdenCard.tsx`) muestran `title`. `PasosFabricacion.tsx` detecta tapizado con `title.includes("sofá"/"silla"/"sillon")`.

**H1 Stock**
- `ProductCard.tsx`: `UMBRAL_STOCK = 5`, con oferta `UMBRAL_STOCK_OFERTA = 10`.
- `product/LivePrice.tsx`: urgencia con `stock <= 5` ("Quedan N unidades listas").
- No existe campo "bajo pedido" en el front: todo el copy dice "fabricado a pedido".
- No hay seed/migración en el repo que fije stock=5; el valor vive en Supabase.