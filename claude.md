# 1 Módulo Ecommerce & Catálogo — Guía de Implementación
**G&M Mueblería** · Stack: React + TanStack Router + Supabase + Cloudinary + Zustand

---

## Resumen del módulo

El módulo de Ecommerce & Catálogo está **completamente construido** en el proyecto. Cubre:

| Funcionalidad | Archivo(s) |
|---|---|
| Homepage (Hero + Categorías + Catálogo + Testimonios + Footer) | `src/routes/index.tsx` |
| Listado de productos con búsqueda | `src/components/ProductsSection.tsx` |
| Tarjeta de producto | `src/components/ProductCard.tsx` |
| Página detalle de producto | `src/routes/product.$handle.tsx` |
| Carrito de compras (drawer) | `src/components/CartDrawer.tsx` |
| Checkout con Niubiz | `src/routes/checkout.tsx` ← **no tocar** |
| Login / Registro modal | `src/components/LoginModal.tsx` |
| Perfil y historial de pedidos | `src/routes/perfil.tsx` |
| Header con nav + carrito + auth | `src/components/Header.tsx` |

---

## 1. Variables de entorno

Crea o actualiza tu `.env` con estos valores (ya presentes en el `.env` del proyecto):

```env
# Entorno
VITE_ENV=prod                          # "local" para desarrollo

# URLs
VITE_APP_URL_LOCAL=http://localhost:5173
VITE_API_URL_LOCAL=http://localhost:3001
VITE_APP_URL_PROD=https://muebleria-q74c.onrender.com
VITE_API_URL_PROD=https://muebleria-api.onrender.com
FRONTEND_URL=https://muebleria-q74c.onrender.com

# Supabase (frontend)
VITE_SUPABASE_URL=https://ckgaipbgyyvvqctehyvi.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...  # anon key

# Supabase (servidor Express — nunca al browser)
SUPABASE_URL=https://ckgaipbgyyvvqctehyvi.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...

# Cloudinary
VITE_CLOUDINARY_CLOUD_NAME=deq1nvaqb
VITE_CLOUDINARY_API_KEY=591435747597739
VITE_CLOUDINARY_UPLOAD_PRESET=muebleria_unsigned
CLOUDINARY_API_SECRET=...
```

> ⚠️ Las variables `NIUBIZ_*` ya existen en tu servidor Express. No hace falta añadirlas aquí.

---

## 2. Base de datos — Migraciones

Ejecuta las migraciones en este orden desde el panel de Supabase (SQL Editor) o con `supabase db push`:

### 2.1 Tabla `products` (catálogo + Cloudinary)
```
supabase/migrations/20260530_products_cloudinary.sql
```

Crea la tabla `public.products` con:
- `id`, `nombre`, `descripcion`, `sku`, `precio`, `stock`, `categoria`
- `imagen_url` (URL directa) y `imagen_public_id` (Cloudinary public_id)
- `activo` (boolean) — solo productos activos son visibles al público
- RLS habilitado: público puede leer productos activos; staff puede hacer CRUD

### 2.2 Tablas de pedidos (ecommerce)
```
supabase/migrations/20260530_orders_ecommerce.sql
```

Crea:
- `public.orders` — pedido con campos de envío, totales y campos Niubiz (`niubiz_session_key`, `niubiz_token`, `niubiz_auth_code`, `niubiz_ref_code`)
- `public.order_items` — ítems de cada pedido
- RLS: anon puede crear pedidos (necesario para el flujo Niubiz); staff ve y actualiza todo

### 2.3 Tablas de producción adicionales
```
supabase/migrations/20260605b_produccion_tablas.sql
supabase/migrations/20260605_produccion_pipeline.sql
```

---

## 3. Estructura de archivos a implementar

```
src/
├── routes/
│   ├── __root.tsx              # Shell: QueryClientProvider + Toaster + useCartSync
│   ├── index.tsx               # Homepage pública (/)
│   ├── product.$handle.tsx     # Detalle de producto (/product/:id)
│   ├── checkout.tsx            # Checkout con Niubiz — NO MODIFICAR
│   ├── perfil.tsx              # Perfil y pedidos del cliente (/perfil)
│   └── login.tsx               # Página de login alternativa (/login)
├── components/
│   ├── Header.tsx              # Nav + carrito + auth
│   ├── Hero.tsx                # Banner principal
│   ├── Categories.tsx          # Grid de 4 categorías
│   ├── ProductsSection.tsx     # Catálogo con búsqueda
│   ├── ProductCard.tsx         # Tarjeta de producto
│   ├── CartDrawer.tsx          # Sheet lateral del carrito
│   ├── Testimonials.tsx        # Sección de reseñas
│   ├── Footer.tsx              # Pie de página
│   └── LoginModal.tsx          # Dialog login/registro
├── hooks/
│   ├── useProducts.ts          # React Query: listado y detalle de productos
│   ├── useAuth.ts              # Estado de sesión + roles
│   └── useCartSync.ts          # Stub de sincronización de carrito
├── stores/
│   └── cartStore.ts            # Zustand + persist (localStorage key: "gm-cart")
├── integrations/supabase/
│   ├── client.ts               # Cliente Supabase (singleton con Proxy)
│   └── types.ts                # Tipos generados
├── lib/
│   ├── cloudinary.ts           # uploadImage() + cloudinaryUrl()
│   └── config.server.ts        # Config del servidor (nunca al browser)
├── config.ts                   # API_URL y APP_URL según VITE_ENV
└── styles.css                  # Design system (tokens oklch)
```

---

## 4. Dependencias NPM

Todas ya están en `package.json`. Para instalar:

```bash
bun install
# o
npm install
```

Paquetes clave del módulo:

| Paquete | Uso |
|---|---|
| `@tanstack/react-router` | File-based routing |
| `@tanstack/react-query` | Fetching y caché de productos |
| `@supabase/supabase-js` | Auth + DB |
| `zustand` + `persist` | Carrito con localStorage |
| `sonner` | Toasts |
| `lucide-react` | Iconos |

---

## 5. Flujo de datos por funcionalidad

### 5.1 Catálogo de productos

```
Supabase (tabla products, activo=true)
    ↓  useProducts(limit, searchTerm)   [React Query]
ProductsSection → grid de ProductCard
    ↓  click "Agregar"
cartStore.addItem()                     [Zustand + persist]
    ↓
CartDrawer (badge actualizado en Header)
```

**Hook `useProducts`:**
```ts
// src/hooks/useProducts.ts
useProducts(first = 12, search?: string)
// Filtra por nombre o categoria usando ilike
// Ordena por created_at DESC
```

### 5.2 Página de detalle

```
/product/:id
    ↓  useProduct(id)
ProductPage (imagen Cloudinary o imagen_url)
    ↓  click "Agregar al carrito"
cartStore.addItem({ id, title, price, image, sku })
toast.success(...)
```

La ruta usa el `id` del producto como `handle`:
```ts
// product.$handle.tsx
const { handle } = Route.useParams(); // handle == product UUID
```

### 5.3 Imágenes con Cloudinary

```ts
// Prioridad: imagen_public_id (Cloudinary) > imagen_url (URL directa)
const imgSrc = product.imagen_public_id
  ? cloudinaryUrl(product.imagen_public_id, { w: 400, h: 300 })
  : product.imagen_url;

// cloudinaryUrl genera:
// https://res.cloudinary.com/{CLOUD_NAME}/image/upload/w_400,q_80,f_auto,h_300/{publicId}
```

Para subir imágenes desde el panel admin:
```ts
import { uploadImage } from "@/lib/cloudinary";
const result = await uploadImage(file, "muebleria/productos");
// result.public_id  → guardar en products.imagen_public_id
// result.secure_url → guardar en products.imagen_url (opcional)
```

### 5.4 Autenticación

```
LoginModal (Dialog)
├── Email + password  → supabase.auth.signInWithPassword()
├── Registro          → supabase.auth.signUp()
├── Google OAuth      → supabase.auth.signInWithOAuth({ provider: "google" })
└── Facebook OAuth    → supabase.auth.signInWithOAuth({ provider: "facebook" })

useAuth() → { user, session, roles[], loading }
roles: "admin" | "vendedor" | "cliente"  (tabla user_roles)
```

**Configurar OAuth en Supabase:**
1. Supabase Dashboard → Authentication → Providers
2. Habilitar Google y Facebook con sus Client ID/Secret
3. Redirect URL: `https://ckgaipbgyyvvqctehyvi.supabase.co/auth/v1/callback`

### 5.5 Carrito (Zustand)

```ts
// src/stores/cartStore.ts
const { items, addItem, removeItem, updateQty, clearCart, total } = useCartStore();

// Persiste en localStorage con key "gm-cart"
// total() es una función (no valor reactivo):
const totalAmount = total(); // llamar como función
```

### 5.6 Checkout → Niubiz (NO MODIFICAR)

El flujo ya está implementado y funcionando:
1. `CartDrawer` → requiere login → redirige a `/checkout`
2. `/checkout` → llama a `POST /api/niubiz/session` (servidor Express)
3. Abre popup `VisanetCheckout`
4. Resultado: modal de éxito/error + limpia carrito

---

## 6. Routing (TanStack Router file-based)

El archivo `src/routeTree.gen.ts` se genera automáticamente. **No editar a mano.**

Para agregar una nueva ruta pública (ej. `/contacto`):
```
src/routes/contacto.tsx
```

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/contacto")({
  component: ContactoPage,
});

function ContactoPage() {
  return <div>...</div>;
}
```

Rutas protegidas (solo admin/vendedor) van dentro de `_authenticated/`:
```
src/routes/_authenticated/nueva-ruta.tsx
```

---

## 7. Design System

El tema está definido en `src/styles.css` con tokens CSS oklch.

**Colores principales:**
| Token | Valor | Uso |
|---|---|---|
| `--primary` | `oklch(0.42 0.07 55)` | Botones, CTA |
| `--accent` | `oklch(0.62 0.14 45)` | Highlights, precios |
| `--background` | `oklch(0.985 0.008 80)` | Fondo cálido crema |
| `--card` | `oklch(0.98 0.01 80)` | Tarjetas |
| `--foreground` | `oklch(0.22 0.025 50)` | Texto principal |

**Tipografía:** La clase `font-display` usa la fuente del `@theme`. Para activarla, confirma que tienes la fuente configurada en el `@theme inline` de `styles.css`.

**Gradiente:** `bg-[var(--gradient-warm)]` — disponible en Header logo y Hero.

---

## 8. Configuración de Cloudinary

1. Crear cuenta en [cloudinary.com](https://cloudinary.com)
2. Dashboard → Settings → Upload → Upload presets
3. Crear preset: nombre `muebleria_unsigned`, modo **Unsigned**
4. Copiar **Cloud name** y **API Key** al `.env`

El preset unsigned permite subir imágenes desde el browser sin exponer el API secret.

---

## 9. Levantar el proyecto

```bash
# Desarrollo (frontend + servidor Express en paralelo)
bun run dev
# o
npm run dev

# Esto levanta:
# - Vite en http://localhost:5173
# - Express API en http://localhost:3001
```

Para producción (Render):
- Frontend: servir el `dist/` generado por `vite build`
- Backend: `server/index.js` con las variables de entorno de producción
- Cambiar `VITE_ENV=prod` en el `.env` de Render

---

## 10. Lista de verificación de implementación

### Base de datos
- [ ] Ejecutar migración `products_cloudinary.sql`
- [ ] Ejecutar migración `orders_ecommerce.sql`
- [ ] Ejecutar migraciones de producción (`20260605b_produccion_tablas.sql`, `20260605_produccion_pipeline.sql`)
- [ ] Verificar que la función `has_role()` existe (usada en las policies)
- [ ] Configurar OAuth providers en Supabase (Google, Facebook)

### Cloudinary
- [ ] Crear upload preset `muebleria_unsigned` en modo Unsigned
- [ ] Confirmar `VITE_CLOUDINARY_CLOUD_NAME` y `VITE_CLOUDINARY_API_KEY` en `.env`

### Variables de entorno
- [ ] `.env` con todas las variables listadas en sección 1
- [ ] Para producción: `VITE_ENV=prod` y URLs de Render

### Productos
- [ ] Cargar al menos un producto desde el panel admin (`/productos`)
- [ ] Verificar que `activo = true` para que aparezcan en el catálogo público

### Verificación funcional
- [ ] Homepage carga en `/` con Hero, Categorías, Catálogo, Testimonios
- [ ] Búsqueda de productos filtra en tiempo real
- [ ] Click en producto abre `/product/:id`
- [ ] "Agregar al carrito" actualiza el badge del header
- [ ] CartDrawer muestra ítems, permite modificar cantidad
- [ ] Sin sesión: checkout abre LoginModal
- [ ] Con sesión: checkout redirige a `/checkout` (Niubiz — ya funciona)
- [ ] Perfil `/perfil` muestra historial de pedidos del usuario

---

## 11. Notas importantes

**`useCartStore().total`** es una función, no un valor:
```tsx
// ✅ Correcto
const total = useCartStore((s) => s.total);
const amount = total(); // llamar

// ❌ Incorrecto
const { total } = useCartStore(); // total es función, no número
```

**`product.$handle.tsx`** usa el `id` UUID del producto como handle. Si quieres URLs por slug (`/product/mesa-comedor-roble`), necesitarías agregar un campo `slug` a la tabla y ajustar `useProduct()`.

**RLS en `orders`:** La policy actual permite a `anon` crear pedidos (necesario para que Niubiz pueda registrar la orden). El SELECT está restringido a admin/vendedor. Para que un cliente vea sus propios pedidos en `/perfil`, revisa que existe la policy:
```sql
CREATE POLICY "Cliente ve sus pedidos"
  ON public.orders FOR SELECT TO authenticated
  USING (email = auth.email());
```
Si no existe, agrégala.

**`routeTree.gen.ts`** se regenera automáticamente con `vite dev`. Si ves errores de rutas faltantes, reinicia el servidor de desarrollo.


























































































# 2 Módulo Operaciones y Seguimiento de Pedidos — Guía de Implementación
**G&M Mueblería** · Rutas admin + pipeline de producción + vista cliente

---

## Qué cubre este módulo

| Funcionalidad | Archivo |
|---|---|
| Panel admin de pedidos online con pipeline | `src/routes/_authenticated/pedidos.tsx` |
| Vista de seguimiento del cliente | `src/routes/perfil.tsx` |
| Layout protegido con sidebar | `src/routes/_authenticated.tsx` |
| Sidebar de navegación admin | `src/components/AppSidebar.tsx` |
| Dashboard con KPIs y gráficos | `src/routes/_authenticated/dashboard.tsx` |

**Base de datos:**
| Migración | Qué crea |
|---|---|
| `20260605_produccion_pipeline.sql` (Paso 1) | Extiende `order_status` enum con `en_produccion`, `control_calidad`, `listo_despacho`; añade rol `carpintero` |
| `20260605b_produccion_tablas.sql` (Paso 2) | Tablas `produccion`, `order_estado_historial`, `notificaciones`; función RPC `cambiar_estado_pedido`; vista `v_produccion_panel` |

---

## ⚠️ Problemas detectados que debes corregir antes de implementar

### 1. Columnas faltantes en la tabla `orders`

La ruta `/perfil` consulta `orders.user_id` y `orders.estimated_delivery`, pero la migración original de `orders` (`20260530_orders_ecommerce.sql`) **no incluye esas columnas**. Sin ellas, la query de "Mis pedidos" del cliente no devuelve nada.

Ejecuta en el SQL Editor de Supabase:

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_delivery DATE;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
```

Luego, en el checkout (`src/routes/checkout.tsx`), al crear la orden asegúrate de incluir `user_id`:
```ts
// Dentro del payload que construyes antes de INSERT
user_id: user?.id ?? null,
```

### 2. Mismatch del enum `order_status` entre perfil y pedidos

`perfil.tsx` usa `en_preparacion` (con tilde conceptual, del enum original).  
`pedidos.tsx` y la DB post-migración usan `en_produccion` (nuevo valor del pipeline).

Son **dos valores distintos en el enum**. El cliente ve "En preparación" pero el admin ve "En producción" — aunque ambos mapen al mismo estado real. Necesitas decidir cuál usar y unificar:

**Opción A — usar solo `en_produccion` (recomendado):** Actualiza `perfil.tsx` para reconocer `en_produccion`:

```ts
// src/routes/perfil.tsx — reemplaza el bloque STATUS_CONFIG y STATUS_STEPS
type OrderStatus =
  | "pendiente" | "pagado" | "en_produccion"
  | "control_calidad" | "listo_despacho"
  | "enviado" | "entregado" | "cancelado";

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pendiente:       { label: "Pendiente",       icon: Clock,        color: "#92400e", bg: "#fef3c7" },
  pagado:          { label: "Pago recibido",   icon: CheckCircle2, color: "#065f46", bg: "#d1fae5" },
  en_produccion:   { label: "En producción",   icon: Package,      color: "#1e40af", bg: "#dbeafe" },
  control_calidad: { label: "Control calidad", icon: Package,      color: "#5b21b6", bg: "#ede9fe" },
  listo_despacho:  { label: "Listo despacho",  icon: Truck,        color: "#0e7490", bg: "#cffafe" },
  enviado:         { label: "En camino",        icon: Truck,        color: "#6d28d9", bg: "#ede9fe" },
  entregado:       { label: "Entregado",        icon: CheckCircle2, color: "#14532d", bg: "#dcfce7" },
  cancelado:       { label: "Cancelado",        icon: XCircle,     color: "#7f1d1d", bg: "#fee2e2" },
};

const STATUS_STEPS: OrderStatus[] = [
  "pagado", "en_produccion", "control_calidad", "listo_despacho", "enviado", "entregado"
];
```

**Opción B — deprecar `en_preparacion`:** Si ya tienes órdenes reales con ese estado, migra los datos antes de eliminar el valor del enum:
```sql
UPDATE public.orders SET status = 'en_produccion' WHERE status = 'en_preparacion';
```

### 3. RLS faltante: el cliente debe poder ver sus propios pedidos

La migración de `orders` solo define policies para `anon` (crear) y admin/vendedor (ver todo). El cliente autenticado no puede leer sus propios pedidos. Añade:

```sql
CREATE POLICY "Cliente ve sus propios pedidos"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR email = auth.email());
```

---

## 1. Orden de ejecución de migraciones

Ejecuta en este orden exacto (cada una en una transacción separada en el SQL Editor):

```
1. 20260529080048_...sql        ← perfiles, roles, has_role(), customers
2. 20260529080109_...sql        ← resto del schema base
3. 20260530_products_cloudinary.sql
4. 20260530_orders_ecommerce.sql
5. ALTER TABLE orders ADD COLUMN user_id, estimated_delivery  ← corrección manual
6. 20260605_produccion_pipeline.sql   ← PASO 1: solo extiende enums
7. 20260605b_produccion_tablas.sql    ← PASO 2: tablas y funciones
8. CREATE POLICY "Cliente ve sus propios pedidos"  ← corrección manual
```

> **Importante:** Las migraciones del Paso 1 y Paso 2 deben ejecutarse en **transacciones separadas**. Añadir valores a un enum no puede ir en la misma transacción que crear tablas que usen ese enum.

---

## 2. Estructura de tablas del módulo

### `produccion`
Un registro por pedido, creado automáticamente por la función `cambiar_estado_pedido` cuando el estado pasa a `en_produccion`.

| Campo | Tipo | Descripción |
|---|---|---|
| `order_id` | UUID UNIQUE | FK a `orders` |
| `asignado_a` | UUID | FK a `auth.users` (carpintero) |
| `status` | enum | `pendiente`, `en_proceso`, `pausado`, `terminado`, `rechazado_calidad` |
| `prioridad` | smallint 1–3 | 1=urgente, 2=normal, 3=baja |
| `fecha_inicio` | date | Auto: día del cambio a `en_produccion` |
| `fecha_fin_estimada` | date | Auto: +7 días desde inicio |
| `calidad_aprobada` | boolean | Resultado del control de calidad |

### `order_estado_historial`
Registro automático via trigger `trg_historial_order_status` cada vez que cambia `orders.status`.

| Campo | Tipo |
|---|---|
| `order_id` | UUID |
| `estado_anterior` | order_status |
| `estado_nuevo` | order_status |
| `cambiado_por` | UUID (usuario) |
| `motivo` | TEXT (opcional) |

### `notificaciones`
Cola de emails/SMS/WhatsApp encolados automáticamente por `cambiar_estado_pedido`. **No se envían solos** — necesitas un worker o cron que los procese (ver sección 5).

---

## 3. La función RPC `cambiar_estado_pedido`

Es el núcleo del módulo. Se llama desde el frontend así:

```ts
// src/routes/_authenticated/pedidos.tsx
await supabase.rpc("cambiar_estado_pedido", {
  _order_id: orderId,
  _nuevo_estado: nuevoEstado,   // ej: "en_produccion"
  // _motivo: "Confirmado por cliente" (opcional)
});
```

La función hace todo en una transacción:
1. Valida que la transición sea permitida (diagrama abajo)
2. Actualiza `orders.status`
3. El trigger `trg_historial_order_status` inserta en `order_estado_historial`
4. Si el nuevo estado es `en_produccion`, inserta/actualiza en `produccion`
5. Encola una notificación en `notificaciones`

### Diagrama de transiciones válidas

```
pendiente ──────────────────────────────────► cancelado
    │
    ▼
  pagado ─────────────────────────────────── cancelado
    │
    ▼
en_produccion ──────────────────────────── cancelado
    │
    ▼
control_calidad ◄──── (rechazar, vuelve a en_produccion)
    │
    ▼
listo_despacho
    │
    ├──► enviado ──► entregado
    │
    └──► entregado (entrega directa en tienda)
```

---

## 4. Flujo de datos en el panel admin (`/pedidos`)

```
Supabase: orders JOIN produccion
    ↓  useQuery([\"orders\"], fetchOrders, { refetchInterval: 60_000 })
PedidosPage
├── KPIs: total pedidos, pendientes/pagados, en producción, facturado
├── Pipeline visual: botones filtrables por estado con contador
├── Filtros: búsqueda por nº pedido / nombre / email / teléfono + select de estado
└── Tabla con paginación implícita (todos los pedidos)
     └── click ojo → Dialog detalle
          ├── Pipeline de avance visual (círculos + líneas)
          ├── Botones "Cambiar a:" (solo transiciones válidas del estado actual)
          │    └── mutation → supabase.rpc("cambiar_estado_pedido")
          │         └── onSuccess: invalidate ["orders"] + ["order-historial", id]
          ├── Datos del cliente
          ├── Productos (order_items)
          ├── Totales
          ├── Historial de estados
          └── Datos de pago Niubiz
```

**Auto-refresh:** la query tiene `refetchInterval: 60_000` (1 minuto). Si quieres tiempo real usa Supabase Realtime:
```ts
// Añadir en fetchOrders o en un useEffect:
supabase
  .channel("orders-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
    qc.invalidateQueries({ queryKey: ["orders"] });
  })
  .subscribe();
```

---

## 5. Procesamiento de notificaciones (cola `notificaciones`)

La tabla `notificaciones` actúa como cola de mensajes. El campo `enviado` empieza en `false`. **Los emails no se envían automáticamente** — necesitas implementar el worker.

### Opción A — Cron de Supabase (recomendado)

Crea una Edge Function que procesa la cola y configura el cron desde el dashboard:

```ts
// supabase/functions/send-notifications/index.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async () => {
  const { data: pendientes } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("enviado", false)
    .limit(50);

  for (const notif of pendientes ?? []) {
    try {
      // Enviar con Resend, SendGrid, etc.
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "G&M Mueblería <noreply@tudominio.com>",
          to: notif.destinatario_email,
          subject: notif.asunto,
          html: `<p>Hola ${notif.destinatario_nombre}, tu pedido ha cambiado de estado.</p>`,
        }),
      });
      await supabase
        .from("notificaciones")
        .update({ enviado: true, enviado_at: new Date().toISOString() })
        .eq("id", notif.id);
    } catch (err) {
      await supabase
        .from("notificaciones")
        .update({ error: String(err) })
        .eq("id", notif.id);
    }
  }
  return new Response("ok");
});
```

Configurar cron en Supabase Dashboard → Edge Functions → Schedules: `*/5 * * * *` (cada 5 minutos).

### Opción B — desde el servidor Express

Agrega un `setInterval` en `server/index.js` que llame al mismo endpoint de Supabase usando la `service_role` key.

---

## 6. Vista del cliente: `/perfil`

El cliente ve sus propios pedidos con un tracker visual de progreso. El flujo:

```
GET /perfil
    │
    ├── useAuth() → user
    └── useQuery(["mis-pedidos", user.id])
          └── supabase.from("orders").eq("user_id", userId)
                ↓
          Lista de PedidoCard
          ├── Estado con badge de color
          ├── Barra de progreso visual (pasos del pipeline)
          └── Detalle expandible: productos, totales, dirección
```

**Requisito previo:** la RLS policy "Cliente ve sus propios pedidos" debe existir (ver sección de correcciones), y la columna `user_id` debe estar en `orders`.

---

## 7. Roles y accesos

| Rol | Acceso al panel admin | Puede cambiar estados | Ve producción |
|---|---|---|---|
| `admin` | ✅ Todas las rutas `/_authenticated/` | ✅ Cualquier transición válida | ✅ |
| `vendedor` | ✅ Dashboard, Pedidos, Ventas, Clientes | ✅ Cualquier transición válida | ✅ |
| `carpintero` | ❌ Sin acceso al panel (aún no hay ruta dedicada) | ❌ | ✅ Solo sus propios registros de producción |
| `cliente` | ❌ | ❌ | ❌ (ve su propio `/perfil`) |

**Asignar un rol a un usuario** desde el SQL Editor:
```sql
-- Dar rol "vendedor" a un usuario por email
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'vendedor' FROM auth.users WHERE email = 'vendedor@tuempresa.com';
```

---

## 8. Vista `v_produccion_panel`

Disponible en la DB, lista los pedidos activos en producción (excluye `terminado`). Puede consultarse desde una futura ruta `/produccion` para el panel del carpintero:

```ts
const { data } = await supabase.from("v_produccion_panel").select("*");
// Devuelve: produccion_id, order_id, order_number, cliente, email,
//           total, order_status, prod_status, prioridad,
//           fecha_inicio, fecha_fin_estimada, calidad_aprobada, carpintero
```

---

## 9. Lista de verificación

### Base de datos
- [ ] Migración `20260605_produccion_pipeline.sql` ejecutada (Paso 1 — solo enums)
- [ ] Migración `20260605b_produccion_tablas.sql` ejecutada (Paso 2 — tablas)
- [ ] `ALTER TABLE orders ADD COLUMN user_id, estimated_delivery` ejecutado
- [ ] Policy "Cliente ve sus propios pedidos" creada
- [ ] Verificar que `has_role()` existe (viene de la migración base `20260529...`)

### Frontend
- [ ] `perfil.tsx`: `STATUS_CONFIG` y `STATUS_STEPS` actualizados a los estados del pipeline nuevo (`en_produccion`, `control_calidad`, `listo_despacho`)
- [ ] `checkout.tsx`: incluye `user_id: user?.id` en el INSERT de la orden
- [ ] Acceder a `/dashboard`, `/pedidos` con usuario admin y confirmar que carga

### Notificaciones (opcional pero recomendado)
- [ ] Crear Edge Function `send-notifications` con proveedor de email
- [ ] Configurar `RESEND_API_KEY` (o proveedor elegido) como secret en Supabase
- [ ] Configurar cron en Supabase

### Verificación funcional
- [ ] Admin puede ver todos los pedidos en `/pedidos`
- [ ] Pipeline visual muestra conteo por estado
- [ ] Click en un pedido abre el detalle con ítems e historial
- [ ] Cambiar estado de `pagado` → `en_produccion` funciona (llama al RPC)
- [ ] Al cambiar a `en_produccion`, se crea un registro en `produccion`
- [ ] El historial de estados registra el cambio automáticamente
- [ ] El cliente en `/perfil` ve sus pedidos (requiere columna `user_id`)
- [ ] La barra de progreso del cliente refleja el estado actual correctamente

---

## 10. Notas adicionales

**El Dialog de pedidos tiene un bug menor:** en `pedidos.tsx` la condición de apertura del Dialog es:
```tsx
// ❌ Como está ahora (bug lógico)
open={!!selectedId && !selectedId !== null}

// ✅ Corrección
open={!!selectedId}
```

**El query de `pedidos.tsx` hace JOIN con `produccion`** usando la sintaxis de Supabase nested relations (`produccion (...)`). Esto funciona porque existe la FK `produccion.order_id → orders.id` y es una relación 1:1 (UNIQUE).

**`cambiar_estado_pedido` usa `SECURITY DEFINER`**, lo que significa que se ejecuta con permisos del propietario de la función (normalmente `postgres`), no del usuario llamante. La verificación de roles la hace internamente con `has_role(auth.uid(), ...)`. No expongas esta función a `anon`.
























































































































































# 3 Módulo Clientes y CRM — Guía de Implementación
**G&M Mueblería** · Estado real del código + lo que hay que construir

---

## Estado actual del módulo

A diferencia de los módulos anteriores (donde el código estaba casi completo), este módulo está **parcialmente construido**. Hay que ser claro sobre qué existe y qué hay que escribir:

| Pieza | Estado | Notas |
|---|---|---|
| `/clientes` | ⚠️ Stub básico | Solo lista con búsqueda — sin detalle, sin edición, sin historial |
| `/crm` | ❌ Placeholder | Es una página de links a herramientas externas (Twenty CRM, ERPNext), no un CRM real |
| `customers` tabla | ✅ Existe | `doc_tipo`, `doc_numero`, `nombre`, `email`, `telefono`, `direccion` |
| `searchCustomers()` | ✅ Existe | En `pos.functions.ts`, búsqueda por nombre o doc_numero |
| `upsertCustomer()` | ✅ Existe | Insert/update por doc_tipo+doc_numero |
| Historial de compras POS | ✅ Existe | `sales` tabla con `customer_id` |
| Historial de pedidos online | ✅ Existe | `orders` tabla con `email` (sin FK a customers) |
| Segmento / notas CRM | ❌ No existe | La tabla `customers` no tiene estos campos |
| Panel de detalle de cliente | ❌ No existe | Hay que construirlo |
| Vista 360° del cliente | ❌ No existe | Compras POS + pedidos online unificados |

---

## 1. Qué columnas faltan en `customers`

La tabla actual solo tiene datos de contacto básicos. Para un CRM funcional necesitas añadir:

```sql
-- Ejecutar en Supabase SQL Editor
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS segmento      TEXT    NOT NULL DEFAULT 'nuevo'
                                         CHECK (segmento IN ('nuevo', 'recurrente', 'vip', 'inactivo')),
  ADD COLUMN IF NOT EXISTS notas         TEXT,
  ADD COLUMN IF NOT EXISTS tags          TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fecha_ultimo_contacto  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS distrito      TEXT,
  ADD COLUMN IF NOT EXISTS ciudad        TEXT    DEFAULT 'Lima';

-- Índice para filtrar por segmento
CREATE INDEX IF NOT EXISTS idx_customers_segmento ON public.customers(segmento);
```

### Vista de valor del cliente (computed en DB)

Esta vista une compras POS + pedidos online para tener el valor real por cliente:

```sql
CREATE OR REPLACE VIEW public.v_customer_valor AS
SELECT
  c.id,
  c.nombre,
  c.email,
  c.telefono,
  c.doc_tipo,
  c.doc_numero,
  c.segmento,
  c.notas,
  c.direccion,
  c.created_at,

  -- Ventas POS
  COUNT(DISTINCT s.id)            AS total_compras_pos,
  COALESCE(SUM(s.total), 0)       AS gasto_pos,
  MAX(s.created_at)               AS ultima_compra_pos,

  -- Pedidos online (match por email)
  COUNT(DISTINCT o.id)            AS total_pedidos_online,
  COALESCE(SUM(o.total), 0)       AS gasto_online,
  MAX(o.created_at)               AS ultimo_pedido_online,

  -- Total unificado
  COALESCE(SUM(s.total), 0) + COALESCE(SUM(o.total), 0) AS valor_total_cliente,

  GREATEST(MAX(s.created_at), MAX(o.created_at)) AS ultima_actividad

FROM public.customers c
LEFT JOIN public.sales s
  ON s.customer_id = c.id AND s.estado = 'completada'
LEFT JOIN public.orders o
  ON o.email = c.email AND o.status NOT IN ('pendiente', 'cancelado')
GROUP BY c.id;

GRANT SELECT ON public.v_customer_valor TO authenticated;
```

> **Nota:** Los pedidos online se vinculan al cliente por `email` porque `orders` no tiene FK a `customers`. Una vez hagas el `ALTER TABLE orders ADD COLUMN user_id` del módulo anterior, puedes mejorar este JOIN.

---

## 2. Ampliar `searchCustomers` en `pos.functions.ts`

La función actual devuelve los campos básicos y limita a 20 resultados. Amplía para incluir los nuevos campos y aumentar el límite:

```ts
// src/lib/pos.functions.ts — reemplazar searchCustomers
export async function searchCustomers(input: { data: { q: string; limit?: number } }) {
  const { q, limit = 50 } = z.object({
    q: z.string().max(100),
    limit: z.number().int().min(1).max(200).optional(),
  }).parse(input.data);

  const { supabase } = await getAuthenticatedClient();
  const trimmed = q.trim();

  let query = supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (trimmed) {
    query = query.or(
      `nombre.ilike.%${trimmed}%,doc_numero.ilike.%${trimmed}%,email.ilike.%${trimmed}%,telefono.ilike.%${trimmed}%`
    );
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  return { customers: rows ?? [] };
}
```

Añade también estas dos funciones nuevas en `pos.functions.ts`:

```ts
// Obtener un cliente con su valor completo (vista v_customer_valor)
export async function getCustomerValor(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("v_customer_valor")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return { customer: data };
}

// Historial de compras POS de un cliente
export async function getCustomerSales(input: { customer_id: string }) {
  const { customer_id } = z.object({ customer_id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("sales")
    .select("id, numero, tipo, total, metodo_pago, estado, created_at, sale_items(title, qty, unit_price)")
    .eq("customer_id", customer_id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { sales: data ?? [] };
}

// Historial de pedidos online de un cliente (por email)
export async function getCustomerOrders(input: { email: string }) {
  const { email } = z.object({ email: z.string().email() }).parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, total, status, created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { orders: data ?? [] };
}

// Actualizar segmento y notas de un cliente
export async function updateCustomerCrm(input: {
  id: string;
  segmento: "nuevo" | "recurrente" | "vip" | "inactivo";
  notas?: string | null;
  tags?: string[];
}) {
  const data = z.object({
    id: z.string().uuid(),
    segmento: z.enum(["nuevo", "recurrente", "vip", "inactivo"]),
    notas: z.string().max(2000).optional().nullable(),
    tags: z.array(z.string()).optional(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { data: row, error } = await supabase
    .from("customers")
    .update({
      segmento: data.segmento,
      notas: data.notas ?? null,
      tags: data.tags ?? [],
      fecha_ultimo_contacto: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { customer: row };
}
```

---

## 3. Reescribir `/clientes` — Panel CRM completo

Reemplaza el contenido actual de `src/routes/_authenticated/clientes.tsx` con esta implementación. Es la pieza más grande de este módulo:

```tsx
// src/routes/_authenticated/clientes.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  searchCustomers, getCustomerValor, getCustomerSales,
  getCustomerOrders, updateCustomerCrm, upsertCustomer,
} from "@/lib/pos.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, Search, UserPlus, Eye, TrendingUp,
  ShoppingBag, Package, Phone, Mail, MapPin,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — G&M" }] }),
  component: ClientesPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
const fmtDate = (d: string | null) =>
  d ? format(new Date(d), "dd/MM/yyyy") : "—";

const SEGMENTO_CONFIG = {
  nuevo:      { label: "Nuevo",      color: "#1e40af", bg: "#dbeafe" },
  recurrente: { label: "Recurrente", color: "#065f46", bg: "#d1fae5" },
  vip:        { label: "VIP",        color: "#78350f", bg: "#fef3c7" },
  inactivo:   { label: "Inactivo",   color: "#6b7280", bg: "#f3f4f6" },
} as const;

type Segmento = keyof typeof SEGMENTO_CONFIG;

// ── Detalle 360° del cliente ─────────────────────────────────
function ClienteDetalle({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ segmento: "nuevo" as Segmento, notas: "" });

  const { data: cv, isLoading } = useQuery({
    queryKey: ["customer-valor", customerId],
    queryFn: () => getCustomerValor({ id: customerId }),
    onSuccess: (d) => {
      setForm({
        segmento: (d.customer.segmento ?? "nuevo") as Segmento,
        notas: d.customer.notas ?? "",
      });
    },
  });

  const { data: salesData } = useQuery({
    queryKey: ["customer-sales", customerId],
    queryFn: () => getCustomerSales({ customer_id: customerId }),
  });

  const { data: ordersData } = useQuery({
    queryKey: ["customer-orders", cv?.customer?.email],
    queryFn: () => getCustomerOrders({ email: cv!.customer.email! }),
    enabled: !!cv?.customer?.email,
  });

  const saveMut = useMutation({
    mutationFn: () => updateCustomerCrm({ id: customerId, ...form }),
    onSuccess: () => {
      toast.success("Cliente actualizado");
      qc.invalidateQueries({ queryKey: ["customer-valor", customerId] });
      qc.invalidateQueries({ queryKey: ["customers-list"] });
      setEditMode(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const c = cv?.customer;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isLoading ? "Cargando..." : c?.nombre}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : c ? (
          <div className="space-y-5 mt-1">

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Valor total</p>
                <p className="font-display text-lg font-semibold">{fmt(Number(c.valor_total_cliente ?? 0))}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Compras POS</p>
                <p className="font-display text-lg font-semibold">{c.total_compras_pos ?? 0}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Pedidos online</p>
                <p className="font-display text-lg font-semibold">{c.total_pedidos_online ?? 0}</p>
              </div>
            </div>

            {/* Datos de contacto */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm bg-muted/30 rounded-xl p-4">
              <div>
                <span className="text-muted-foreground text-xs">Documento</span>
                <p className="font-medium">{c.doc_tipo} {c.doc_numero}</p>
              </div>
              {c.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-xs">Email</span>
                    <p className="font-medium text-sm truncate">{c.email}</p>
                  </div>
                </div>
              )}
              {c.telefono && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-xs">Teléfono</span>
                    <p className="font-medium">{c.telefono}</p>
                  </div>
                </div>
              )}
              {c.direccion && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-xs">Dirección</span>
                    <p className="font-medium text-sm">{c.direccion}</p>
                  </div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground text-xs">Cliente desde</span>
                <p className="font-medium">{fmtDate(c.created_at)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Última actividad</span>
                <p className="font-medium">{fmtDate(c.ultima_actividad)}</p>
              </div>
            </div>

            {/* CRM: segmento y notas */}
            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">CRM</h4>
                {!editMode ? (
                  <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
                      {saveMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                      Guardar
                    </Button>
                  </div>
                )}
              </div>

              {editMode ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Segmento</Label>
                    <Select
                      value={form.segmento}
                      onValueChange={(v) => setForm((f) => ({ ...f, segmento: v as Segmento }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SEGMENTO_CONFIG).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Notas internas</Label>
                    <Textarea
                      className="mt-1 text-sm"
                      rows={3}
                      value={form.notas}
                      onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                      placeholder="Preferencias, historial de contacto, observaciones..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Segmento:</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        color: SEGMENTO_CONFIG[c.segmento as Segmento]?.color ?? "#6b7280",
                        background: SEGMENTO_CONFIG[c.segmento as Segmento]?.bg ?? "#f3f4f6",
                      }}
                    >
                      {SEGMENTO_CONFIG[c.segmento as Segmento]?.label ?? c.segmento}
                    </span>
                  </div>
                  {c.notas ? (
                    <p className="text-muted-foreground text-xs bg-muted/30 rounded-lg p-3 whitespace-pre-line">
                      {c.notas}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs italic">Sin notas</p>
                  )}
                </div>
              )}
            </div>

            {/* Historial POS */}
            {(salesData?.sales ?? []).length > 0 && (
              <section>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4" /> Compras en tienda
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {salesData!.sales.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between text-sm p-2.5 rounded-lg bg-muted/30">
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">{s.numero}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{fmtDate(s.created_at)}</span>
                      </div>
                      <span className="font-semibold">{fmt(Number(s.total))}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Historial online */}
            {(ordersData?.orders ?? []).length > 0 && (
              <section>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Package className="h-4 w-4" /> Pedidos online
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {ordersData!.orders.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between text-sm p-2.5 rounded-lg bg-muted/30">
                      <div>
                        <span className="font-mono text-xs text-muted-foreground">{o.order_number}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{fmtDate(o.created_at)}</span>
                      </div>
                      <span className="font-semibold">{fmt(Number(o.total))}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────
function ClientesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [segmentoFilter, setSegmentoFilter] = useState("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customers-list", q],
    queryFn: () => searchCustomers({ data: { q, limit: 100 } }),
  });

  const filtered = useMemo(() => {
    const list = data?.customers ?? [];
    if (segmentoFilter === "todos") return list;
    return list.filter((c: any) => c.segmento === segmentoFilter);
  }, [data, segmentoFilter]);

  // KPIs
  const stats = useMemo(() => {
    const all = data?.customers ?? [];
    return {
      total: all.length,
      vip: all.filter((c: any) => c.segmento === "vip").length,
      recurrente: all.filter((c: any) => c.segmento === "recurrente").length,
      nuevo: all.filter((c: any) => c.segmento === "nuevo").length,
    };
  }, [data]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Clientes</h1>
          <p className="text-muted-foreground mt-0.5">Directorio y CRM</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total clientes", value: stats.total },
          { label: "Nuevos",         value: stats.nuevo },
          { label: "Recurrentes",    value: stats.recurrente },
          { label: "VIP",            value: stats.vip },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="font-display text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, documento, email o teléfono…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={segmentoFilter} onValueChange={setSegmentoFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los segmentos</SelectItem>
            {Object.entries(SEGMENTO_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground text-sm">
            No se encontraron clientes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/40">
                  {["Nombre", "Documento", "Contacto", "Segmento", "Cliente desde", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((c: any) => {
                  const seg = SEGMENTO_CONFIG[c.segmento as Segmento] ?? SEGMENTO_CONFIG.nuevo;
                  return (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.nombre}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                        {c.doc_tipo} {c.doc_numero}
                      </td>
                      <td className="px-4 py-3">
                        {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                        {c.telefono && <p className="text-xs text-muted-foreground">{c.telefono}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: seg.color, background: seg.bg }}
                        >
                          {seg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {fmtDate(c.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedId(c.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detalle modal */}
      {selectedId && (
        <ClienteDetalle
          customerId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
```

---

## 4. Actualizar el sidebar con link a CRM

El sidebar (`AppSidebar.tsx`) ya tiene el link a `/clientes`. Lo que falta es decidir qué hacer con `/crm`:

**Opción A — mantener `/crm` como está** (recursos externos): no toques nada, está en el sidebar bajo "Operación".

**Opción B — convertir `/crm` en el nuevo panel de clientes** y eliminar la ruta `/clientes` separada: renombra la ruta y actualiza el item del sidebar.

**Opción C — añadir `/crm` al sidebar apuntando al panel de clientes renovado**: actualiza el item existente de "Clientes" para que apunte a la nueva lógica. La página `/crm` con recursos externos puede quedar como submenú o eliminarse.

La opción más limpia para el usuario es la **A**, dejando el panel de Clientes mejorado en `/clientes` y `/crm` como está (o directamente borrando la ruta `/crm` si no la quieres).

Si quieres eliminar `/crm` del sidebar, edita `AppSidebar.tsx`:

```tsx
// Elimina o comenta esta línea del array items:
// { title: "CRM",      url: "/crm",      icon: ...,   roles: [...] },
```

---

## 5. Actualizar `upsertCustomer` para manejar los nuevos campos

La función actual ya funciona con los campos base. Para que también guarde `distrito` y `ciudad` al crear desde el POS:

```ts
// src/lib/pos.functions.ts — ampliar CustomerSchema
const CustomerSchema = z.object({
  doc_tipo: z.enum(["DNI", "RUC", "CE", "PASAPORTE"]),
  doc_numero: z.string().min(6).max(20).regex(/^[A-Z0-9]+$/i),
  nombre: z.string().min(1).max(255),
  email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  telefono: z.string().max(30).optional().nullable(),
  direccion: z.string().max(500).optional().nullable(),
  distrito: z.string().max(100).optional().nullable(),   // nuevo
  ciudad: z.string().max(100).optional().nullable(),     // nuevo
});
```

---

## 6. Lógica de segmentación automática (opcional)

Puedes crear un cron o función SQL que actualice automáticamente el segmento según el comportamiento de compra:

```sql
-- Función para recalcular segmentos (ejecutar periodicamente o desde un cron)
CREATE OR REPLACE FUNCTION public.recalcular_segmentos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- VIP: más de S/2000 en total
  UPDATE public.customers c
  SET segmento = 'vip'
  FROM public.v_customer_valor v
  WHERE v.id = c.id
    AND v.valor_total_cliente > 2000
    AND c.segmento <> 'inactivo';

  -- Recurrente: 2+ compras y no VIP
  UPDATE public.customers c
  SET segmento = 'recurrente'
  FROM public.v_customer_valor v
  WHERE v.id = c.id
    AND (v.total_compras_pos + v.total_pedidos_online) >= 2
    AND v.valor_total_cliente <= 2000
    AND c.segmento NOT IN ('vip', 'inactivo');

  -- Inactivo: sin actividad en 180 días
  UPDATE public.customers c
  SET segmento = 'inactivo'
  FROM public.v_customer_valor v
  WHERE v.id = c.id
    AND (v.ultima_actividad IS NULL OR v.ultima_actividad < now() - interval '180 days')
    AND c.segmento NOT IN ('vip');
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalcular_segmentos() TO authenticated;
```

Puedes llamarla manualmente desde el panel o programarla como cron de Supabase.

---

## 7. Lista de verificación

### Base de datos
- [ ] `ALTER TABLE customers ADD COLUMN segmento, notas, tags, fecha_ultimo_contacto, distrito, ciudad`
- [ ] Crear vista `v_customer_valor`
- [ ] (Opcional) Crear función `recalcular_segmentos()`

### Backend (`pos.functions.ts`)
- [ ] Ampliar `searchCustomers` (más campos, búsqueda por email y teléfono)
- [ ] Añadir `getCustomerValor()`
- [ ] Añadir `getCustomerSales()`
- [ ] Añadir `getCustomerOrders()`
- [ ] Añadir `updateCustomerCrm()`
- [ ] Ampliar `CustomerSchema` con `distrito` y `ciudad`

### Frontend
- [ ] Reemplazar `src/routes/_authenticated/clientes.tsx` con la implementación completa
- [ ] Verificar que `Textarea` esté importado en `clientes.tsx` (es un componente shadcn/ui que ya existe en `src/components/ui/`)
- [ ] Decidir qué hacer con `/crm` (mantener, eliminar o redirigir)

### Verificación funcional
- [ ] Lista de clientes carga con los nuevos campos de segmento
- [ ] Filtro por segmento funciona
- [ ] Búsqueda por email y teléfono funciona
- [ ] Click en ojo abre el detalle 360° del cliente
- [ ] KPIs de valor total muestran suma de POS + online
- [ ] Editar segmento y notas guarda correctamente
- [ ] Historial de compras POS aparece en el detalle
- [ ] Historial de pedidos online aparece (si el cliente tiene email en `orders`)

---

## 8. Notas importantes

**La vista `v_customer_valor` une POS y online por email.** Esto funciona cuando el cliente en tienda tiene el mismo email que usó al comprar online. Si no tiene email registrado en `customers`, el historial online no se mostrará. Para mejorar esta vinculación a futuro, añade el campo `customer_id` en `orders` y crea un FK.

**`createStaffUser` en `pos.functions.ts` usa `VITE_SUPABASE_SERVICE_KEY`** — una service key expuesta al browser es un riesgo de seguridad. Este patrón fue construido así en el proyecto original. Si quieres moverlo al servidor Express, la función de creación de usuarios debería ir en `server/index.js` usando la `SUPABASE_SECRET_KEY` del env del servidor (que no se expone al browser).

**El primer usuario que se registra en Supabase recibe rol `admin` automáticamente** (trigger `handle_new_user`). Los siguientes reciben `vendedor` por defecto. Puedes cambiar esto en la migración `20260529080048`.



































































































































































































































# 4  Módulo MRP — Insumos y Lista de Materiales (BOM)
**G&M Mueblería** · Nuevo módulo completo, construir desde cero

---

## Lo que se construye

| Funcionalidad | Ruta / Pieza |
|---|---|
| Catálogo de insumos con stock | `src/routes/_authenticated/insumos.tsx` |
| BOM (lista de materiales por modelo+talla) | Tabla DB `bom_items` |
| Calculadora MRP: ¿qué insumos necesito para N pedidos? | Dialog dentro de `insumos.tsx` |
| Alerta de stock bajo | Badge en sidebar + query |
| Link en sidebar | `AppSidebar.tsx` |

---

## Qué hay en el Excel y cómo interpretarlo

El Excel define **5 modelos de juego de sala**, cada uno con **múltiples tallas** (2, 2.5, 3, 3.5, 4, 5, 6 pies) y los insumos necesarios para fabricar **1 juego completo**. La columna "Madera" lista las dimensiones de los cortes necesarios por talla; las demás columnas son insumos planos.

### Insumos identificados

| # | Insumo | Unidad de medida |
|---|---|---|
| 1 | Madera (pies/metros/palos) | pies / metros / palos |
| 2 | Tela | metros (M) |
| 3 | Algodón | kg |
| 4 | Espuma | planchas × pgd |
| 5 | Resorte | piezas |
| 6 | Napa | kg |
| 7 | Picadillo | kg |
| 8 | Terocal | litros |
| 9 | Clavo (resortes) | unidades |
| 10 | Costales | unidades (ctd) |
| 11 | Poliseda | metros (M) |
| 12 | Patas de madera | unidades (ctd) |
| 13 | Cojines | unidades × tamaño (pgd) |
| 14 | Panqueque | metros (M) |
| 15 | Grapa (casco) | paquetes / pgd |
| 16 | Plato | unidades (ctd) |
| 17 | Grapa (tela) | paquetes |
| 18 | Cola | unidades (1/8) |
| 19 | Hilos | unidades (ctd) |

### Modelos y sus diferencias clave

| Modelo | Tela 6 pies | Algodón 6 pies | Napa 6 pies | Notas |
|---|---|---|---|---|
| Vintage | 16 M | 5 kg | 1.5 kg | Cojines 50×50 y 50×55 |
| Rex | 23 M | 2 kg | 15 kg | Cojines 60×50 y 50×50 |
| Lineal Punta | 22 M | 2 kg | 15 kg | Similar a Rex, menos tela |
| London | ~24 M (entero) | ~22.5 kg | 7.5 kg | Sin terocal, más picadillo (3kg) |
| Garra | 21 M | 45 kg | 2 kg decorativo | Sin picadillo, mínimo terocal (10gr) |

---

## 1. Migraciones de base de datos

Ejecutar en orden en el SQL Editor de Supabase.

### Paso 1 — Catálogo de insumos

```sql
-- Unidades de medida disponibles
CREATE TYPE public.unidad_insumo AS ENUM (
  'metros', 'kg', 'litros', 'unidades', 'planchas', 'piezas',
  'paquetes', 'palos', 'pies', 'bolsas'
);

-- Catálogo maestro de insumos
CREATE TABLE public.insumos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL UNIQUE,
  descripcion   TEXT,
  unidad        public.unidad_insumo NOT NULL,
  stock_actual  NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo  NUMERIC(12,3) NOT NULL DEFAULT 0,
  precio_unit   NUMERIC(10,2),               -- precio de compra por unidad
  proveedor     TEXT,
  activo        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.insumos TO authenticated;

CREATE POLICY "Staff manage insumos"
  ON public.insumos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));

CREATE INDEX idx_insumos_activo ON public.insumos(activo);
```

### Paso 2 — BOM (Bill of Materials)

```sql
-- Un BOM_ITEM = "para fabricar el modelo X en talla Y se necesita Z unidades del insumo I"
CREATE TABLE public.bom_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo       TEXT NOT NULL,          -- 'Vintage','Rex','Lineal Punta','London','Garra'
  talla        TEXT NOT NULL,          -- '2 pies','2.5 pies','3 pies','3.5 pies','4 pies','5 pies','6 pies'
  insumo_id    UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  cantidad     NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  notas        TEXT,                   -- "sobra tiras", "mitad sobra", etc.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (modelo, talla, insumo_id)
);

ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_items TO authenticated;

CREATE POLICY "Staff manage bom"
  ON public.bom_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));

CREATE INDEX idx_bom_modelo_talla ON public.bom_items(modelo, talla);
CREATE INDEX idx_bom_insumo ON public.bom_items(insumo_id);
```

### Paso 3 — Movimientos de stock (entradas/salidas)

```sql
CREATE TYPE public.movimiento_tipo AS ENUM ('entrada', 'salida', 'ajuste');

CREATE TABLE public.insumo_movimientos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id    UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  tipo         public.movimiento_tipo NOT NULL,
  cantidad     NUMERIC(12,3) NOT NULL,
  motivo       TEXT,                   -- "Compra proveedor", "Producción pedido #123", "Ajuste inventario"
  referencia   TEXT,                   -- order_number o número de factura de compra
  registrado_por UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.insumo_movimientos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.insumo_movimientos TO authenticated;

CREATE POLICY "Staff manage movimientos"
  ON public.insumo_movimientos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));

CREATE INDEX idx_mov_insumo ON public.insumo_movimientos(insumo_id, created_at DESC);

-- Trigger: actualizar stock_actual automáticamente
CREATE OR REPLACE FUNCTION public.actualizar_stock_insumo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE public.insumos SET stock_actual = stock_actual + NEW.cantidad, updated_at = now()
    WHERE id = NEW.insumo_id;
  ELSIF NEW.tipo = 'salida' THEN
    UPDATE public.insumos SET stock_actual = GREATEST(stock_actual - NEW.cantidad, 0), updated_at = now()
    WHERE id = NEW.insumo_id;
  ELSIF NEW.tipo = 'ajuste' THEN
    -- cantidad puede ser negativa para ajuste a la baja
    UPDATE public.insumos SET stock_actual = GREATEST(stock_actual + NEW.cantidad, 0), updated_at = now()
    WHERE id = NEW.insumo_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_insumo
  AFTER INSERT ON public.insumo_movimientos
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_stock_insumo();
```

### Paso 4 — Vista de alertas de stock bajo

```sql
CREATE OR REPLACE VIEW public.v_insumos_stock_bajo AS
SELECT
  id, nombre, unidad, stock_actual, stock_minimo,
  stock_minimo - stock_actual AS faltante,
  proveedor
FROM public.insumos
WHERE activo = true
  AND stock_actual < stock_minimo
ORDER BY faltante DESC;

GRANT SELECT ON public.v_insumos_stock_bajo TO authenticated;
```

---

## 2. Seed data — Insumos y BOM del Excel

Ejecuta este seed para cargar los datos del Excel. **Los nombres de modelos los puedes cambiar después con un simple `UPDATE public.bom_items SET modelo = 'NuevoNombre' WHERE modelo = 'NombreActual'`** — es solo texto.

### 2.1 Insertar insumos

```sql
-- Insertar el catálogo base de insumos
INSERT INTO public.insumos (nombre, unidad, stock_minimo) VALUES
  ('Madera',           'pies',     50),
  ('Tela',             'metros',   50),
  ('Algodón',          'kg',       30),
  ('Espuma',           'planchas',  5),
  ('Resorte',          'piezas',   50),
  ('Napa',             'kg',       20),
  ('Picadillo',        'kg',       10),
  ('Terocal',          'litros',    5),
  ('Clavo resortes',   'unidades', 100),
  ('Costales',         'unidades',  20),
  ('Poliseda',         'metros',   10),
  ('Patas de madera',  'unidades',  20),
  ('Cojines',          'unidades',  10),
  ('Panqueque',        'metros',   10),
  ('Grapa casco',      'paquetes',  5),
  ('Plato',            'unidades',  10),
  ('Grapa tela',       'paquetes',  5),
  ('Cola',             'unidades',  2),
  ('Hilos',            'unidades',  5)
ON CONFLICT (nombre) DO NOTHING;
```

### 2.2 Insertar BOM — Modelo Vintage

```sql
-- Vintage 6 pies (juego completo)
WITH ids AS (SELECT nombre, id FROM public.insumos)
INSERT INTO public.bom_items (modelo, talla, insumo_id, cantidad, notas)
SELECT 'Vintage', '6 pies', id, cantidad, notas FROM (VALUES
  ('Tela',           17,    '16M principal + 1M diseño'),
--   ('Tela',            1,    '1M diseño'),
  ('Algodón',         5,    NULL),
  ('Espuma',          9,    '3 plan x 2pgd + 1 plan x 1pgd + 3 plan x 0.5pgd + retasería'),
  ('Resorte',        12,    '11 dientes'),
  ('Napa',            1.5,  NULL),
  ('Picadillo',       1,    NULL),
  ('Terocal',         1,    'litros'),
  ('Clavo resortes', 48,    NULL),
  ('Costales',       13,    NULL),
  ('Poliseda',        2.5,  NULL),
  ('Patas de madera',13,    NULL),
  ('Panqueque',       5.5,  NULL),
  ('Grapa casco',     2,    '2 pgd'),
  ('Grapa tela',      1,    '1 paq 5k'),
  ('Cola',            0.125,'1/8 de cola'),
  ('Hilos',           2,    NULL)
) AS v(nombre, cantidad, notas)
JOIN ids USING (nombre)
ON CONFLICT (modelo, talla, insumo_id) DO UPDATE
  SET cantidad = EXCLUDED.cantidad, notas = EXCLUDED.notas;

-- Vintage 3.5 pies
WITH ids AS (SELECT nombre, id FROM public.insumos)
INSERT INTO public.bom_items (modelo, talla, insumo_id, cantidad, notas)
SELECT 'Vintage', '3.5 pies', id, cantidad, notas FROM (VALUES
  ('Tela',    16,   'mismo que 6 pies, sin diseño'),
  ('Algodón',  5,   NULL),
  ('Resorte', 12,   '11 dientes'),
  ('Terocal',  1,   NULL),
  ('Clavo resortes', 48, NULL),
  ('Costales', 13,  NULL),
  ('Poliseda', 2.5, NULL),
  ('Patas de madera', 13, NULL),
  ('Panqueque', 5.5, NULL)
) AS v(nombre, cantidad, notas)
JOIN ids USING (nombre)
ON CONFLICT (modelo, talla, insumo_id) DO UPDATE
  SET cantidad = EXCLUDED.cantidad;
```

### 2.3 Insertar BOM — Modelo Rex (6 pies)

```sql
WITH ids AS (SELECT nombre, id FROM public.insumos)
INSERT INTO public.bom_items (modelo, talla, insumo_id, cantidad, notas)
SELECT 'Rex', '6 pies', id, cantidad, notas FROM (VALUES
  ('Tela',           23,   '23M + 1M diseño'),
  ('Algodón',         2,   NULL),
  ('Espuma',          7,   '2 plan x 2pgd + 3 plan x 0.5pgd'),
  ('Resorte',        12,   '11 dientes'),
  ('Napa',           15,   NULL),
  ('Picadillo',       1,   NULL),
  ('Terocal',         1,   NULL),
  ('Clavo resortes', 48,   NULL),
  ('Costales',       15,   NULL),
  ('Poliseda',        2.5, NULL),
  ('Patas de madera',13,   NULL),
  ('Panqueque',       8.5, NULL),
  ('Grapa casco',     2,   '2 pgd')
) AS v(nombre, cantidad, notas)
JOIN ids USING (nombre)
ON CONFLICT (modelo, talla, insumo_id) DO UPDATE
  SET cantidad = EXCLUDED.cantidad, notas = EXCLUDED.notas;
```

### 2.4 Insertar BOM — Modelo Lineal Punta (6 pies)

```sql
WITH ids AS (SELECT nombre, id FROM public.insumos)
INSERT INTO public.bom_items (modelo, talla, insumo_id, cantidad, notas)
SELECT 'Lineal Punta', '6 pies', id, cantidad, notas FROM (VALUES
  ('Tela',           22,   '22M + 1M diseño'),
  ('Algodón',         2,   NULL),
  ('Espuma',          7,   '1 plan x 2pgd sobra 30cm + 3 plan x 0.5pgd'),
  ('Resorte',        12,   '11 dientes'),
  ('Napa',           15,   NULL),
  ('Picadillo',       1,   NULL),
  ('Terocal',         1,   NULL),
  ('Clavo resortes', 48,   NULL),
  ('Costales',       15,   NULL),
  ('Poliseda',        2.5, NULL),
  ('Patas de madera',13,   NULL),
  ('Panqueque',       8,   NULL),
  ('Grapa casco',     2,   '2 pgd')
) AS v(nombre, cantidad, notas)
JOIN ids USING (nombre)
ON CONFLICT (modelo, talla, insumo_id) DO UPDATE
  SET cantidad = EXCLUDED.cantidad, notas = EXCLUDED.notas;
```

### 2.5 Insertar BOM — Modelo London (6 pies)

```sql
WITH ids AS (SELECT nombre, id FROM public.insumos)
INSERT INTO public.bom_items (modelo, talla, insumo_id, cantidad, notas)
SELECT 'London', '6 pies', id, cantidad, notas FROM (VALUES
  ('Tela',           24,   'entero 23M + 1M'),
  ('Algodón',        22.5, '3/4 de paquete de 30kg'),
  ('Espuma',          2,   'menos de mitad, reuso'),
  ('Resorte',        12,   '11 dientes'),
  ('Napa',            7.5, NULL),
  ('Picadillo',       3,   NULL),
--   ('Terocal',         0,   'sin terocal'),
  ('Clavo resortes', 48,   NULL),
  ('Costales',       15,   NULL),
  ('Poliseda',        2.5, NULL),
  ('Patas de madera',13,   NULL),
  ('Panqueque',       3,   'decorativo'),
  ('Grapa casco',     2,   '2 pgd'),
  ('Plato',           6,   NULL)
) AS v(nombre, cantidad, notas)
JOIN ids USING (nombre)
ON CONFLICT (modelo, talla, insumo_id) DO UPDATE
  SET cantidad = EXCLUDED.cantidad, notas = EXCLUDED.notas;
```

### 2.6 Insertar BOM — Modelo Garra (6 pies)

```sql
WITH ids AS (SELECT nombre, id FROM public.insumos)
INSERT INTO public.bom_items (modelo, talla, insumo_id, cantidad, notas)
SELECT 'Garra', '6 pies', id, cantidad, notas FROM (VALUES
  ('Tela',           21,   '21M + 1M'),
  ('Algodón',        45,   'bolsa y media ~45kg'),
  ('Espuma',          4,   '4 plan x 0.5pgd'),
  ('Resorte',        12,   '11 dientes'),
  ('Napa',            2,   'decorativo'),
  ('Terocal',         0.01,'10 gramos'),
  ('Clavo resortes', 48,   NULL),
  ('Costales',       15,   NULL),
  ('Poliseda',        2.5, NULL),
  ('Patas de madera',13,   NULL),
  ('Panqueque',       2.5, NULL),
  ('Grapa casco',     2,   '2 pgd'),
  ('Plato',           6,   NULL)
) AS v(nombre, cantidad, notas)
JOIN ids USING (nombre)
ON CONFLICT (modelo, talla, insumo_id) DO UPDATE
  SET cantidad = EXCLUDED.cantidad, notas = EXCLUDED.notas;
```

> **Nota sobre tallas menores (2, 2.5, 3, 3.5, 4, 5 pies):** El Excel solo documenta las diferencias en madera (pies y palos) para las tallas menores — los demás insumos se reducen proporcionalmente. Cuando tengas la tabla de proporciones exactas, inserta los BOM de tallas menores con el mismo patrón. La estructura de DB ya lo soporta.

---

## 3. Funciones en `pos.functions.ts`

Añade estas funciones al archivo existente:

```ts
// ── INSUMOS ──────────────────────────────────────────────────

export async function listInsumos() {
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("insumos")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return { insumos: data ?? [] };
}

export async function upsertInsumo(input: {
  id?: string;
  nombre: string;
  unidad: string;
  stock_actual?: number;
  stock_minimo?: number;
  precio_unit?: number | null;
  proveedor?: string | null;
}) {
  const data = z.object({
    id:           z.string().uuid().optional(),
    nombre:       z.string().min(1).max(100),
    unidad:       z.string().min(1),
    stock_actual: z.number().min(0).optional(),
    stock_minimo: z.number().min(0).optional(),
    precio_unit:  z.number().min(0).optional().nullable(),
    proveedor:    z.string().max(200).optional().nullable(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { data: row, error } = await supabase
    .from("insumos")
    .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { insumo: row };
}

export async function registrarMovimiento(input: {
  insumo_id: string;
  tipo: "entrada" | "salida" | "ajuste";
  cantidad: number;
  motivo?: string;
  referencia?: string;
}) {
  const data = z.object({
    insumo_id:  z.string().uuid(),
    tipo:       z.enum(["entrada", "salida", "ajuste"]),
    cantidad:   z.number(),
    motivo:     z.string().max(500).optional(),
    referencia: z.string().max(100).optional(),
  }).parse(input);

  const { supabase, userId } = await getAuthenticatedClient();
  const { error } = await supabase
    .from("insumo_movimientos")
    .insert({ ...data, registrado_por: userId });
  if (error) throw new Error(error.message);
  return { ok: true };
}

// BOM
export async function getBom(input: { modelo: string; talla: string }) {
  const { modelo, talla } = z.object({
    modelo: z.string().min(1),
    talla:  z.string().min(1),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("bom_items")
    .select("*, insumos(id, nombre, unidad, stock_actual)")
    .eq("modelo", modelo)
    .eq("talla", talla)
    .order("created_at");
  if (error) throw new Error(error.message);
  return { items: data ?? [] };
}

// Calculadora MRP: ¿cuánto insumo necesito para N juegos?
export async function calcularMrp(input: {
  pedidos: Array<{ modelo: string; talla: string; cantidad: number }>;
}) {
  const { pedidos } = z.object({
    pedidos: z.array(z.object({
      modelo:   z.string().min(1),
      talla:    z.string().min(1),
      cantidad: z.number().int().positive(),
    })).min(1),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();

  // Obtener todos los BOM relevantes de una vez
  const combinaciones = pedidos.map((p) => `(modelo.eq.${p.modelo},talla.eq.${p.talla})`);
  const { data: boms, error } = await supabase
    .from("bom_items")
    .select("modelo, talla, cantidad, insumos(id, nombre, unidad, stock_actual)")
    .or(combinaciones.join(","));
  if (error) throw new Error(error.message);

  // Agregar necesidad total por insumo
  const necesidad: Record<string, {
    nombre: string; unidad: string; stock_actual: number;
    necesario: number; faltante: number;
  }> = {};

  for (const pedido of pedidos) {
    const bomDelPedido = boms?.filter(
      (b) => b.modelo === pedido.modelo && b.talla === pedido.talla
    ) ?? [];

    for (const item of bomDelPedido) {
      const ins = item.insumos as any;
      if (!ins) continue;
      if (!necesidad[ins.id]) {
        necesidad[ins.id] = {
          nombre: ins.nombre,
          unidad: ins.unidad,
          stock_actual: Number(ins.stock_actual),
          necesario: 0,
          faltante: 0,
        };
      }
      necesidad[ins.id].necesario += Number(item.cantidad) * pedido.cantidad;
    }
  }

  // Calcular faltantes
  for (const key of Object.keys(necesidad)) {
    const n = necesidad[key];
    n.faltante = Math.max(0, n.necesario - n.stock_actual);
  }

  return {
    resultado: Object.values(necesidad).sort((a, b) => b.faltante - a.faltante),
    hayFaltantes: Object.values(necesidad).some((n) => n.faltante > 0),
  };
}

// Alertas de stock bajo
export async function getStockBajo() {
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("v_insumos_stock_bajo")
    .select("*");
  if (error) throw new Error(error.message);
  return { alertas: data ?? [] };
}
```

---

## 4. Ruta `/insumos` — Panel MRP completo

Crea el archivo `src/routes/_authenticated/insumos.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listInsumos, upsertInsumo, registrarMovimiento,
  getBom, calcularMrp, getStockBajo,
} from "@/lib/pos.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Loader2, AlertTriangle, Plus, ArrowDown, ArrowUp, Calculator, Package } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/insumos")({
  head: () => ({ meta: [{ title: "Insumos MRP — G&M" }] }),
  component: InsumosPage,
});

const MODELOS = ["Vintage", "Rex", "Lineal Punta", "London", "Garra"] as const;
const TALLAS  = ["2 pies", "2.5 pies", "3 pies", "3.5 pies", "4 pies", "5 pies", "6 pies"] as const;
const UNIDADES = ["metros", "kg", "litros", "unidades", "planchas", "piezas", "paquetes", "palos", "pies", "bolsas"];

const fmt = (n: number, u: string) => `${n % 1 === 0 ? n : n.toFixed(2)} ${u}`;

// ── Calculadora MRP ──────────────────────────────────────────
function CalculadoraMrp() {
  const [pedidos, setPedidos] = useState<Array<{ modelo: string; talla: string; cantidad: number }>>([
    { modelo: "Vintage", talla: "6 pies", cantidad: 1 },
  ]);
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof calcularMrp>> | null>(null);
  const [loading, setLoading] = useState(false);

  const addFila = () =>
    setPedidos((p) => [...p, { modelo: "Vintage", talla: "6 pies", cantidad: 1 }]);

  const removeFila = (i: number) =>
    setPedidos((p) => p.filter((_, idx) => idx !== i));

  const update = (i: number, field: string, value: string | number) =>
    setPedidos((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

  const calcular = async () => {
    setLoading(true);
    try {
      const res = await calcularMrp({ pedidos });
      setResultado(res);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {pedidos.map((row, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs mb-1 block">Modelo</Label>
              <Select value={row.modelo} onValueChange={(v) => update(i, "modelo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Label className="text-xs mb-1 block">Talla</Label>
              <Select value={row.talla} onValueChange={(v) => update(i, "talla", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TALLAS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-20">
              <Label className="text-xs mb-1 block">Cantidad</Label>
              <Input
                type="number" min={1} value={row.cantidad}
                onChange={(e) => update(i, "cantidad", Number(e.target.value))}
              />
            </div>
            {pedidos.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => removeFila(i)}>✕</Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addFila}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Añadir modelo
        </Button>
        <Button onClick={calcular} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          <Calculator className="h-4 w-4 mr-2" /> Calcular
        </Button>
      </div>

      {resultado && (
        <div className="mt-4 space-y-2">
          {resultado.hayFaltantes && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              Hay insumos insuficientes para completar estos pedidos.
            </div>
          )}
          {!resultado.hayFaltantes && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              ✓ Stock suficiente para todos los pedidos.
            </div>
          )}
          <div className="border rounded-xl overflow-hidden mt-2">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-xs text-muted-foreground">Insumo</th>
                  <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">Necesario</th>
                  <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">En stock</th>
                  <th className="px-3 py-2 text-right font-medium text-xs text-muted-foreground">Faltante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {resultado.resultado.map((r) => (
                  <tr key={r.nombre} className={r.faltante > 0 ? "bg-red-50/50" : ""}>
                    <td className="px-3 py-2 font-medium">{r.nombre}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{fmt(r.necesario, r.unidad)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.stock_actual, r.unidad)}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {r.faltante > 0
                        ? <span className="text-red-600">−{fmt(r.faltante, r.unidad)}</span>
                        : <span className="text-green-600">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal movimiento de stock ─────────────────────────────────
function MovimientoDialog({ insumoId, insumoNombre, onDone }: {
  insumoId: string; insumoNombre: string; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"entrada" | "salida" | "ajuste">("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");

  const mut = useMutation({
    mutationFn: () => registrarMovimiento({
      insumo_id: insumoId, tipo,
      cantidad: tipo === "ajuste" ? Number(cantidad) : Math.abs(Number(cantidad)),
      motivo: motivo || undefined,
    }),
    onSuccess: () => {
      toast.success("Movimiento registrado");
      setOpen(false); setCantidad(""); setMotivo("");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ArrowDown className="h-3.5 w-3.5 mr-1" /> Stock
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar movimiento — {insumoNombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada (compra / recepción)</SelectItem>
                <SelectItem value="salida">Salida (producción / merma)</SelectItem>
                <SelectItem value="ajuste">Ajuste de inventario</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">
              Cantidad {tipo === "ajuste" ? "(+ para sumar, − para restar)" : ""}
            </Label>
            <Input
              className="mt-1" type="number"
              placeholder={tipo === "ajuste" ? "−5 o +10" : "0"}
              value={cantidad} onChange={(e) => setCantidad(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Motivo (opcional)</Label>
            <Input
              className="mt-1" placeholder="Compra proveedor, Pedido #123..."
              value={motivo} onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={!cantidad || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Registrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal editar / crear insumo ───────────────────────────────
function InsumoDialog({ insumo, onDone }: { insumo?: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    id:           insumo?.id,
    nombre:       insumo?.nombre ?? "",
    unidad:       insumo?.unidad ?? "unidades",
    stock_minimo: insumo?.stock_minimo ?? 0,
    precio_unit:  insumo?.precio_unit ?? "",
    proveedor:    insumo?.proveedor ?? "",
  });

  const mut = useMutation({
    mutationFn: () => upsertInsumo({ ...form, precio_unit: form.precio_unit ? Number(form.precio_unit) : null }),
    onSuccess: () => {
      toast.success(insumo ? "Insumo actualizado" : "Insumo creado");
      setOpen(false); onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {insumo
          ? <Button size="sm" variant="ghost">Editar</Button>
          : <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuevo insumo</Button>
        }
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{insumo ? "Editar insumo" : "Nuevo insumo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {[
            { label: "Nombre", key: "nombre", placeholder: "Ej: Tela" },
            { label: "Stock mínimo", key: "stock_minimo", placeholder: "0", type: "number" },
            { label: "Precio unit. (S/)", key: "precio_unit", placeholder: "0.00", type: "number" },
            { label: "Proveedor", key: "proveedor", placeholder: "Nombre del proveedor" },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <Label className="text-xs">{label}</Label>
              <Input
                className="mt-1" type={type ?? "text"}
                placeholder={placeholder}
                value={(form as any)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div>
            <Label className="text-xs">Unidad</Label>
            <Select value={form.unidad} onValueChange={(v) => setForm((f) => ({ ...f, unidad: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            disabled={!form.nombre || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {insumo ? "Guardar" : "Crear"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────
function InsumosPage() {
  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [tab, setTab] = useState("stock");

  const { data: insumosData, isLoading } = useQuery({
    queryKey: ["insumos"],
    queryFn: listInsumos,
  });

  const { data: alertasData } = useQuery({
    queryKey: ["insumos-alertas"],
    queryFn: getStockBajo,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["insumos"] });
    qc.invalidateQueries({ queryKey: ["insumos-alertas"] });
  };

  const filtrados = useMemo(() => {
    const list = insumosData?.insumos ?? [];
    if (!busqueda.trim()) return list;
    return list.filter((i: any) =>
      i.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );
  }, [insumosData, busqueda]);

  const alertaCount = alertasData?.alertas?.length ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-semibold">Insumos MRP</h1>
        <p className="text-muted-foreground mt-0.5">Control de materiales y lista de insumos por modelo</p>
      </div>

      {alertaCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
          <span>
            <strong>{alertaCount} insumo{alertaCount > 1 ? "s" : ""}</strong> por debajo del stock mínimo:{" "}
            {alertasData!.alertas.slice(0, 3).map((a: any) => a.nombre).join(", ")}
            {alertaCount > 3 ? ` y ${alertaCount - 3} más.` : "."}
          </span>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="stock" className="gap-1.5">
            <Package className="h-4 w-4" /> Stock
            {alertaCount > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {alertaCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="mrp">
            <Calculator className="h-4 w-4 mr-1.5" /> Calcular MRP
          </TabsTrigger>
        </TabsList>

        {/* Tab: Stock */}
        <TabsContent value="stock" className="space-y-4 mt-4">
          <div className="flex gap-3">
            <Input
              className="flex-1"
              placeholder="Buscar insumo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <InsumoDialog onDone={refresh} />
          </div>

          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtrados.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Sin insumos.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b">
                    <tr>
                      {["Insumo", "Unidad", "Stock actual", "Stock mínimo", "Proveedor", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-xs text-muted-foreground uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filtrados.map((ins: any) => {
                      const bajo = ins.stock_actual < ins.stock_minimo;
                      return (
                        <tr key={ins.id} className={bajo ? "bg-amber-50/40" : "hover:bg-muted/20"}>
                          <td className="px-4 py-3 font-medium">
                            {ins.nombre}
                            {bajo && (
                              <AlertTriangle className="inline h-3.5 w-3.5 text-amber-500 ml-1.5" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{ins.unidad}</td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${bajo ? "text-amber-600" : "text-foreground"}`}>
                              {ins.stock_actual} {ins.unidad}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {ins.stock_minimo} {ins.unidad}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {ins.proveedor ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              <MovimientoDialog
                                insumoId={ins.id}
                                insumoNombre={ins.nombre}
                                onDone={refresh}
                              />
                              <InsumoDialog insumo={ins} onDone={refresh} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Calculadora MRP */}
        <TabsContent value="mrp" className="mt-4">
          <div className="bg-card border border-border/50 rounded-xl p-5">
            <h3 className="font-semibold mb-1">Calculadora de insumos</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Selecciona los modelos y cantidades a producir. El sistema calcula qué insumos necesitas
              y si el stock actual es suficiente.
            </p>
            <CalculadoraMrp />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 5. Añadir al sidebar

Edita `src/components/AppSidebar.tsx`:

```tsx
// Importar el ícono apropiado
import { ..., Boxes } from "lucide-react";

// Añadir en el array de items, después de "Pedidos" o "CRM":
{ title: "Insumos MRP", url: "/insumos", icon: Boxes, roles: ["admin", "vendedor"] as AppRole[] },
```

---

## 6. Lista de verificación

### Base de datos (en orden)
- [ ] Crear tipo `unidad_insumo`
- [ ] Crear tabla `insumos` con RLS
- [ ] Crear tabla `bom_items` con RLS
- [ ] Crear tabla `insumo_movimientos` con trigger `trg_stock_insumo`
- [ ] Crear vista `v_insumos_stock_bajo`
- [ ] Ejecutar seed de insumos (19 insumos base)
- [ ] Ejecutar seed BOM: Vintage, Rex, Lineal Punta, London, Garra (talla 6 pies)

### Código
- [ ] Añadir 6 funciones en `pos.functions.ts`: `listInsumos`, `upsertInsumo`, `registrarMovimiento`, `getBom`, `calcularMrp`, `getStockBajo`
- [ ] Crear `src/routes/_authenticated/insumos.tsx` con el código completo
- [ ] Añadir item "Insumos MRP" en `AppSidebar.tsx`
- [ ] Verificar que `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` existen en `src/components/ui/` (son shadcn/ui — si no están, instalar con `npx shadcn@latest add tabs`)

### Verificación funcional
- [ ] `/insumos` carga con los 19 insumos
- [ ] Alerta amarilla aparece cuando `stock_actual < stock_minimo`
- [ ] "Registrar movimiento → entrada" aumenta `stock_actual`
- [ ] "Registrar movimiento → salida" reduce `stock_actual`
- [ ] Calculadora MRP: seleccionar Vintage 6 pies × 2 → muestra necesidades correctas
- [ ] Calculadora MRP marca en rojo los insumos con faltante
- [ ] Crear nuevo insumo desde el panel funciona

---

## 7. Notas importantes

**Renombrar modelos:** Cuando tengas los nombres definitivos, un solo UPDATE lo cambia todo:
```sql
UPDATE public.bom_items SET modelo = 'Nuevo Nombre' WHERE modelo = 'Vintage';
UPDATE public.bom_items SET modelo = 'Otro Nombre'  WHERE modelo = 'Rex';
```

**Tallas menores:** El Excel solo documenta la madera para tallas <6 pies. Los demás insumos (tela, algodón, resortes, etc.) también varían. Cuando tengas esos datos, el insert de BOM es idéntico al de 6 pies cambiando el parámetro `talla` y los valores de cantidad.

**`calcularMrp` y la limitación de `.or()`:** La función construye un OR dinámico para Supabase. Si en el futuro tienes más de ~10 combinaciones simultáneas, considera reemplazarlo por una función RPC en SQL para mejor rendimiento.

**Integración con producción:** Cuando se cambia un pedido a `en_produccion` (módulo 2), puedes llamar automáticamente a `registrarMovimiento` con `tipo: "salida"` para cada insumo del BOM correspondiente. Eso mantiene el stock siempre actualizado sin entrada manual.











































































































































































































# Módulo 5 — Producción y Órdenes de Fabricación
**G&M Mueblería** · Panel de carpintería + integración MRP + vista carpintero

---

## Estado real del código

| Pieza | Estado |
|---|---|
| Tabla `produccion` | ✅ Existe (migración `20260605b_produccion_tablas.sql`) |
| Tabla `order_estado_historial` | ✅ Existe, con trigger automático |
| Tabla `notificaciones` | ✅ Existe |
| Función RPC `cambiar_estado_pedido` | ✅ Existe y valida transiciones |
| Vista `v_produccion_panel` | ✅ Existe |
| Rol `carpintero` en enum `app_role` | ✅ Existe |
| RLS `carpintero` en `produccion` | ✅ Existe (solo sus propios registros) |
| Ruta `/produccion` (frontend) | ❌ No existe — construir desde cero |
| Vista del carpintero (`/mi-produccion`) | ❌ No existe — construir desde cero |
| Integración MRP al pasar a `en_produccion` | ❌ No existe — ampliar `cambiar_estado_pedido` |
| `AppRole` incluye `carpintero` | ❌ Solo tiene `admin\|vendedor\|cliente` — corregir |
| Sidebar muestra rutas de producción | ❌ No existe — añadir |

---

## ⚠️ Correcciones previas obligatorias

### 1. `useAuth.ts` — añadir `carpintero` al tipo `AppRole`

El hook actual solo conoce `"admin" | "vendedor" | "cliente"`. El carpintero existe en DB pero el frontend lo ignora, así que un usuario con ese rol no ve nada en el sidebar y el `_authenticated` layout no lo deja pasar.

```ts
// src/hooks/useAuth.ts — línea 4
// ❌ Actual
export type AppRole = "admin" | "vendedor" | "cliente";

// ✅ Corrección
export type AppRole = "admin" | "vendedor" | "cliente" | "carpintero";
```

### 2. `_authenticated.tsx` — permitir acceso a carpinteros

El layout redirige a `/login` si el usuario no tiene sesión, pero no valida roles específicos por ruta (eso lo hace cada ruta individualmente). Solo hay que asegurarse de que el carpintero llega al layout. **Este archivo no necesita cambios** siempre que `useAuth` devuelva `carpintero` en su array de roles.

### 3. Bug en `pedidos.tsx` — Dialog siempre cerrado

```tsx
// ❌ Actual (bug: !selectedId !== null siempre es true, pero &&false cierra todo)
<Dialog open={!!selectedId && !selectedId !== null} ...>

// ✅ Corrección
<Dialog open={!!selectedId} ...>
```

---

## 1. Migración adicional — Integración MRP en producción

Esta migración amplía la función `cambiar_estado_pedido` para que al pasar un pedido a `en_produccion` también descuente automáticamente los insumos del BOM del módulo 4.

**Ejecutar solo después de tener las tablas `insumos` y `bom_items` del módulo 4.**

```sql
-- migrations/20260606_produccion_mrp_integration.sql
-- Ampliar cambiar_estado_pedido para descontar insumos al iniciar producción

CREATE OR REPLACE FUNCTION public.cambiar_estado_pedido(
  _order_id     UUID,
  _nuevo_estado public.order_status,
  _motivo       TEXT DEFAULT NULL,
  _modelo       TEXT DEFAULT NULL,   -- NUEVO: nombre del modelo (ej: 'Vintage')
  _talla        TEXT DEFAULT NULL    -- NUEVO: talla (ej: '6 pies')
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _order   public.orders;
  _ok      BOOLEAN := false;
  _bom_row RECORD;
BEGIN
  IF NOT (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'vendedor')) THEN
    RAISE EXCEPTION 'Sin permisos para cambiar estado de pedidos';
  END IF;

  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;

  -- Validar transición
  _ok := CASE _order.status
    WHEN 'pendiente'        THEN _nuevo_estado IN ('pagado', 'cancelado')
    WHEN 'pagado'           THEN _nuevo_estado IN ('en_produccion', 'cancelado')
    WHEN 'en_produccion'    THEN _nuevo_estado IN ('control_calidad', 'cancelado')
    WHEN 'control_calidad'  THEN _nuevo_estado IN ('listo_despacho', 'en_produccion')
    WHEN 'listo_despacho'   THEN _nuevo_estado IN ('enviado', 'entregado')
    WHEN 'enviado'          THEN _nuevo_estado IN ('entregado')
    ELSE false
  END;

  IF NOT _ok THEN
    RAISE EXCEPTION 'Transición inválida: % → %', _order.status, _nuevo_estado;
  END IF;

  UPDATE public.orders
  SET status = _nuevo_estado, updated_at = now()
  WHERE id = _order_id;

  -- Al iniciar producción: crear registro + descontar insumos del BOM
  IF _nuevo_estado = 'en_produccion' THEN
    INSERT INTO public.produccion (order_id, fecha_inicio, fecha_fin_estimada)
    VALUES (_order_id, now()::DATE, (now() + INTERVAL '7 days')::DATE)
    ON CONFLICT (order_id) DO UPDATE SET
      status       = 'en_proceso',
      fecha_inicio = COALESCE(produccion.fecha_inicio, now()::DATE),
      updated_at   = now();

    -- Descontar insumos si se especificó modelo+talla y la tabla bom_items existe
    IF _modelo IS NOT NULL AND _talla IS NOT NULL THEN
      FOR _bom_row IN
        SELECT b.insumo_id, b.cantidad
        FROM public.bom_items b
        WHERE b.modelo = _modelo AND b.talla = _talla
      LOOP
        INSERT INTO public.insumo_movimientos
          (insumo_id, tipo, cantidad, motivo, referencia, registrado_por)
        VALUES (
          _bom_row.insumo_id,
          'salida',
          _bom_row.cantidad,
          'Producción iniciada',
          _order.order_number,
          _user_id
        );
      END LOOP;
    END IF;
  END IF;

  -- Encolar notificación (igual que antes)
  INSERT INTO public.notificaciones
    (order_id, destinatario_email, destinatario_nombre, tipo, canal, asunto)
  VALUES (
    _order_id,
    _order.email,
    _order.nombre,
    CASE _nuevo_estado
      WHEN 'pagado'          THEN 'pedido_confirmado'
      WHEN 'en_produccion'   THEN 'en_produccion'
      WHEN 'control_calidad' THEN 'control_calidad'
      WHEN 'listo_despacho'  THEN 'listo_despacho'
      WHEN 'entregado'       THEN 'entregado'
      WHEN 'cancelado'       THEN 'cancelado'
    END::public.notif_tipo,
    'email',
    CASE _nuevo_estado
      WHEN 'pagado'          THEN 'Pedido confirmado — G&M Mueblería'
      WHEN 'en_produccion'   THEN 'Tu mueble está en producción'
      WHEN 'listo_despacho'  THEN 'Tu pedido está listo para despacho'
      WHEN 'entregado'       THEN '¡Tu pedido fue entregado!'
      WHEN 'cancelado'       THEN 'Pedido cancelado'
      ELSE NULL
    END
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', _order_id,
    'estado_anterior', _order.status,
    'estado_nuevo', _nuevo_estado
  );
END;
$$;

-- Función RPC para que el carpintero actualice su propio registro de producción
CREATE OR REPLACE FUNCTION public.actualizar_produccion(
  _produccion_id  UUID,
  _status         public.produccion_status DEFAULT NULL,
  _observaciones  TEXT DEFAULT NULL,
  _prioridad      SMALLINT DEFAULT NULL,
  _fecha_fin_real DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _prod    public.produccion;
BEGIN
  SELECT * INTO _prod FROM public.produccion WHERE id = _produccion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro de producción no encontrado'; END IF;

  -- Carpintero solo puede actualizar su propio registro
  IF public.has_role(_user_id, 'carpintero') AND _prod.asignado_a <> _user_id THEN
    RAISE EXCEPTION 'Solo puedes actualizar tus propias órdenes de fabricación';
  END IF;

  -- Admin/vendedor puede actualizar cualquier registro
  IF NOT (
    public.has_role(_user_id, 'admin') OR
    public.has_role(_user_id, 'vendedor') OR
    public.has_role(_user_id, 'carpintero')
  ) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  UPDATE public.produccion SET
    status         = COALESCE(_status, status),
    observaciones  = COALESCE(_observaciones, observaciones),
    prioridad      = COALESCE(_prioridad, prioridad),
    fecha_fin_real = COALESCE(_fecha_fin_real, fecha_fin_real),
    updated_at     = now()
  WHERE id = _produccion_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_produccion TO authenticated;

-- Función para asignar carpintero a una orden de producción (solo admin/vendedor)
CREATE OR REPLACE FUNCTION public.asignar_carpintero(
  _produccion_id UUID,
  _carpintero_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor')) THEN
    RAISE EXCEPTION 'Sin permisos para asignar carpinteros';
  END IF;

  UPDATE public.produccion
  SET asignado_a = _carpintero_id, updated_at = now()
  WHERE id = _produccion_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.asignar_carpintero TO authenticated;

-- Vista para el carpintero: solo sus propias órdenes activas
CREATE OR REPLACE VIEW public.v_mi_produccion AS
SELECT
  p.id              AS produccion_id,
  o.id              AS order_id,
  o.order_number,
  o.nombre          AS cliente,
  o.telefono,
  o.total,
  o.status          AS order_status,
  p.status          AS prod_status,
  p.prioridad,
  p.fecha_inicio,
  p.fecha_fin_estimada,
  p.fecha_fin_real,
  p.observaciones,
  p.calidad_aprobada,
  p.asignado_a
FROM public.produccion p
JOIN public.orders o ON o.id = p.order_id
WHERE p.status NOT IN ('terminado');

GRANT SELECT ON public.v_mi_produccion TO authenticated;
```

---

## 2. Funciones en `pos.functions.ts`

Añade al archivo existente:

```ts
// ── PRODUCCIÓN ───────────────────────────────────────────────

// Panel admin: todas las órdenes de fabricación activas
export async function listProduccion() {
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("v_produccion_panel")
    .select("*")
    .order("prioridad", { ascending: true })
    .order("fecha_fin_estimada", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return { ordenes: data ?? [] };
}

// Vista del carpintero: sus propias órdenes
export async function listMiProduccion() {
  const { supabase, userId } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("v_mi_produccion")
    .select("*")
    .eq("asignado_a", userId)
    .order("prioridad", { ascending: true });
  if (error) throw new Error(error.message);
  return { ordenes: data ?? [] };
}

// Detalle completo de una orden (items del pedido + insumos BOM)
export async function getDetalleProduccion(input: { order_id: string }) {
  const { order_id } = z.object({ order_id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();

  const [itemsRes, produccionRes] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, sku, title, qty, unit_price, total, image_url")
      .eq("order_id", order_id),
    supabase
      .from("produccion")
      .select("*")
      .eq("order_id", order_id)
      .single(),
  ]);

  if (itemsRes.error) throw new Error(itemsRes.error.message);
  return {
    items: itemsRes.data ?? [],
    produccion: produccionRes.data ?? null,
  };
}

// Cambiar estado de orden incluyendo modelo+talla para descuento MRP
export async function cambiarEstadoPedido(input: {
  order_id: string;
  nuevo_estado: string;
  motivo?: string;
  modelo?: string;
  talla?: string;
}) {
  const data = z.object({
    order_id:     z.string().uuid(),
    nuevo_estado: z.string().min(1),
    motivo:       z.string().optional(),
    modelo:       z.string().optional(),
    talla:        z.string().optional(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { data: result, error } = await supabase.rpc("cambiar_estado_pedido", {
    _order_id:     data.order_id,
    _nuevo_estado: data.nuevo_estado,
    _motivo:       data.motivo ?? null,
    _modelo:       data.modelo ?? null,
    _talla:        data.talla ?? null,
  });
  if (error) throw new Error(error.message);
  return result;
}

// Actualizar estado interno de producción (carpintero o admin)
export async function actualizarProduccion(input: {
  produccion_id: string;
  status?: string;
  observaciones?: string;
  prioridad?: number;
  fecha_fin_real?: string;
}) {
  const data = z.object({
    produccion_id: z.string().uuid(),
    status:        z.string().optional(),
    observaciones: z.string().max(2000).optional(),
    prioridad:     z.number().int().min(1).max(3).optional(),
    fecha_fin_real: z.string().optional(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase.rpc("actualizar_produccion", {
    _produccion_id:  data.produccion_id,
    _status:         data.status ?? null,
    _observaciones:  data.observaciones ?? null,
    _prioridad:      data.prioridad ?? null,
    _fecha_fin_real: data.fecha_fin_real ?? null,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

// Asignar carpintero (solo admin/vendedor)
export async function asignarCarpintero(input: {
  produccion_id: string;
  carpintero_id: string;
}) {
  const data = z.object({
    produccion_id: z.string().uuid(),
    carpintero_id: z.string().uuid(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase.rpc("asignar_carpintero", {
    _produccion_id: data.produccion_id,
    _carpintero_id: data.carpintero_id,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

// Listar carpinteros disponibles (para el selector de asignación)
export async function listCarpinteros() {
  const { supabase } = await getAuthenticatedClient();
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "carpintero");

  if (!roles?.length) return { carpinteros: [] };

  const ids = roles.map((r) => r.user_id);
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return { carpinteros: profiles ?? [] };
}
```

---

## 3. Ruta `/produccion` — Panel admin de fabricación

Crea `src/routes/_authenticated/produccion.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listProduccion, getDetalleProduccion, actualizarProduccion,
  asignarCarpintero, listCarpinteros,
} from "@/lib/pos.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, Hammer, AlertTriangle, CheckCircle2,
  Pause, Clock, Eye, UserCheck, RefreshCw,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format, isPast, isToday } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/produccion")({
  head: () => ({ meta: [{ title: "Producción — G&M" }] }),
  component: ProduccionPage,
});

// ── Configuración visual ─────────────────────────────────────
const PROD_STATUS_CONFIG = {
  pendiente:          { label: "Pendiente",         color: "#92400e", bg: "#fef3c7", icon: Clock },
  en_proceso:         { label: "En proceso",        color: "#1e40af", bg: "#dbeafe", icon: Hammer },
  pausado:            { label: "Pausado",            color: "#6b7280", bg: "#f3f4f6", icon: Pause },
  terminado:          { label: "Terminado",          color: "#14532d", bg: "#dcfce7", icon: CheckCircle2 },
  rechazado_calidad:  { label: "Rechazado calidad", color: "#7f1d1d", bg: "#fee2e2", icon: AlertTriangle },
} as const;

const PRIORIDAD_CONFIG = {
  1: { label: "Urgente", color: "#dc2626", bg: "#fee2e2" },
  2: { label: "Normal",  color: "#2563eb", bg: "#dbeafe" },
  3: { label: "Baja",    color: "#6b7280", bg: "#f3f4f6" },
} as const;

type ProdStatus = keyof typeof PROD_STATUS_CONFIG;

const fmt    = (n: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
const fmtDay = (d: string | null) => d ? format(new Date(d), "dd MMM yyyy", { locale: es }) : "—";

// ── Determinar urgencia por fecha fin estimada ────────────────
function getFechaUrgencia(fecha: string | null): "vencida" | "hoy" | "normal" | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isPast(d) && !isToday(d)) return "vencida";
  if (isToday(d)) return "hoy";
  return "normal";
}

// ── Dialog detalle de orden de fabricación ───────────────────
function OrdenDetalle({
  orden,
  onClose,
}: {
  orden: any;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [editObs, setEditObs] = useState(false);
  const [obs, setObs] = useState(orden.observaciones ?? "");
  const [asignarOpen, setAsignarOpen] = useState(false);
  const [carpinteroId, setCarpinteroId] = useState(orden.asignado_a ?? "");

  const { data: detalle, isLoading } = useQuery({
    queryKey: ["produccion-detalle", orden.order_id],
    queryFn: () => getDetalleProduccion({ order_id: orden.order_id }),
  });

  const { data: carpinterosData } = useQuery({
    queryKey: ["carpinteros"],
    queryFn: listCarpinteros,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["produccion"] });
    qc.invalidateQueries({ queryKey: ["produccion-detalle", orden.order_id] });
  };

  const statusMut = useMutation({
    mutationFn: (status: string) =>
      actualizarProduccion({ produccion_id: detalle!.produccion!.id, status }),
    onSuccess: () => { toast.success("Estado actualizado"); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const obsMut = useMutation({
    mutationFn: () =>
      actualizarProduccion({ produccion_id: detalle!.produccion!.id, observaciones: obs }),
    onSuccess: () => { toast.success("Observaciones guardadas"); setEditObs(false); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });

  const asignarMut = useMutation({
    mutationFn: () =>
      asignarCarpintero({ produccion_id: detalle!.produccion!.id, carpintero_id: carpinteroId }),
    onSuccess: () => {
      toast.success("Carpintero asignado");
      setAsignarOpen(false);
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const prod = detalle?.produccion;
  const urgencia = getFechaUrgencia(prod?.fecha_fin_estimada ?? null);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <Hammer className="h-5 w-5" />
            Orden {orden.order_number}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !prod ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 mt-1">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Cliente</p>
                <p className="font-medium text-sm truncate">{orden.cliente}</p>
                <p className="text-xs text-muted-foreground">{orden.telefono ?? ""}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Fecha fin estimada</p>
                <p className={`font-semibold text-sm ${
                  urgencia === "vencida" ? "text-red-600" :
                  urgencia === "hoy" ? "text-amber-600" : ""
                }`}>
                  {fmtDay(prod.fecha_fin_estimada)}
                  {urgencia === "vencida" && " ⚠️"}
                  {urgencia === "hoy" && " 🔔"}
                </p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Prioridad</p>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    color: PRIORIDAD_CONFIG[prod.prioridad as 1 | 2 | 3].color,
                    background: PRIORIDAD_CONFIG[prod.prioridad as 1 | 2 | 3].bg,
                  }}
                >
                  {PRIORIDAD_CONFIG[prod.prioridad as 1 | 2 | 3].label}
                </span>
              </div>
            </div>

            {/* Estado interno + transiciones */}
            <div className="border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Estado de fabricación</p>
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5"
                    style={{
                      color: PROD_STATUS_CONFIG[prod.status as ProdStatus]?.color,
                      background: PROD_STATUS_CONFIG[prod.status as ProdStatus]?.bg,
                    }}
                  >
                    {prod.status === "en_proceso" && <Hammer className="h-3 w-3" />}
                    {PROD_STATUS_CONFIG[prod.status as ProdStatus]?.label}
                  </span>
                </div>

                {/* Asignar carpintero */}
                <Button size="sm" variant="outline" onClick={() => setAsignarOpen(true)}>
                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                  {orden.carpintero ? `Asignado: ${orden.carpintero}` : "Asignar carpintero"}
                </Button>
              </div>

              {/* Cambios de estado rápidos */}
              <div className="flex gap-2 flex-wrap">
                {([
                  ["en_proceso",        "Iniciar"],
                  ["pausado",           "Pausar"],
                  ["terminado",         "Marcar terminado"],
                  ["rechazado_calidad", "Rechazar calidad"],
                ] as [string, string][]).map(([s, label]) =>
                  s !== prod.status ? (
                    <Button
                      key={s} size="sm" variant="outline"
                      disabled={statusMut.isPending}
                      onClick={() => statusMut.mutate(s)}
                    >
                      {statusMut.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : null}
                      {label}
                    </Button>
                  ) : null
                )}
              </div>
            </div>

            {/* Ítems del pedido */}
            <section>
              <h4 className="font-semibold text-sm mb-2">Muebles a fabricar</h4>
              <div className="space-y-2">
                {(detalle?.items ?? []).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 text-sm">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title}
                        className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <Hammer className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                      {item.sku && <p className="text-xs text-muted-foreground font-mono">SKU: {item.sku}</p>}
                      <p className="text-xs text-muted-foreground">Cantidad: {item.qty}</p>
                    </div>
                    <span className="font-semibold">{fmt(Number(item.total))}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Observaciones */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">Observaciones internas</h4>
                {!editObs
                  ? <Button size="sm" variant="ghost" onClick={() => setEditObs(true)}>Editar</Button>
                  : <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditObs(false)}>Cancelar</Button>
                      <Button size="sm" disabled={obsMut.isPending} onClick={() => obsMut.mutate()}>
                        {obsMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                        Guardar
                      </Button>
                    </div>
                }
              </div>
              {editObs ? (
                <Textarea
                  rows={3} value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Notas de producción, materiales especiales, instrucciones..."
                  className="text-sm"
                />
              ) : (
                <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 min-h-[60px]">
                  {prod.observaciones ?? "Sin observaciones."}
                </p>
              )}
            </section>

            {/* Timeline */}
            <section className="grid grid-cols-3 gap-3 text-sm">
              {[
                ["Inicio",      fmtDay(prod.fecha_inicio)],
                ["Fin estimado", fmtDay(prod.fecha_fin_estimada)],
                ["Fin real",    fmtDay(prod.fecha_fin_real ?? null)],
              ].map(([label, value]) => (
                <div key={label} className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <p className="font-medium">{value}</p>
                </div>
              ))}
            </section>
          </div>
        )}

        {/* Dialog asignar carpintero */}
        {asignarOpen && (
          <Dialog open onOpenChange={setAsignarOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Asignar carpintero</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs">Carpintero</Label>
                  <Select value={carpinteroId} onValueChange={setCarpinteroId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {(carpinterosData?.carpinteros ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full" disabled={!carpinteroId || asignarMut.isPending}
                  onClick={() => asignarMut.mutate()}
                >
                  {asignarMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Asignar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ─────────────────────────────────────────
function ProduccionPage() {
  const qc = useQueryClient();
  const [selectedOrden, setSelectedOrden] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("todos");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["produccion"],
    queryFn: listProduccion,
    refetchInterval: 60_000,
  });

  const ordenes = data?.ordenes ?? [];

  const filtradas = useMemo(() => {
    if (statusFilter === "todos") return ordenes;
    return ordenes.filter((o: any) => o.prod_status === statusFilter);
  }, [ordenes, statusFilter]);

  const stats = useMemo(() => ({
    total:     ordenes.length,
    proceso:   ordenes.filter((o: any) => o.prod_status === "en_proceso").length,
    pendiente: ordenes.filter((o: any) => o.prod_status === "pendiente").length,
    vencidas:  ordenes.filter((o: any) => {
      if (!o.fecha_fin_estimada) return false;
      return isPast(new Date(o.fecha_fin_estimada)) && !isToday(new Date(o.fecha_fin_estimada));
    }).length,
  }), [ordenes]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Producción</h1>
          <p className="text-muted-foreground mt-0.5">Órdenes de fabricación activas</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total activas",  value: stats.total },
          { label: "En proceso",     value: stats.proceso },
          { label: "Pendientes",     value: stats.pendiente },
          { label: "Vencidas ⚠️",   value: stats.vencidas },
        ].map(({ label, value }) => (
          <div key={label} className={`border rounded-xl p-4 ${
            label.includes("Vencidas") && value > 0
              ? "bg-red-50 border-red-200"
              : "bg-card border-border/50"
          }`}>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="font-display text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros de estado */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "todos",             label: "Todas" },
          { key: "pendiente",         label: "Pendientes" },
          { key: "en_proceso",        label: "En proceso" },
          { key: "pausado",           label: "Pausadas" },
          { key: "rechazado_calidad", label: "Rechazadas" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
              statusFilter === key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border/50 hover:border-border"
            }`}
          >
            {label}
            <span className="ml-1.5 text-xs opacity-70">
              ({key === "todos" ? ordenes.length : ordenes.filter((o: any) => o.prod_status === key).length})
            </span>
          </button>
        ))}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Hammer className="h-10 w-10" />
          <p className="text-sm">No hay órdenes de fabricación activas</p>
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/40">
                  {["Pedido", "Cliente", "Carpintero", "Prioridad", "Estado", "Fin estimado", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-xs text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtradas.map((orden: any) => {
                  const ps = PROD_STATUS_CONFIG[orden.prod_status as ProdStatus];
                  const pr = PRIORIDAD_CONFIG[orden.prioridad as 1 | 2 | 3];
                  const urgencia = getFechaUrgencia(orden.fecha_fin_estimada);
                  const Icon = ps?.icon ?? Clock;

                  return (
                    <tr
                      key={orden.produccion_id}
                      className={`hover:bg-muted/20 transition-colors ${
                        urgencia === "vencida" ? "bg-red-50/30" :
                        urgencia === "hoy" ? "bg-amber-50/30" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium">{orden.order_number}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[130px]">{orden.cliente}</p>
                        <p className="text-xs text-muted-foreground">{fmt(Number(orden.total))}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {orden.carpintero ?? <span className="italic opacity-50">Sin asignar</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: pr?.color, background: pr?.bg }}>
                          {pr?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: ps?.color, background: ps?.bg }}>
                          <Icon className="h-3 w-3" />
                          {ps?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={
                          urgencia === "vencida" ? "text-red-600 font-semibold" :
                          urgencia === "hoy"     ? "text-amber-600 font-semibold" :
                          "text-muted-foreground"
                        }>
                          {fmtDay(orden.fecha_fin_estimada)}
                          {urgencia === "vencida" && " ⚠️"}
                          {urgencia === "hoy"     && " 🔔"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedOrden(orden)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedOrden && (
        <OrdenDetalle
          orden={selectedOrden}
          onClose={() => {
            setSelectedOrden(null);
            qc.invalidateQueries({ queryKey: ["produccion"] });
          }}
        />
      )}
    </div>
  );
}
```

---

## 4. Ruta `/mi-produccion` — Vista del carpintero

Crea `src/routes/_authenticated/mi-produccion.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listMiProduccion, actualizarProduccion, getDetalleProduccion } from "@/lib/pos.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Hammer, Clock, CheckCircle2, Pause, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/mi-produccion")({
  head: () => ({ meta: [{ title: "Mis órdenes — G&M" }] }),
  component: MiProduccionPage,
});

const PROD_STATUS = {
  pendiente:         { label: "Pendiente",         color: "#92400e", bg: "#fef3c7", icon: Clock },
  en_proceso:        { label: "En proceso",         color: "#1e40af", bg: "#dbeafe", icon: Hammer },
  pausado:           { label: "Pausado",             color: "#6b7280", bg: "#f3f4f6", icon: Pause },
  terminado:         { label: "Terminado",           color: "#14532d", bg: "#dcfce7", icon: CheckCircle2 },
  rechazado_calidad: { label: "Rechazado calidad",  color: "#7f1d1d", bg: "#fee2e2", icon: AlertTriangle },
} as const;

type ProdStatus = keyof typeof PROD_STATUS;

const fmtDay = (d: string | null) => d ? format(new Date(d), "dd MMM yyyy", { locale: es }) : "—";
const fmt    = (n: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

function OrdenCard({ orden }: { orden: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [obs, setObs] = useState(orden.observaciones ?? "");

  const { data: detalle, isLoading } = useQuery({
    queryKey: ["mi-produccion-detalle", orden.order_id],
    queryFn: () => getDetalleProduccion({ order_id: orden.order_id }),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: (status: string) =>
      actualizarProduccion({ produccion_id: orden.produccion_id, status }),
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["mi-produccion"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const obsMut = useMutation({
    mutationFn: () =>
      actualizarProduccion({ produccion_id: orden.produccion_id, observaciones: obs }),
    onSuccess: () => {
      toast.success("Observaciones guardadas");
      qc.invalidateQueries({ queryKey: ["mi-produccion"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const ps = PROD_STATUS[orden.prod_status as ProdStatus];
  const Icon = ps?.icon ?? Clock;

  return (
    <>
      <div className="bg-card border border-border/50 rounded-xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{orden.order_number}</p>
            <p className="font-display font-semibold text-lg">{orden.cliente}</p>
            <p className="text-sm text-muted-foreground">{orden.telefono ?? ""}</p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ color: ps?.color, background: ps?.bg }}
          >
            <Icon className="h-3.5 w-3.5" />
            {ps?.label}
          </span>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Inicio</p>
            <p className="font-medium">{fmtDay(orden.fecha_inicio)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Entrega estimada</p>
            <p className="font-medium">{fmtDay(orden.fecha_fin_estimada)}</p>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="flex gap-2 flex-wrap">
          {orden.prod_status !== "en_proceso" && (
            <Button size="sm" onClick={() => mut.mutate("en_proceso")} disabled={mut.isPending}>
              <Hammer className="h-3.5 w-3.5 mr-1" /> Iniciar
            </Button>
          )}
          {orden.prod_status === "en_proceso" && (
            <Button size="sm" variant="outline" onClick={() => mut.mutate("pausado")} disabled={mut.isPending}>
              <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
            </Button>
          )}
          {(orden.prod_status === "en_proceso" || orden.prod_status === "pausado") && (
            <Button size="sm" variant="outline" onClick={() => mut.mutate("terminado")} disabled={mut.isPending}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar terminado
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            Ver detalle
          </Button>
        </div>
      </div>

      {/* Dialog detalle */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{orden.order_number} — Detalle</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <section>
                <h4 className="font-semibold text-sm mb-2">Muebles</h4>
                <div className="space-y-2">
                  {(detalle?.items ?? []).map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">Cant: {item.qty} · {item.sku ?? ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="font-semibold text-sm mb-2">Observaciones</h4>
                <Textarea
                  rows={3} value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Notas de fabricación..."
                  className="text-sm"
                />
                <Button size="sm" className="mt-2" onClick={() => obsMut.mutate()} disabled={obsMut.isPending}>
                  {obsMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Guardar observaciones
                </Button>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MiProduccionPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["mi-produccion"],
    queryFn: listMiProduccion,
    refetchInterval: 120_000,
  });

  const ordenes = data?.ordenes ?? [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-semibold">Mis órdenes</h1>
        <p className="text-muted-foreground mt-0.5">
          {ordenes.length === 0
            ? "No tienes órdenes asignadas"
            : `${ordenes.length} orden${ordenes.length > 1 ? "es" : ""} asignada${ordenes.length > 1 ? "s" : ""}`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : ordenes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Hammer className="h-10 w-10" />
          <p className="text-sm">Sin órdenes asignadas por ahora</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ordenes.map((orden: any) => (
            <OrdenCard key={orden.produccion_id} orden={orden} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 5. Actualizar `AppSidebar.tsx`

```tsx
// Importar nuevos íconos
import { ..., Hammer, Boxes, Wrench } from "lucide-react";

// Reemplazar el array items con este:
const items = [
  { title: "POS",            url: "/pos",            icon: ShoppingCart, roles: ["admin", "vendedor"] as AppRole[] },
  { title: "Dashboard",      url: "/dashboard",      icon: LayoutDashboard, roles: ["admin", "vendedor"] as AppRole[] },
  { title: "Pedidos",        url: "/pedidos",        icon: ShoppingBag,  roles: ["admin", "vendedor"] as AppRole[] },
  { title: "Producción",     url: "/produccion",     icon: Hammer,       roles: ["admin", "vendedor"] as AppRole[] },
  { title: "Mis órdenes",    url: "/mi-produccion",  icon: Wrench,       roles: ["carpintero"] as AppRole[] },
  { title: "Ventas",         url: "/ventas",         icon: Receipt,      roles: ["admin", "vendedor"] as AppRole[] },
  { title: "Clientes",       url: "/clientes",       icon: Users,        roles: ["admin", "vendedor"] as AppRole[] },
  { title: "Insumos MRP",    url: "/insumos",        icon: Boxes,        roles: ["admin", "vendedor"] as AppRole[] },
  { title: "Productos",      url: "/productos",      icon: Package,      roles: ["admin"] as AppRole[] },
  { title: "Usuarios",       url: "/usuarios",       icon: UserCog,      roles: ["admin"] as AppRole[] },
];
```

El filtro `visible = items.filter((i) => i.roles.some((r) => roles.includes(r)))` ya existe y funciona — un carpintero solo verá "Mis órdenes". Un admin verá todo excepto "Mis órdenes".

---

## 6. Actualizar `pedidos.tsx` — pasar modelo+talla al cambiar estado

Al confirmar producción desde el panel de pedidos, hay que pasar el modelo y talla para que el descuento MRP funcione. Esto requiere un selector en el Dialog de detalle:

```tsx
// En PedidosPage, añadir estado para modelo/talla cuando se confirma producción
const [mrpForm, setMrpForm] = useState({ modelo: "", talla: "" });

// Reemplazar la llamada a cambiarEstado en el Dialog de detalle
// Busca el botón que dispara "en_produccion" y reemplaza así:

// Antes de los botones de cambio de estado, añadir el selector MRP solo cuando next incluye en_produccion:
{selected.status === "pagado" && (
  <div className="flex gap-2 items-end mb-2">
    <div className="flex-1">
      <Label className="text-xs mb-1 block">Modelo (para MRP)</Label>
      <Select value={mrpForm.modelo} onValueChange={(v) => setMrpForm((f) => ({ ...f, modelo: v }))}>
        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
        <SelectContent>
          {["Vintage", "Rex", "Lineal Punta", "London", "Garra"].map((m) => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <div className="w-36">
      <Label className="text-xs mb-1 block">Talla</Label>
      <Select value={mrpForm.talla} onValueChange={(v) => setMrpForm((f) => ({ ...f, talla: v }))}>
        <SelectTrigger><SelectValue placeholder="Talla" /></SelectTrigger>
        <SelectContent>
          {["2 pies", "2.5 pies", "3 pies", "3.5 pies", "4 pies", "5 pies", "6 pies"].map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
)}

// Actualizar la mutation para usar cambiarEstadoPedido (la nueva función de pos.functions):
const mutation = useMutation({
  mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
    cambiarEstadoPedido({
      order_id: id,
      nuevo_estado: status,
      modelo: status === "en_produccion" ? mrpForm.modelo || undefined : undefined,
      talla:  status === "en_produccion" ? mrpForm.talla  || undefined : undefined,
    }),
  ...
});
```

---

## 7. Lista de verificación

### Base de datos
- [ ] Ejecutar `20260606_produccion_mrp_integration.sql` (reemplaza `cambiar_estado_pedido`, añade `actualizar_produccion` y `asignar_carpintero`, crea `v_mi_produccion`)
- [ ] Verificar que `bom_items` e `insumos` del módulo 4 existen antes de ejecutar la migración

### Correcciones en código existente
- [ ] `src/hooks/useAuth.ts` — añadir `"carpintero"` al tipo `AppRole`
- [ ] `src/routes/_authenticated/pedidos.tsx` — corregir bug del Dialog: `open={!!selectedId}`
- [ ] `src/routes/_authenticated/pedidos.tsx` — importar `cambiarEstadoPedido` de `pos.functions` y añadir selector modelo/talla para `en_produccion`

### Archivos nuevos
- [ ] Crear `src/routes/_authenticated/produccion.tsx`
- [ ] Crear `src/routes/_authenticated/mi-produccion.tsx`
- [ ] Actualizar `src/components/AppSidebar.tsx` con nuevos items y `Hammer`, `Wrench`, `Boxes`
- [ ] Añadir `cambiarEstadoPedido`, `listProduccion`, `listMiProduccion`, `getDetalleProduccion`, `actualizarProduccion`, `asignarCarpintero`, `listCarpinteros` en `src/lib/pos.functions.ts`

### Verificar que `date-fns` está instalado
```bash
grep "date-fns" package.json
# Si no está: bun add date-fns
```

### Verificación funcional
- [ ] Admin ve `/produccion` con tabla de órdenes activas
- [ ] Click en ojo abre detalle con ítems del pedido
- [ ] "Iniciar / Pausar / Terminado" actualizan el estado de producción correctamente
- [ ] Asignar carpintero desde el detalle funciona
- [ ] El carpintero ve solo `/mi-produccion` en el sidebar
- [ ] El carpintero puede iniciar/pausar/terminar sus propias órdenes
- [ ] Al cambiar un pedido a `en_produccion` con modelo+talla → los insumos se descuentan en `v_insumos_stock_bajo`
- [ ] Órdenes con fecha vencida aparecen con fondo rojo

---

## 8. Notas

**`date-fns` y `date-fns/locale`** son necesarios para el formateo de fechas en español (`fmtDay`). Si no está instalado, `bun add date-fns`.

**`v_produccion_panel` excluye `terminado`** — ese es el comportamiento correcto. Los pedidos terminados ya no aparecen en el panel de producción pero siguen en `pedidos.tsx` con su estado `control_calidad` o `listo_despacho`.

**La integración MRP es opcional por pedido.** Si no se selecciona modelo+talla al pasar a `en_produccion`, la función simplemente no descuenta insumos. El sistema no bloquea la transición si no hay BOM definido.

**El selector de modelo en `pedidos.tsx` es temporal.** Cuando en el futuro el producto en `order_items` tenga un campo `modelo` y `talla` estructurado, puedes leer ese valor automáticamente del primer ítem y pasar al RPC sin intervención manual.


































































































































































# Módulo 6 — Fabricantes y Proveedores
**G&M Mueblería** · Directorio + órdenes de compra + vinculación con insumos y productos

---

## Estado real del código

Todo este módulo está **ausente** — ni en DB ni en frontend. Se construye completo desde cero.

La única conexión existente es `insumos.proveedor` (campo de texto libre, sin FK), que este módulo convierte en una relación real.

|
 Pieza 
|
 Estado 
|
|
---
|
---
|
|
 Tabla 
`proveedores`
|
 ❌ No existe 
|
|
 Tabla 
`ordenes_compra`
|
 ❌ No existe 
|
|
 Tabla 
`orden_compra_items`
|
 ❌ No existe 
|
|
 FK 
`insumos.proveedor_id`
|
 ❌ No existe (solo campo texto libre) 
|
|
 FK 
`products.proveedor_id`
|
 ❌ No existe 
|
|
 Ruta 
`/proveedores`
|
 ❌ No existe 
|
|
 Funciones en 
`pos.functions.ts`
|
 ❌ No existen 
|

---

## Decisiones de diseño

**Proveedor vs Fabricante:** en una mueblería el mismo tercero puede ser proveedor de insumos (tela, espuma) y/o fabricante de productos terminados. Se usa una única tabla `proveedores` con un campo `tipo` que permite múltiples valores (`insumo`, `producto`, `ambos`). No se crean dos tablas separadas porque comparten todos los campos de contacto.

**Órdenes de compra:** capturan la intención de compra a un proveedor (qué se pide, cuánto, a qué precio). Al marcar una orden como `recibida`, el stock de insumos se actualiza automáticamente via la tabla `insumo_movimientos` del módulo 4. Para productos terminados (fabricante externo), actualiza `products.stock`.

**Vinculación insumos:** la columna `insumos.proveedor` (texto libre) se migra a `insumos.proveedor_id` (FK). Se incluye un script de migración no destructivo que mantiene los datos existentes.

---

## 1. Migraciones

Ejecutar en orden en Supabase SQL Editor.

### Paso 1 — Tabla `proveedores`

```sql
-- migrations/20260607_proveedores.sql

CREATE TYPE public.proveedor_tipo AS ENUM ('insumo', 'producto', 'ambos');

CREATE TABLE public.proveedores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  ruc           TEXT UNIQUE,
  tipo          public.proveedor_tipo NOT NULL DEFAULT 'insumo',

  -- Contacto
  contacto_nombre   TEXT,
  telefono          TEXT,
  email             TEXT,
  whatsapp          TEXT,

  -- Dirección
  direccion         TEXT,
  distrito          TEXT,
  ciudad            TEXT DEFAULT 'Lima',

  -- Condiciones comerciales
  plazo_entrega_dias  SMALLINT DEFAULT 7,   -- días hábiles de entrega
  credito_dias        SMALLINT DEFAULT 0,   -- días de crédito (0 = contado)
  moneda              TEXT NOT NULL DEFAULT 'PEN',
  notas               TEXT,

  activo            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.proveedores TO authenticated;

CREATE POLICY "Staff manage proveedores"
  ON public.proveedores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));

CREATE INDEX idx_proveedores_tipo   ON public.proveedores(tipo);
CREATE INDEX idx_proveedores_activo ON public.proveedores(activo);

CREATE TRIGGER proveedores_updated_at
  BEFORE UPDATE ON public.proveedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### Paso 2 — Vincular insumos y productos con proveedores

```sql
-- Añadir FK proveedor_id a insumos (reemplaza el campo texto libre)
ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE SET NULL;

-- Migrar datos del campo texto libre al nuevo FK
-- (solo aplica si ya tienes filas con proveedor cargado a mano)
-- UPDATE public.insumos SET proveedor_id = p.id
-- FROM public.proveedores p WHERE p.nombre = insumos.proveedor;

-- Mantener el campo texto como legacy por compatibilidad; puedes eliminarlo luego
-- ALTER TABLE public.insumos DROP COLUMN proveedor; -- opcional, hazlo cuando estés listo

-- Añadir FK proveedor_id a products (para productos de fabricante externo)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES public.proveedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_insumos_proveedor   ON public.insumos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_products_proveedor  ON public.products(proveedor_id);
```

### Paso 3 — Órdenes de compra

```sql
CREATE TYPE public.orden_compra_status AS ENUM (
  'borrador', 'enviada', 'confirmada', 'parcial', 'recibida', 'cancelada'
);

CREATE TABLE public.ordenes_compra (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL UNIQUE,         -- OC-0001, OC-0002...
  proveedor_id    UUID NOT NULL REFERENCES public.proveedores(id) ON DELETE RESTRICT,
  status          public.orden_compra_status NOT NULL DEFAULT 'borrador',

  -- Fechas
  fecha_emision   DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_esperada  DATE,
  fecha_recepcion DATE,

  -- Totales
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  igv             NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  moneda          TEXT NOT NULL DEFAULT 'PEN',

  -- Referencias
  notas           TEXT,
  creado_por      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recibido_por    UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.ordenes_compra TO authenticated;

CREATE POLICY "Staff manage ordenes_compra"
  ON public.ordenes_compra FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));

CREATE INDEX idx_oc_proveedor ON public.ordenes_compra(proveedor_id);
CREATE INDEX idx_oc_status    ON public.ordenes_compra(status);
CREATE INDEX idx_oc_fecha     ON public.ordenes_compra(fecha_emision DESC);

CREATE TRIGGER ordenes_compra_updated_at
  BEFORE UPDATE ON public.ordenes_compra
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Secuencia para numerar órdenes de compra
CREATE SEQUENCE IF NOT EXISTS public.seq_orden_compra START 1;
```

### Paso 4 — Ítems de la orden de compra

```sql
CREATE TABLE public.orden_compra_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id        UUID NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,

  -- Referencia al insumo o producto (uno de los dos, no ambos)
  insumo_id       UUID REFERENCES public.insumos(id) ON DELETE RESTRICT,
  product_id      UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  descripcion     TEXT NOT NULL,    -- nombre libre si no hay FK
  unidad          TEXT NOT NULL,

  cantidad        NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
  precio_unit     NUMERIC(12,4) NOT NULL DEFAULT 0,
  subtotal        NUMERIC(12,2) GENERATED ALWAYS AS (ROUND((cantidad * precio_unit)::NUMERIC, 2)) STORED,

  -- Recepción parcial
  cantidad_recibida NUMERIC(12,3) NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_oc_item_referencia CHECK (
    (insumo_id IS NOT NULL AND product_id IS NULL) OR
    (insumo_id IS NULL AND product_id IS NOT NULL) OR
    (insumo_id IS NULL AND product_id IS NULL)  -- ítem libre sin FK
  )
);

ALTER TABLE public.orden_compra_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orden_compra_items TO authenticated;

CREATE POLICY "Staff manage oc_items"
  ON public.orden_compra_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'vendedor'));

CREATE INDEX idx_oc_items_orden   ON public.orden_compra_items(orden_id);
CREATE INDEX idx_oc_items_insumo  ON public.orden_compra_items(insumo_id);
CREATE INDEX idx_oc_items_product ON public.orden_compra_items(product_id);
```

### Paso 5 — Función para confirmar recepción

Esta función es el núcleo de la integración con stock: al marcar una orden como `recibida`, descarga los insumos en `insumo_movimientos` y actualiza el stock de productos.

```sql
CREATE OR REPLACE FUNCTION public.recibir_orden_compra(
  _orden_id UUID,
  _notas    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _orden   public.ordenes_compra;
  _item    RECORD;
BEGIN
  IF NOT (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'vendedor')) THEN
    RAISE EXCEPTION 'Sin permisos para recibir órdenes de compra';
  END IF;

  SELECT * INTO _orden FROM public.ordenes_compra WHERE id = _orden_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden de compra no encontrada'; END IF;

  IF _orden.status IN ('recibida', 'cancelada') THEN
    RAISE EXCEPTION 'La orden ya fue % — no se puede recibir nuevamente', _orden.status;
  END IF;

  -- Registrar entrada en insumo_movimientos por cada ítem de insumo
  FOR _item IN
    SELECT * FROM public.orden_compra_items WHERE orden_id = _orden_id AND insumo_id IS NOT NULL
  LOOP
    INSERT INTO public.insumo_movimientos
      (insumo_id, tipo, cantidad, motivo, referencia, registrado_por)
    VALUES (
      _item.insumo_id,
      'entrada',
      _item.cantidad,
      'Recepción orden de compra',
      _orden.numero,
      _user_id
    );
    -- Marcar como totalmente recibido
    UPDATE public.orden_compra_items
    SET cantidad_recibida = cantidad
    WHERE id = _item.id;
  END LOOP;

  -- Actualizar stock de productos terminados
  FOR _item IN
    SELECT * FROM public.orden_compra_items WHERE orden_id = _orden_id AND product_id IS NOT NULL
  LOOP
    UPDATE public.products
    SET stock = stock + _item.cantidad::INTEGER, updated_at = now()
    WHERE id = _item.product_id;

    UPDATE public.orden_compra_items
    SET cantidad_recibida = cantidad
    WHERE id = _item.id;
  END LOOP;

  -- Actualizar la orden
  UPDATE public.ordenes_compra
  SET
    status          = 'recibida',
    fecha_recepcion = CURRENT_DATE,
    recibido_por    = _user_id,
    notas           = COALESCE(_notas, notas),
    updated_at      = now()
  WHERE id = _orden_id;

  RETURN jsonb_build_object(
    'ok', true,
    'orden_id', _orden_id,
    'numero', _orden.numero
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recibir_orden_compra TO authenticated;

-- Función para calcular totales de la orden automáticamente
CREATE OR REPLACE FUNCTION public.recalcular_totales_oc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _subtotal NUMERIC(12,2);
BEGIN
  SELECT COALESCE(SUM(subtotal), 0)
  INTO _subtotal
  FROM public.orden_compra_items
  WHERE orden_id = COALESCE(NEW.orden_id, OLD.orden_id);

  UPDATE public.ordenes_compra
  SET
    subtotal   = _subtotal,
    igv        = ROUND(_subtotal * 0.18, 2),
    total      = _subtotal + ROUND(_subtotal * 0.18, 2),
    updated_at = now()
  WHERE id = COALESCE(NEW.orden_id, OLD.orden_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recalcular_totales_oc
  AFTER INSERT OR UPDATE OR DELETE ON public.orden_compra_items
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_totales_oc();

-- Función helper para generar número de OC
CREATE OR REPLACE FUNCTION public.next_orden_compra_numero()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n BIGINT;
BEGIN
  SELECT nextval('public.seq_orden_compra') INTO _n;
  RETURN 'OC-' || LPAD(_n::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_orden_compra_numero() TO authenticated;
```

### Paso 6 — Vista de estado de stock por proveedor

```sql
CREATE OR REPLACE VIEW public.v_proveedores_resumen AS
SELECT
  p.id,
  p.nombre,
  p.tipo,
  p.contacto_nombre,
  p.telefono,
  p.email,
  p.plazo_entrega_dias,
  p.activo,

  COUNT(DISTINCT i.id)  AS total_insumos,
  COUNT(DISTINCT pr.id) AS total_productos,

  COUNT(DISTINCT oc.id) FILTER (WHERE oc.status = 'enviada')    AS oc_pendientes,
  COUNT(DISTINCT oc.id) FILTER (WHERE oc.status = 'recibida')   AS oc_recibidas,
  COALESCE(SUM(oc.total) FILTER (WHERE oc.status = 'recibida'), 0) AS total_comprado,
  MAX(oc.fecha_emision)  AS ultima_compra

FROM public.proveedores p
LEFT JOIN public.insumos i     ON i.proveedor_id = p.id AND i.activo = true
LEFT JOIN public.products pr   ON pr.proveedor_id = p.id AND pr.activo = true
LEFT JOIN public.ordenes_compra oc ON oc.proveedor_id = p.id
GROUP BY p.id;

GRANT SELECT ON public.v_proveedores_resumen TO authenticated;
```

---

## 2. Funciones en `pos.functions.ts`

```ts
// ── PROVEEDORES ──────────────────────────────────────────────

export async function listProveedores(input?: { activo?: boolean }) {
  const { supabase } = await getAuthenticatedClient();
  let q = supabase
    .from("v_proveedores_resumen")
    .select("*")
    .order("nombre");
  if (input?.activo !== undefined) q = q.eq("activo", input.activo);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { proveedores: data ?? [] };
}

export async function upsertProveedor(input: {
  id?: string;
  nombre: string;
  ruc?: string | null;
  tipo: "insumo" | "producto" | "ambos";
  contacto_nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  direccion?: string | null;
  distrito?: string | null;
  plazo_entrega_dias?: number;
  credito_dias?: number;
  notas?: string | null;
}) {
  const data = z.object({
    id:                  z.string().uuid().optional(),
    nombre:              z.string().min(1).max(200),
    ruc:                 z.string().length(11).optional().nullable(),
    tipo:                z.enum(["insumo", "producto", "ambos"]),
    contacto_nombre:     z.string().max(150).optional().nullable(),
    telefono:            z.string().max(30).optional().nullable(),
    email:               z.string().email().optional().nullable().or(z.literal("")),
    whatsapp:            z.string().max(30).optional().nullable(),
    direccion:           z.string().max(500).optional().nullable(),
    distrito:            z.string().max(100).optional().nullable(),
    plazo_entrega_dias:  z.number().int().min(0).max(365).optional(),
    credito_dias:        z.number().int().min(0).max(365).optional(),
    notas:               z.string().max(2000).optional().nullable(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { data: row, error } = await supabase
    .from("proveedores")
    .upsert({ ...data, email: data.email || null, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { proveedor: row };
}

export async function getProveedor(input: { id: string }) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("proveedores")
    .select("*, insumos(id, nombre, unidad, stock_actual), products(id, nombre, sku, precio)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return { proveedor: data };
}

// ── ÓRDENES DE COMPRA ────────────────────────────────────────

export async function listOrdenes(input?: { proveedor_id?: string; status?: string }) {
  const { supabase } = await getAuthenticatedClient();
  let q = supabase
    .from("ordenes_compra")
    .select("*, proveedores(id, nombre, telefono), orden_compra_items(id, descripcion, cantidad, precio_unit, subtotal, cantidad_recibida, insumo_id, product_id)")
    .order("fecha_emision", { ascending: false })
    .limit(200);
  if (input?.proveedor_id) q = q.eq("proveedor_id", input.proveedor_id);
  if (input?.status)       q = q.eq("status", input.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { ordenes: data ?? [] };
}

export async function crearOrdenCompra(input: {
  proveedor_id: string;
  fecha_esperada?: string | null;
  notas?: string | null;
  items: Array;
}) {
  const data = z.object({
    proveedor_id:   z.string().uuid(),
    fecha_esperada: z.string().optional().nullable(),
    notas:          z.string().max(1000).optional().nullable(),
    items: z.array(z.object({
      insumo_id:   z.string().uuid().optional().nullable(),
      product_id:  z.string().uuid().optional().nullable(),
      descripcion: z.string().min(1).max(300),
      unidad:      z.string().min(1).max(30),
      cantidad:    z.number().positive(),
      precio_unit: z.number().min(0),
    })).min(1).max(50),
  }).parse(input);

  const { supabase, userId } = await getAuthenticatedClient();

  // Generar número de OC
  const { data: numRow, error: numErr } = await supabase.rpc("next_orden_compra_numero");
  if (numErr) throw new Error(numErr.message);

  const { data: orden, error: ordenErr } = await supabase
    .from("ordenes_compra")
    .insert({
      numero:         numRow,
      proveedor_id:   data.proveedor_id,
      fecha_esperada: data.fecha_esperada ?? null,
      notas:          data.notas ?? null,
      creado_por:     userId,
    })
    .select()
    .single();
  if (ordenErr) throw new Error(ordenErr.message);

  const { error: itemsErr } = await supabase
    .from("orden_compra_items")
    .insert(data.items.map((item) => ({ ...item, orden_id: orden.id })));
  if (itemsErr) throw new Error(itemsErr.message);

  return { orden };
}

export async function actualizarStatusOrden(input: {
  id: string;
  status: "enviada" | "confirmada" | "cancelada";
}) {
  const { id, status } = z.object({
    id:     z.string().uuid(),
    status: z.enum(["enviada", "confirmada", "cancelada"]),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase
    .from("ordenes_compra")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function recibirOrdenCompra(input: { id: string; notas?: string }) {
  const { id, notas } = z.object({
    id:    z.string().uuid(),
    notas: z.string().optional(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase.rpc("recibir_orden_compra", {
    _orden_id: id,
    _notas:    notas ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}
```

---

## 3. Ruta `/proveedores` — Panel completo

Crea `src/routes/_authenticated/proveedores.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listProveedores, upsertProveedor, getProveedor,
  listOrdenes, crearOrdenCompra, actualizarStatusOrden, recibirOrdenCompra,
} from "@/lib/pos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Loader2, Plus, Eye, Truck, ShoppingCart,
  Phone, Mail, MessageCircle, Package, Building2,
  CheckCircle2, XCircle, Send, RefreshCw, Trash2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/proveedores")({
  head: () => ({ meta: [{ title: "Proveedores — G&M" }] }),
  component: ProveedoresPage,
});

// ── Config visual ────────────────────────────────────────────
const TIPO_CONFIG = {
  insumo:   { label: "Insumos",            color: "#1e40af", bg: "#dbeafe" },
  producto: { label: "Productos",          color: "#065f46", bg: "#d1fae5" },
  ambos:    { label: "Insumos + Productos", color: "#6d28d9", bg: "#ede9fe" },
} as const;

const OC_STATUS_CONFIG = {
  borrador:   { label: "Borrador",    color: "#6b7280", bg: "#f3f4f6", icon: Package },
  enviada:    { label: "Enviada",     color: "#92400e", bg: "#fef3c7", icon: Send },
  confirmada: { label: "Confirmada",  color: "#1e40af", bg: "#dbeafe", icon: CheckCircle2 },
  parcial:    { label: "Recepción parcial", color: "#5b21b6", bg: "#ede9fe", icon: Truck },
  recibida:   { label: "Recibida",    color: "#14532d", bg: "#dcfce7", icon: CheckCircle2 },
  cancelada:  { label: "Cancelada",   color: "#7f1d1d", bg: "#fee2e2", icon: XCircle },
} as const;

type OcStatus = keyof typeof OC_STATUS_CONFIG;
type ProvTipo = keyof typeof TIPO_CONFIG;

const fmt     = (n: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
const fmtDay  = (d: string | null) => d ? format(new Date(d), "dd MMM yyyy", { locale: es }) : "—";
const UNIDADES = ["metros", "kg", "litros", "unidades", "planchas", "piezas", "paquetes", "palos", "pies", "bolsas"];

// ── Form proveedor ───────────────────────────────────────────
const EMPTY_PROV = () => ({
  nombre: "", ruc: "", tipo: "insumo" as ProvTipo,
  contacto_nombre: "", telefono: "", email: "", whatsapp: "",
  direccion: "", distrito: "",
  plazo_entrega_dias: 7, credito_dias: 0, notas: "",
});

function ProveedorForm({ initial, onClose }: { initial?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(initial ? {
    ...EMPTY_PROV(), ...initial,
    plazo_entrega_dias: initial.plazo_entrega_dias ?? 7,
    credito_dias: initial.credito_dias ?? 0,
  } : EMPTY_PROV());

  const set = (k: string) => (e: React.ChangeEvent) =>
    setForm((f: any) => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => upsertProveedor({ ...form, id: initial?.id }),
    onSuccess: () => {
      toast.success(initial ? "Proveedor actualizado" : "Proveedor creado");
      qc.invalidateQueries({ queryKey: ["proveedores"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    
      
        
          
            {initial ? "Editar proveedor" : "Nuevo proveedor"}
          
        
        
          
            
              Nombre *
              <Input className="mt-1" value={form.nombre} onChange={set("nombre")} placeholder="Ej: Textiles Peruanos SAC" />
            
            
              RUC
              <Input className="mt-1" value={form.ruc} onChange={set("ruc")} placeholder="20XXXXXXXXX" maxLength={11} />
            
            
              Tipo *
              <Select value={form.tipo} onValueChange={(v) => setForm((f: any) => ({ ...f, tipo: v }))}>
                
                
                  Proveedor de insumos
                  Fabricante de productos
                  Ambos
                
              
            
          

          
            Contacto
            
              {[
                { k: "contacto_nombre", label: "Nombre contacto", placeholder: "Juan Pérez" },
                { k: "telefono",        label: "Teléfono",        placeholder: "+51 999 999 999" },
                { k: "email",           label: "Email",           placeholder: "ventas@proveedor.com" },
                { k: "whatsapp",        label: "WhatsApp",        placeholder: "+51 999 999 999" },
              ].map(({ k, label, placeholder }) => (
                
                  {label}
                  
                
              ))}
              
                Dirección
                <Input className="mt-1" value={form.direccion} onChange={set("direccion")} placeholder="Av. Principal 123" />
              
              
                Distrito
                <Input className="mt-1" value={form.distrito} onChange={set("distrito")} placeholder="San Juan de Lurigancho" />
              
            
          

          
            Condiciones
            
              
                Plazo entrega (días)
                <Input className="mt-1" type="number" min={0} value={form.plazo_entrega_dias}
                  onChange={(e) => setForm((f: any) => ({ ...f, plazo_entrega_dias: Number(e.target.value) }))} />
              
              
                Crédito (días, 0 = contado)
                <Input className="mt-1" type="number" min={0} value={form.credito_dias}
                  onChange={(e) => setForm((f: any) => ({ ...f, credito_dias: Number(e.target.value) }))} />
              
            
          

          
            Notas internas
            <Textarea className="mt-1 text-sm" rows={2} value={form.notas} onChange={set("notas")}
              placeholder="Condiciones especiales, historial de relación, etc." />
          

          <Button className="w-full" disabled={!form.nombre || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && }
            {initial ? "Guardar cambios" : "Crear proveedor"}
          
        
      
    
  );
}

// ── Detalle del proveedor con OC ─────────────────────────────
function ProveedorDetalle({ proveedorId, onClose }: { proveedorId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("info");
  const [editOpen, setEditOpen] = useState(false);
  const [ocOpen, setOcOpen] = useState(false);

  const { data: provData, isLoading } = useQuery({
    queryKey: ["proveedor", proveedorId],
    queryFn: () => getProveedor({ id: proveedorId }),
  });

  const { data: ocData } = useQuery({
    queryKey: ["ordenes", proveedorId],
    queryFn: () => listOrdenes({ proveedor_id: proveedorId }),
  });

  const recibirMut = useMutation({
    mutationFn: (id: string) => recibirOrdenCompra({ id }),
    onSuccess: () => {
      toast.success("Stock actualizado — insumos ingresados");
      qc.invalidateQueries({ queryKey: ["ordenes", proveedorId] });
      qc.invalidateQueries({ queryKey: ["insumos"] });
      qc.invalidateQueries({ queryKey: ["insumos-alertas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: any }) => actualizarStatusOrden({ id, status }),
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["ordenes", proveedorId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const p = provData?.proveedor;
  const ordenes = ocData?.ordenes ?? [];
  const tipo = TIPO_CONFIG[p?.tipo as ProvTipo] ?? TIPO_CONFIG.insumo;

  return (
    <>
      
        
          
            
              
              {isLoading ? "Cargando..." : p?.nombre}
            
          

          {isLoading || !p ? (
            
          ) : (
            
              {/* Header info */}
              
                
                  {tipo.label}
                  {p.ruc && RUC: {p.ruc}}
                
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Editar
              

              
                
                  Información
                  
                    Órdenes de compra
                    {ordenes.filter((o: any) => o.status === "enviada").length > 0 && (
                      
                        {ordenes.filter((o: any) => o.status === "enviada").length}
                      
                    )}
                  
                  Materiales
                

                {/* Tab: Información */}
                
                  
                    {[
                      ["Contacto",      p.contacto_nombre],
                      ["Teléfono",      p.telefono],
                      ["Email",         p.email],
                      ["WhatsApp",      p.whatsapp],
                      ["Dirección",     p.direccion],
                      ["Distrito",      p.distrito],
                      ["Plazo entrega", p.plazo_entrega_dias ? `${p.plazo_entrega_dias} días` : null],
                      ["Crédito",       p.credito_dias ? `${p.credito_dias} días` : "Contado"],
                    ].map(([label, value]) => value ? (
                      
                        {label}
                        {value}
                      
                    ) : null)}
                  

                  {/* Acciones de contacto rápido */}
                  
                    {p.telefono && (
                      
                        
                           Llamar
                        
                      
                    )}
                    {p.whatsapp && (
                      
                        
                           WhatsApp
                        
                      
                    )}
                    {p.email && (
                      
                        
                           Email
                        
                      
                    )}
                  

                  {p.notas && (
                    
                      Notas
                      {p.notas}
                    
                  )}
                

                {/* Tab: Órdenes de compra */}
                
                  
                    <Button size="sm" onClick={() => setOcOpen(true)}>
                       Nueva orden de compra
                    
                  

                  {ordenes.length === 0 ? (
                    Sin órdenes de compra
                  ) : (
                    
                      {ordenes.map((oc: any) => {
                        const st = OC_STATUS_CONFIG[oc.status as OcStatus];
                        const Icon = st?.icon ?? Package;
                        return (
                          
                            
                              
                                {oc.numero}
                                
                                  {fmtDay(oc.fecha_emision)}
                                  {oc.fecha_esperada && ` · Esperada: ${fmtDay(oc.fecha_esperada)}`}
                                
                              
                              
                                {st?.label}
                              
                            

                            {/* Ítems */}
                            
                              {(oc.orden_compra_items ?? []).map((item: any) => (
                                
                                  {item.descripcion} × {item.cantidad}
                                  {fmt(Number(item.subtotal))}
                                
                              ))}
                            

                            
                              {fmt(Number(oc.total))}
                              
                                {oc.status === "borrador" && (
                                  <Button size="sm" variant="outline"
                                    onClick={() => statusMut.mutate({ id: oc.id, status: "enviada" })}
                                    disabled={statusMut.isPending}>
                                     Enviar al proveedor
                                  
                                )}
                                {(oc.status === "enviada" || oc.status === "confirmada") && (
                                  <Button size="sm"
                                    onClick={() => recibirMut.mutate(oc.id)}
                                    disabled={recibirMut.isPending}>
                                    {recibirMut.isPending
                                      ? 
                                      : }
                                    Confirmar recepción
                                  
                                )}
                                {oc.status === "borrador" && (
                                  <Button size="sm" variant="ghost"
                                    onClick={() => statusMut.mutate({ id: oc.id, status: "cancelada" })}>
                                    
                                  
                                )}
                              
                            
                          
                        );
                      })}
                    
                  )}
                

                {/* Tab: Materiales vinculados */}
                
                  {(p.insumos ?? []).length > 0 && (
                    
                      Insumos
                      
                        {p.insumos.map((i: any) => (
                          
                            {i.nombre}
                            {i.stock_actual} {i.unidad}
                          
                        ))}
                      
                    
                  )}
                  {(p.products ?? []).length > 0 && (
                    
                      Productos
                      
                        {p.products.map((pr: any) => (
                          
                            {pr.nombre}
                            {fmt(Number(pr.precio))}
                          
                        ))}
                      
                    
                  )}
                  {(p.insumos ?? []).length === 0 && (p.products ?? []).length === 0 && (
                    
                      Sin materiales vinculados. Vincula insumos o productos desde sus respectivos paneles.
                    
                  )}
                
              
            
          )}
        
      

      {editOpen && p && (
        <ProveedorForm initial={p} onClose={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ["proveedor", proveedorId] }); }} />
      )}
      {ocOpen && (
        <NuevaOrdenDialog proveedorId={proveedorId} onClose={() => { setOcOpen(false); qc.invalidateQueries({ queryKey: ["ordenes", proveedorId] }); }} />
      )}
    </>
  );
}

// ── Dialog nueva orden de compra ─────────────────────────────
function NuevaOrdenDialog({ proveedorId, onClose }: { proveedorId: string; onClose: () => void }) {
  const [fechaEsperada, setFechaEsperada] = useState("");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState([
    { descripcion: "", unidad: "unidades", cantidad: 1, precio_unit: 0 },
  ]);

  const addItem = () => setItems((it) => [...it, { descripcion: "", unidad: "unidades", cantidad: 1, precio_unit: 0 }]);
  const removeItem = (i: number) => setItems((it) => it.filter((_, idx) => idx !== i));
  const updateItem = (i: number, k: string, v: string | number) =>
    setItems((it) => it.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  const total = items.reduce((s, it) => s + it.cantidad * it.precio_unit, 0);

  const mut = useMutation({
    mutationFn: () => crearOrdenCompra({ proveedor_id: proveedorId, fecha_esperada: fechaEsperada || null, notas: notas || null, items }),
    onSuccess: () => { toast.success("Orden de compra creada"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    
      
        Nueva orden de compra
        
          
            
              Fecha esperada de entrega
              <Input className="mt-1" type="date" value={fechaEsperada} onChange={(e) => setFechaEsperada(e.target.value)} />
            
            
              Notas para el proveedor
              <Input className="mt-1" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Instrucciones, referencias..." />
            
          

          
            
              Ítems *
               Añadir
            
            {items.map((item, i) => (
              
                
                  {i === 0 && Descripción}
                  <Input placeholder="Tela metro lineal..." value={item.descripcion}
                    onChange={(e) => updateItem(i, "descripcion", e.target.value)} />
                
                
                  {i === 0 && Unidad}
                  <Select value={item.unidad} onValueChange={(v) => updateItem(i, "unidad", v)}>
                    
                    
                      {UNIDADES.map((u) => {u})}
                    
                  
                
                
                  {i === 0 && Cantidad}
                  <Input type="number" min={0} value={item.cantidad}
                    onChange={(e) => updateItem(i, "cantidad", Number(e.target.value))} />
                
                
                  {i === 0 && P. Unit (S/)}
                  <Input type="number" min={0} step="0.01" value={item.precio_unit}
                    onChange={(e) => updateItem(i, "precio_unit", Number(e.target.value))} />
                
                
                  {i === 0 && Sub.}
                  
                    {fmt(item.cantidad * item.precio_unit)}
                  
                
                
                  {items.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => removeItem(i)}>
                      
                    
                  )}
                
              
            ))}

            
              Total estimado: {fmt(total)} + IGV ({fmt(total * 0.18)}) = {fmt(total * 1.18)}
            
          

          <Button className="w-full"
            disabled={items.some((it) => !it.descripcion) || mut.isPending}
            onClick={() => mut.mutate()}>
            {mut.isPending && }
            Crear orden de compra (borrador)
          
        
      
    
  );
}

// ── Página principal ─────────────────────────────────────────
function ProveedoresPage() {
  const [busqueda, setBusqueda] = useState("");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["proveedores"],
    queryFn: () => listProveedores({ activo: true }),
  });

  const proveedores = data?.proveedores ?? [];

  const filtrados = useMemo(() => {
    return proveedores.filter((p: any) => {
      const matchTipo = tipoFilter === "todos" || p.tipo === tipoFilter;
      const q = busqueda.toLowerCase();
      const matchQ = !q || p.nombre.toLowerCase().includes(q) ||
        (p.ruc ?? "").includes(q) || (p.contacto_nombre ?? "").toLowerCase().includes(q);
      return matchTipo && matchQ;
    });
  }, [proveedores, busqueda, tipoFilter]);

  const stats = useMemo(() => ({
    total:    proveedores.length,
    insumo:   proveedores.filter((p: any) => p.tipo === "insumo" || p.tipo === "ambos").length,
    producto: proveedores.filter((p: any) => p.tipo === "producto" || p.tipo === "ambos").length,
    oc_pend:  proveedores.reduce((s: number, p: any) => s + (p.oc_pendientes ?? 0), 0),
  }), [proveedores]);

  return (
    
      
        
          Proveedores y Fabricantes
          Directorio y órdenes de compra
        
        
          <Button variant="outline" size="sm" onClick={() => refetch()}>
             Actualizar
          
          <Button size="sm" onClick={() => setFormOpen(true)}>
             Nuevo proveedor
          
        
      

      {/* KPIs */}
      
        {[
          { label: "Total",          value: stats.total },
          { label: "Proveen insumos", value: stats.insumo },
          { label: "Fabricantes",    value: stats.producto },
          { label: "OC pendientes",  value: stats.oc_pend },
        ].map(({ label, value }) => (
          <div key={label} className={`border rounded-xl p-4 ${label === "OC pendientes" && value > 0 ? "bg-amber-50 border-amber-200" : "bg-card border-border/50"}`}>
            {label}
            {value}
          
        ))}
      

      {/* Filtros */}
      
        
          <Input placeholder="Buscar por nombre, RUC o contacto…"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        
        
          
          
            Todos los tipos
            Proveedores de insumos
            Fabricantes
            Ambos
          
        
      

      {/* Tabla */}
      {isLoading ? (
        
      ) : filtrados.length === 0 ? (
        
          
          No hay proveedores registrados
          <Button size="sm" onClick={() => setFormOpen(true)}> Añadir el primero
        
      ) : (
        
          
            
              
                
                  {["Proveedor", "Tipo", "Contacto", "Plazo", "Insumos", "OC pendientes", "Total comprado", ""].map((h) => (
                    {h}
                  ))}
                
              
              
                {filtrados.map((p: any) => {
                  const tipo = TIPO_CONFIG[p.tipo as ProvTipo];
                  return (
                    
                      
                        {p.nombre}
                        {p.ruc && RUC {p.ruc}}
                      
                      
                        {tipo?.label}
                      
                      
                        {p.contacto_nombre && {p.contacto_nombre}}
                        {p.telefono && {p.telefono}}
                      
                      
                        {p.plazo_entrega_dias ? `${p.plazo_entrega_dias}d` : "—"}
                      
                      {p.total_insumos ?? 0}
                      
                        {(p.oc_pendientes ?? 0) > 0
                          ? {p.oc_pendientes}
                          : —}
                      
                      
                        {Number(p.total_comprado) > 0 ? fmt(Number(p.total_comprado)) : "—"}
                      
                      
                        <Button variant="ghost" size="sm" onClick={() => setSelectedId(p.id)}>
                          
                        
                      
                    
                  );
                })}
              
            
          
        
      )}

      {formOpen && <ProveedorForm onClose={() => setFormOpen(false)} />}
      {selectedId && <ProveedorDetalle proveedorId={selectedId} onClose={() => setSelectedId(null)} />}
    
  );
}
```

---

## 4. Vincular proveedor desde el panel de insumos

En `src/routes/_authenticated/insumos.tsx`, amplía el `InsumoDialog` para incluir el selector de proveedor:

```tsx
// Añadir query de proveedores dentro del componente InsumoDialog
const { data: provData } = useQuery({
  queryKey: ["proveedores"],
  queryFn: () => listProveedores({ activo: true }),
});

// Añadir campo proveedor_id al form inicial:
const [form, setForm] = useState({
  ...
  proveedor_id: insumo?.proveedor_id ?? "",
});

// Añadir en el JSX del Dialog, antes del botón Guardar:

  Proveedor
  <Select
    value={form.proveedor_id ?? ""}
    onValueChange={(v) => setForm((f) => ({ ...f, proveedor_id: v || null }))}
  >
    
      
    
    
      Sin proveedor
      {(provData?.proveedores ?? []).map((p: any) => (
        {p.nombre}
      ))}
    
  


// Incluir proveedor_id en la llamada upsertInsumo:
mutationFn: () => upsertInsumo({ ...form, proveedor_id: form.proveedor_id || null }),
```

---

## 5. Actualizar `AppSidebar.tsx`

```tsx
import { ..., Truck } from "lucide-react";

// Añadir en items, después de "Insumos MRP":
{ title: "Proveedores", url: "/proveedores", icon: Truck, roles: ["admin", "vendedor"] as AppRole[] },
```

---

## 6. Lista de verificación

### Base de datos (en orden)
- [ ] Paso 1 — Crear tabla `proveedores` con RLS
- [ ] Paso 2 — Añadir `proveedor_id` a `insumos` y `products`
- [ ] Paso 3 — Crear tabla `ordenes_compra` con secuencia `seq_orden_compra`
- [ ] Paso 4 — Crear tabla `orden_compra_items` con columna generada `subtotal`
- [ ] Paso 5 — Crear funciones `recibir_orden_compra`, `recalcular_totales_oc`, `next_orden_compra_numero`
- [ ] Paso 6 — Crear vista `v_proveedores_resumen`

### Código
- [ ] Añadir 7 funciones en `pos.functions.ts`: `listProveedores`, `upsertProveedor`, `getProveedor`, `listOrdenes`, `crearOrdenCompra`, `actualizarStatusOrden`, `recibirOrdenCompra`
- [ ] Crear `src/routes/_authenticated/proveedores.tsx`
- [ ] Ampliar `InsumoDialog` en `insumos.tsx` con selector de proveedor
- [ ] Añadir "Proveedores" en `AppSidebar.tsx` con ícono `Truck`

### Verificación funcional
- [ ] `/proveedores` carga la tabla de proveedores
- [ ] Crear proveedor de tipo "insumo" funciona
- [ ] Click en ojo abre el detalle con tabs (Info / Órdenes / Materiales)
- [ ] Crear una orden de compra en borrador → aparece en la tab "Órdenes"
- [ ] "Enviar al proveedor" cambia status a `enviada`
- [ ] "Confirmar recepción" llama a `recibir_orden_compra` → `stock_actual` de los insumos aumenta
- [ ] La alerta de stock bajo en `/insumos` desaparece si el stock recibido supera el mínimo
- [ ] KPI "OC pendientes" en la tabla de proveedores muestra las enviadas sin recibir
- [ ] Selector de proveedor en el form de insumo guarda `proveedor_id`

---

## 7. Notas importantes

**La columna `subtotal` en `orden_compra_items` es GENERATED ALWAYS AS** — no se puede insertar ni actualizar directamente. El ORM de Supabase la omite si no la incluyes en el `select`, pero si la pides, viene calculada. No la incluyas en los payloads de insert/update.

**`recalcular_totales_oc` usa un trigger AFTER INSERT OR UPDATE OR DELETE** — los totales de la OC se recalculan automáticamente cada vez que se modifica un ítem. No necesitas calcularlos en el frontend.

**Las OC se crean siempre como `borrador`** — el flujo correcto es: borrador → enviada → (confirmada) → recibida. El paso "confirmada" es opcional (cuando el proveedor te confirma que aceptó el pedido). El botón "Confirmar recepción" salta de `enviada` o `confirmada` directamente a `recibida`.

**Para vincular insumos existentes al proveedor correcto** sin perder los datos del campo texto `proveedor`, puedes ejecutar este UPDATE manual una vez después de cargar los proveedores:
```sql
UPDATE public.insumos SET proveedor_id = p.id
FROM public.proveedores p
WHERE p.nombre ILIKE '%' || insumos.proveedor || '%'
  AND insumos.proveedor IS NOT NULL;
























































































































































































































  # Módulo 7 — Métricas y Dashboard KPI
**G&M Mueblería** · Reemplazo completo del dashboard existente

---

## Diagnóstico del dashboard actual

El `dashboard.tsx` existente tiene estos problemas que justifican reescribirlo:

| Problema | Impacto |
|---|---|
| Descarga todas las ventas a JavaScript y agrega en el cliente | Con 1000+ ventas, la página se vuelve lenta y consume ancho de banda innecesario |
| Solo lee `sales` (POS) — ignora `orders` (ecommerce) | Los ingresos del canal web no aparecen en ningún KPI |
| Sin selector de período | No se puede comparar mes actual vs anterior |
| Sin métricas de producción | No se sabe cuántas órdenes están atrasadas |
| Sin alertas de stock | El módulo MRP no tiene visibilidad en el dashboard |
| Sin métricas de órdenes de compra | Las OC pendientes no son visibles globalmente |
| `getDashboard()` hace 4 queries secuenciales en JS | Tiempo de carga alto |

La solución: mover toda la agregación a **una función RPC de SQL** que devuelve un objeto JSON con todos los KPIs calculados en la DB. El frontend solo renderiza.

---

## 1. Migración — Función RPC `get_dashboard_kpis`

```sql
-- migrations/20260608_dashboard_kpis.sql

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  _desde  DATE DEFAULT (date_trunc('month', CURRENT_DATE))::DATE,
  _hasta  DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _is_admin BOOLEAN;
  _result  JSONB;

  -- Ventas POS
  _ventas_pos_periodo     NUMERIC(12,2);
  _ventas_pos_mes_ant     NUMERIC(12,2);
  _ventas_pos_count       BIGINT;
  _ticket_promedio_pos    NUMERIC(12,2);

  -- Ecommerce
  _ventas_ec_periodo      NUMERIC(12,2);
  _ventas_ec_mes_ant      NUMERIC(12,2);
  _pedidos_ec_count       BIGINT;

  -- Totales combinados
  _ingresos_totales       NUMERIC(12,2);
  _ingresos_mes_ant       NUMERIC(12,2);

  -- Clientes
  _clientes_nuevos        BIGINT;
  _clientes_total         BIGINT;

  -- Producción
  _prod_pendientes        BIGINT;
  _prod_en_proceso        BIGINT;
  _prod_vencidas          BIGINT;
  _prod_terminadas_periodo BIGINT;
  _tiempo_prod_promedio   NUMERIC(5,1);

  -- Stock / MRP
  _insumos_stock_bajo     BIGINT;

  -- Órdenes de compra
  _oc_pendientes          BIGINT;
  _oc_monto_pendiente     NUMERIC(12,2);

  -- Periodo anterior (para comparativas)
  _dias_periodo   INT;
  _desde_ant      DATE;
  _hasta_ant      DATE;
BEGIN
  IF NOT (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'vendedor')) THEN
    RAISE EXCEPTION 'Sin permisos para ver métricas';
  END IF;

  _is_admin := public.has_role(_user_id, 'admin');
  _dias_periodo := _hasta - _desde + 1;
  _hasta_ant    := _desde - 1;
  _desde_ant    := _desde - _dias_periodo;

  -- ── Ventas POS ─────────────────────────────────────────────
  SELECT
    COALESCE(SUM(total) FILTER (WHERE created_at::DATE BETWEEN _desde AND _hasta AND estado = 'completada'), 0),
    COALESCE(SUM(total) FILTER (WHERE created_at::DATE BETWEEN _desde_ant AND _hasta_ant AND estado = 'completada'), 0),
    COUNT(*) FILTER (WHERE created_at::DATE BETWEEN _desde AND _hasta AND estado = 'completada')
  INTO _ventas_pos_periodo, _ventas_pos_mes_ant, _ventas_pos_count
  FROM public.sales
  WHERE (_is_admin OR vendedor_id = _user_id);

  _ticket_promedio_pos := CASE WHEN _ventas_pos_count > 0
    THEN ROUND(_ventas_pos_periodo / _ventas_pos_count, 2)
    ELSE 0 END;

  -- ── Ecommerce (solo pedidos pagados/completados) ────────────
  SELECT
    COALESCE(SUM(total) FILTER (WHERE created_at::DATE BETWEEN _desde AND _hasta), 0),
    COALESCE(SUM(total) FILTER (WHERE created_at::DATE BETWEEN _desde_ant AND _hasta_ant), 0),
    COUNT(*) FILTER (WHERE created_at::DATE BETWEEN _desde AND _hasta)
  INTO _ventas_ec_periodo, _ventas_ec_mes_ant, _pedidos_ec_count
  FROM public.orders
  WHERE status NOT IN ('pendiente', 'cancelado');

  -- ── Totales combinados ──────────────────────────────────────
  _ingresos_totales := _ventas_pos_periodo + _ventas_ec_periodo;
  _ingresos_mes_ant := _ventas_pos_mes_ant + _ventas_ec_mes_ant;

  -- ── Clientes ───────────────────────────────────────────────
  SELECT
    COUNT(*) FILTER (WHERE created_at::DATE BETWEEN _desde AND _hasta),
    COUNT(*)
  INTO _clientes_nuevos, _clientes_total
  FROM public.customers;

  -- ── Producción ─────────────────────────────────────────────
  SELECT
    COUNT(*) FILTER (WHERE p.status = 'pendiente'),
    COUNT(*) FILTER (WHERE p.status = 'en_proceso'),
    COUNT(*) FILTER (WHERE p.status NOT IN ('terminado') AND p.fecha_fin_estimada < CURRENT_DATE),
    COUNT(*) FILTER (WHERE p.status = 'terminado' AND p.updated_at::DATE BETWEEN _desde AND _hasta)
  INTO _prod_pendientes, _prod_en_proceso, _prod_vencidas, _prod_terminadas_periodo
  FROM public.produccion p;

  SELECT COALESCE(AVG(fecha_fin_real - fecha_inicio), 0)
  INTO _tiempo_prod_promedio
  FROM public.produccion
  WHERE status = 'terminado'
    AND fecha_fin_real IS NOT NULL
    AND fecha_inicio IS NOT NULL
    AND updated_at::DATE BETWEEN _desde AND _hasta;

  -- ── Stock MRP ──────────────────────────────────────────────
  SELECT COUNT(*)
  INTO _insumos_stock_bajo
  FROM public.insumos
  WHERE activo = true AND stock_actual < stock_minimo;

  -- ── Órdenes de compra ──────────────────────────────────────
  SELECT
    COUNT(*) FILTER (WHERE status IN ('enviada', 'confirmada')),
    COALESCE(SUM(total) FILTER (WHERE status IN ('enviada', 'confirmada')), 0)
  INTO _oc_pendientes, _oc_monto_pendiente
  FROM public.ordenes_compra;

  -- ── Serie temporal: ingresos diarios del período ───────────
  -- (para el gráfico de línea)
  _result := jsonb_build_object(
    -- KPIs principales
    'ingresos_totales',       _ingresos_totales,
    'ingresos_mes_ant',       _ingresos_mes_ant,
    'ingresos_var_pct',       CASE WHEN _ingresos_mes_ant > 0
                                THEN ROUND(((_ingresos_totales - _ingresos_mes_ant) / _ingresos_mes_ant * 100)::NUMERIC, 1)
                                ELSE NULL END,

    -- Canal POS
    'ventas_pos',             _ventas_pos_periodo,
    'ventas_pos_count',       _ventas_pos_count,
    'ticket_promedio_pos',    _ticket_promedio_pos,

    -- Canal ecommerce
    'ventas_ecommerce',       _ventas_ec_periodo,
    'pedidos_ec_count',       _pedidos_ec_count,

    -- Clientes
    'clientes_nuevos',        _clientes_nuevos,
    'clientes_total',         _clientes_total,

    -- Producción
    'prod_pendientes',        _prod_pendientes,
    'prod_en_proceso',        _prod_en_proceso,
    'prod_vencidas',          _prod_vencidas,
    'prod_terminadas',        _prod_terminadas_periodo,
    'tiempo_prod_promedio_dias', _tiempo_prod_promedio,

    -- Alertas operacionales
    'insumos_stock_bajo',     _insumos_stock_bajo,
    'oc_pendientes',          _oc_pendientes,
    'oc_monto_pendiente',     _oc_monto_pendiente,

    -- Metadata
    'periodo_desde',          _desde,
    'periodo_hasta',          _hasta,
    'is_admin',               _is_admin
  );

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis TO authenticated;

-- ── Series para gráficos (función separada para no inflar el RPC principal) ──

CREATE OR REPLACE FUNCTION public.get_dashboard_series(
  _desde DATE DEFAULT (date_trunc('month', CURRENT_DATE))::DATE,
  _hasta DATE DEFAULT CURRENT_DATE,
  _agrupacion TEXT DEFAULT 'dia'   -- 'dia' | 'semana' | 'mes'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id  UUID := auth.uid();
  _is_admin BOOLEAN;
  _trunc    TEXT;
BEGIN
  IF NOT (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'vendedor')) THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;
  _is_admin := public.has_role(_user_id, 'admin');

  _trunc := CASE _agrupacion
    WHEN 'semana' THEN 'week'
    WHEN 'mes'    THEN 'month'
    ELSE               'day'
  END;

  -- Serie de ingresos combinados (POS + ecommerce)
  RETURN (
    WITH pos_series AS (
      SELECT
        date_trunc(_trunc, created_at)::DATE AS fecha,
        COALESCE(SUM(total), 0) AS pos_total,
        COUNT(*) AS pos_count
      FROM public.sales
      WHERE created_at::DATE BETWEEN _desde AND _hasta
        AND estado = 'completada'
        AND (_is_admin OR vendedor_id = _user_id)
      GROUP BY 1
    ),
    ec_series AS (
      SELECT
        date_trunc(_trunc, created_at)::DATE AS fecha,
        COALESCE(SUM(total), 0) AS ec_total,
        COUNT(*) AS ec_count
      FROM public.orders
      WHERE created_at::DATE BETWEEN _desde AND _hasta
        AND status NOT IN ('pendiente', 'cancelado')
      GROUP BY 1
    ),
    -- Top 5 productos POS por período
    top_productos AS (
      SELECT
        si.title,
        SUM(si.qty)::INT   AS unidades,
        SUM(si.total)      AS total
      FROM public.sale_items si
      JOIN public.sales s ON s.id = si.sale_id
      WHERE s.created_at::DATE BETWEEN _desde AND _hasta
        AND s.estado = 'completada'
        AND (_is_admin OR s.vendedor_id = _user_id)
      GROUP BY si.title
      ORDER BY unidades DESC
      LIMIT 5
    ),
    -- Top 5 por ecommerce
    top_ec AS (
      SELECT
        oi.title,
        SUM(oi.qty)::INT  AS unidades,
        SUM(oi.total)     AS total
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.created_at::DATE BETWEEN _desde AND _hasta
        AND o.status NOT IN ('pendiente', 'cancelado')
      GROUP BY oi.title
      ORDER BY unidades DESC
      LIMIT 5
    ),
    -- Top vendedores
    top_vendedores AS (
      SELECT
        s.vendedor_id,
        p.full_name,
        SUM(s.total)  AS total,
        COUNT(*)::INT AS ventas
      FROM public.sales s
      JOIN public.profiles p ON p.id = s.vendedor_id
      WHERE s.created_at::DATE BETWEEN _desde AND _hasta
        AND s.estado = 'completada'
      GROUP BY s.vendedor_id, p.full_name
      ORDER BY total DESC
      LIMIT 5
    ),
    -- Métodos de pago
    metodos AS (
      SELECT
        metodo_pago AS metodo,
        SUM(total)  AS total,
        COUNT(*)::INT AS count
      FROM public.sales
      WHERE created_at::DATE BETWEEN _desde AND _hasta
        AND estado = 'completada'
        AND (_is_admin OR vendedor_id = _user_id)
      GROUP BY metodo_pago
    )
    SELECT jsonb_build_object(
      'ingresos_serie', (
        SELECT jsonb_agg(jsonb_build_object(
          'fecha',   COALESCE(pos.fecha, ec.fecha),
          'pos',     COALESCE(pos.pos_total, 0),
          'ec',      COALESCE(ec.ec_total, 0),
          'total',   COALESCE(pos.pos_total, 0) + COALESCE(ec.ec_total, 0)
        ) ORDER BY COALESCE(pos.fecha, ec.fecha))
        FROM pos_series pos FULL OUTER JOIN ec_series ec USING (fecha)
      ),
      'top_productos_pos', (SELECT jsonb_agg(row_to_json(tp)) FROM top_productos tp),
      'top_productos_ec',  (SELECT jsonb_agg(row_to_json(te)) FROM top_ec te),
      'top_vendedores',    (SELECT jsonb_agg(row_to_json(tv)) FROM top_vendedores tv),
      'metodos_pago',      (SELECT jsonb_agg(row_to_json(m))  FROM metodos m)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_series TO authenticated;
```

---

## 2. Actualizar `getDashboard` en `pos.functions.ts`

Reemplaza la función completa con dos nuevas:

```ts
// src/lib/pos.functions.ts — REEMPLAZAR getDashboard()

export async function getDashboardKpis(input?: {
  desde?: string;  // YYYY-MM-DD
  hasta?: string;
}) {
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase.rpc("get_dashboard_kpis", {
    _desde: input?.desde ?? null,
    _hasta: input?.hasta ?? null,
  });
  if (error) throw new Error(error.message);
  return data as {
    ingresos_totales:         number;
    ingresos_mes_ant:         number;
    ingresos_var_pct:         number | null;
    ventas_pos:               number;
    ventas_pos_count:         number;
    ticket_promedio_pos:      number;
    ventas_ecommerce:         number;
    pedidos_ec_count:         number;
    clientes_nuevos:          number;
    clientes_total:           number;
    prod_pendientes:          number;
    prod_en_proceso:          number;
    prod_vencidas:            number;
    prod_terminadas:          number;
    tiempo_prod_promedio_dias: number;
    insumos_stock_bajo:       number;
    oc_pendientes:            number;
    oc_monto_pendiente:       number;
    periodo_desde:            string;
    periodo_hasta:            string;
    is_admin:                 boolean;
  };
}

export async function getDashboardSeries(input?: {
  desde?: string;
  hasta?: string;
  agrupacion?: "dia" | "semana" | "mes";
}) {
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase.rpc("get_dashboard_series", {
    _desde:      input?.desde ?? null,
    _hasta:      input?.hasta ?? null,
    _agrupacion: input?.agrupacion ?? "dia",
  });
  if (error) throw new Error(error.message);
  return data as {
    ingresos_serie:     Array<{ fecha: string; pos: number; ec: number; total: number }>;
    top_productos_pos:  Array<{ title: string; unidades: number; total: number }>;
    top_productos_ec:   Array<{ title: string; unidades: number; total: number }>;
    top_vendedores:     Array<{ vendedor_id: string; full_name: string; total: number; ventas: number }>;
    metodos_pago:       Array<{ metodo: string; total: number; count: number }>;
  };
}
```

---

## 3. Reemplazar `dashboard.tsx`

Reemplaza el contenido completo de `src/routes/_authenticated/dashboard.tsx`:

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboardKpis, getDashboardSeries } from "@/lib/pos.functions";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  Loader2, TrendingUp, TrendingDown, ShoppingCart, Globe,
  Users, Hammer, AlertTriangle, Truck, Package,
  Calendar, ChevronDown, RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";
import { format, subDays, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — G&M" }] }),
  component: DashboardPage,
});

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) =>
  n >= 1000 ? `S/ ${(n / 1000).toFixed(1)}k` : fmt(n);

const PERIOD_OPTIONS = [
  { key: "hoy",         label: "Hoy" },
  { key: "7d",          label: "Últimos 7 días" },
  { key: "mes",         label: "Este mes" },
  { key: "mes_ant",     label: "Mes anterior" },
  { key: "trimestre",   label: "Este trimestre" },
  { key: "anio",        label: "Este año" },
] as const;

type PeriodKey = typeof PERIOD_OPTIONS[number]["key"];

function getRange(key: PeriodKey): { desde: string; hasta: string; agrupacion: "dia" | "semana" | "mes" } {
  const today = new Date();
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  switch (key) {
    case "hoy":
      return { desde: iso(today), hasta: iso(today), agrupacion: "dia" };
    case "7d":
      return { desde: iso(subDays(today, 6)), hasta: iso(today), agrupacion: "dia" };
    case "mes":
      return { desde: iso(startOfMonth(today)), hasta: iso(today), agrupacion: "dia" };
    case "mes_ant": {
      const ant = subMonths(today, 1);
      return { desde: iso(startOfMonth(ant)), hasta: iso(new Date(ant.getFullYear(), ant.getMonth() + 1, 0)), agrupacion: "dia" };
    }
    case "trimestre":
      return { desde: iso(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)), hasta: iso(today), agrupacion: "semana" };
    case "anio":
      return { desde: `${today.getFullYear()}-01-01`, hasta: iso(today), agrupacion: "mes" };
  }
}

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, trend, alert, onClick,
}: {
  label: string; value: string; sub?: string;
  icon: any; trend?: number | null;
  alert?: boolean; onClick?: () => void;
}) {
  return (
    <Card
      className={`p-5 cursor-default ${alert ? "border-amber-300 bg-amber-50/60" : ""} ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl font-display font-semibold truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          {trend !== undefined && trend !== null && (
            <div className={`flex items-center gap-0.5 text-xs mt-1 font-medium ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
              {trend >= 0
                ? <TrendingUp className="h-3 w-3" />
                : <TrendingDown className="h-3 w-3" />}
              {trend >= 0 ? "+" : ""}{trend}% vs período anterior
            </div>
          )}
        </div>
        <div className={`ml-3 p-2.5 rounded-xl flex-shrink-0 ${alert ? "bg-amber-100" : "bg-primary/8"}`}>
          <Icon className={`h-5 w-5 ${alert ? "text-amber-600" : "text-primary/60"}`} />
        </div>
      </div>
    </Card>
  );
}

// ── Tooltip customizado ───────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-sm">
      <p className="font-medium mb-1.5 text-xs text-muted-foreground">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-semibold">{fmtShort(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const range = useMemo(() => getRange(period), [period]);

  const kpisQuery = useQuery({
    queryKey: ["dashboard-kpis", range.desde, range.hasta],
    queryFn: () => getDashboardKpis({ desde: range.desde, hasta: range.hasta }),
    staleTime: 60_000,
  });

  const seriesQuery = useQuery({
    queryKey: ["dashboard-series", range.desde, range.hasta, range.agrupacion],
    queryFn: () => getDashboardSeries({ desde: range.desde, hasta: range.hasta, agrupacion: range.agrupacion }),
    staleTime: 60_000,
  });

  const kpis = kpisQuery.data;
  const series = seriesQuery.data;
  const loading = kpisQuery.isLoading;

  // Colores del design system usando CSS variables directamente
  const COLOR_POS = "hsl(var(--primary))";
  const COLOR_EC  = "hsl(var(--accent))";
  const COLOR_PIE = ["hsl(var(--primary))", "hsl(var(--accent))", "#6d28d9", "#0e7490", "#78350f"];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {kpis
              ? `${format(new Date(kpis.periodo_desde), "d MMM", { locale: es })} — ${format(new Date(kpis.periodo_hasta), "d MMM yyyy", { locale: es })}`
              : "Cargando período..."}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-44">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(({ key, label }) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline" size="sm"
            onClick={() => { kpisQuery.refetch(); seriesQuery.refetch(); }}
          >
            <RefreshCw className={`h-4 w-4 ${kpisQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : kpis ? (
        <>
          {/* ── Alertas operacionales ── */}
          {(kpis.prod_vencidas > 0 || kpis.insumos_stock_bajo > 0 || kpis.oc_pendientes > 0) && (
            <div className="flex gap-3 flex-wrap">
              {kpis.prod_vencidas > 0 && (
                <button
                  onClick={() => navigate({ to: "/produccion" })}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 hover:bg-red-100 transition-colors"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <strong>{kpis.prod_vencidas}</strong> orden{kpis.prod_vencidas > 1 ? "es" : ""} de producción vencida{kpis.prod_vencidas > 1 ? "s" : ""}
                </button>
              )}
              {kpis.insumos_stock_bajo > 0 && (
                <button
                  onClick={() => navigate({ to: "/insumos" })}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <Package className="h-4 w-4" />
                  <strong>{kpis.insumos_stock_bajo}</strong> insumo{kpis.insumos_stock_bajo > 1 ? "s" : ""} bajo mínimo
                </button>
              )}
              {kpis.oc_pendientes > 0 && (
                <button
                  onClick={() => navigate({ to: "/proveedores" })}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Truck className="h-4 w-4" />
                  <strong>{kpis.oc_pendientes}</strong> OC pendiente{kpis.oc_pendientes > 1 ? "s" : ""} — {fmt(kpis.oc_monto_pendiente)}
                </button>
              )}
            </div>
          )}

          {/* ── KPIs principales ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Ingresos totales"
              value={fmt(kpis.ingresos_totales)}
              sub={`POS ${fmt(kpis.ventas_pos)} + Web ${fmt(kpis.ventas_ecommerce)}`}
              icon={TrendingUp}
              trend={kpis.ingresos_var_pct}
            />
            <KpiCard
              label="Ventas POS"
              value={fmt(kpis.ventas_pos)}
              sub={`${kpis.ventas_pos_count} transacciones · ticket S/ ${kpis.ticket_promedio_pos}`}
              icon={ShoppingCart}
              onClick={() => navigate({ to: "/ventas" })}
            />
            <KpiCard
              label="Pedidos online"
              value={fmt(kpis.ventas_ecommerce)}
              sub={`${kpis.pedidos_ec_count} pedidos pagados`}
              icon={Globe}
              onClick={() => navigate({ to: "/pedidos" })}
            />
            <KpiCard
              label="Clientes nuevos"
              value={String(kpis.clientes_nuevos)}
              sub={`${kpis.clientes_total} clientes en total`}
              icon={Users}
              onClick={() => navigate({ to: "/clientes" })}
            />
          </div>

          {/* ── KPIs operacionales ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="En producción"
              value={String(kpis.prod_en_proceso)}
              sub={`${kpis.prod_pendientes} pendientes`}
              icon={Hammer}
              onClick={() => navigate({ to: "/produccion" })}
            />
            <KpiCard
              label="Terminadas (período)"
              value={String(kpis.prod_terminadas)}
              sub={kpis.tiempo_prod_promedio_dias > 0 ? `Promedio ${kpis.tiempo_prod_promedio_dias} días` : undefined}
              icon={Hammer}
            />
            <KpiCard
              label="Insumos bajo mínimo"
              value={String(kpis.insumos_stock_bajo)}
              icon={Package}
              alert={kpis.insumos_stock_bajo > 0}
              onClick={() => navigate({ to: "/insumos" })}
            />
            <KpiCard
              label="OC pendientes"
              value={String(kpis.oc_pendientes)}
              sub={kpis.oc_pendientes > 0 ? fmt(kpis.oc_monto_pendiente) : "Todo al día"}
              icon={Truck}
              alert={kpis.oc_pendientes > 0}
              onClick={() => navigate({ to: "/proveedores" })}
            />
          </div>

          {/* ── Gráfico de ingresos combinados ── */}
          <Card className="p-6">
            <h3 className="font-semibold mb-5">Ingresos por canal</h3>
            {seriesQuery.isLoading ? (
              <div className="flex justify-center h-64 items-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={series?.ingresos_serie ?? []}>
                    <defs>
                      <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLOR_POS} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLOR_POS} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ecGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLOR_EC} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={COLOR_EC} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="fecha"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(v) => {
                        const d = new Date(v + "T12:00:00");
                        return range.agrupacion === "mes"
                          ? format(d, "MMM", { locale: es })
                          : format(d, "d MMM", { locale: es });
                      }}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={fmtShort} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="pos" name="POS"
                      stroke={COLOR_POS} fill="url(#posGrad)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="ec" name="Ecommerce"
                      stroke={COLOR_EC} fill="url(#ecGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* ── Fila de gráficos secundarios ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Top productos POS */}
            <Card className="p-5">
              <h3 className="font-semibold mb-4 text-sm">Top productos POS</h3>
              {seriesQuery.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : (series?.top_productos_pos ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin ventas en el período</p>
              ) : (
                <div className="space-y-2.5">
                  {series!.top_productos_pos.map((p, i) => (
                    <div key={p.title} className="flex items-center gap-2.5">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{p.unidades} u. · {fmt(p.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Métodos de pago */}
            <Card className="p-5">
              <h3 className="font-semibold mb-4 text-sm">Métodos de pago</h3>
              {seriesQuery.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : (series?.metodos_pago ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="h-36">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={series!.metodos_pago}
                          dataKey="total"
                          nameKey="metodo"
                          cx="50%" cy="50%"
                          outerRadius={60}
                          innerRadius={30}
                        >
                          {series!.metodos_pago.map((_, i) => (
                            <Cell key={i} fill={COLOR_PIE[i % COLOR_PIE.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5">
                    {series!.metodos_pago.map((m, i) => (
                      <div key={m.metodo} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLOR_PIE[i % COLOR_PIE.length] }} />
                          <span className="capitalize">{m.metodo.replace("_", " ")}</span>
                        </div>
                        <span className="font-medium">{fmt(m.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Top vendedores */}
            <Card className="p-5">
              <h3 className="font-semibold mb-4 text-sm">Top vendedores</h3>
              {seriesQuery.isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : (series?.top_vendedores ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer>
                    <BarChart
                      data={series!.top_vendedores}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category" dataKey="full_name"
                        width={80} fontSize={11}
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(v) => v.split(" ")[0]}
                      />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="total" fill={COLOR_POS} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* ── Canal web: top productos ecommerce ── */}
          {(series?.top_productos_ec ?? []).length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold mb-4 text-sm">Top productos ecommerce</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {series!.top_productos_ec.map((p, i) => (
                  <div key={p.title} className="bg-muted/30 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">#{i + 1}</p>
                    <p className="font-medium text-sm truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{p.unidades} u.</p>
                    <p className="font-semibold text-sm">{fmt(p.total)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
```

---

## 4. Lista de verificación

### Base de datos
- [ ] Ejecutar migración `20260608_dashboard_kpis.sql` — crea `get_dashboard_kpis()` y `get_dashboard_series()`
- [ ] Verificar que `ordenes_compra` del módulo 6 existe antes de ejecutar (la función la consulta)
- [ ] Si el módulo 4 (insumos) aún no está en producción, comentar temporalmente las líneas de `insumos_stock_bajo` en la función hasta que la tabla exista

### Código
- [ ] Reemplazar `getDashboard()` por `getDashboardKpis()` y `getDashboardSeries()` en `pos.functions.ts`
- [ ] Reemplazar el contenido completo de `dashboard.tsx`
- [ ] Verificar que `useNavigate` de `@tanstack/react-router` está disponible (lo está desde la versión en `package.json`)

### Verificación funcional
- [ ] Dashboard carga con el período "Este mes" por defecto
- [ ] Selector de período cambia las queries y actualiza todos los KPIs
- [ ] Los KPIs de ingresos muestran POS + ecommerce por separado y combinados
- [ ] El % de variación vs período anterior aparece en verde/rojo según corresponda
- [ ] El gráfico de área muestra las dos series (POS y Ecommerce) apiladas
- [ ] Las alertas de producción vencida / stock bajo / OC pendientes aparecen en la parte superior
- [ ] Hacer click en una alerta navega a la ruta correspondiente
- [ ] Top vendedores aparece (requiere que `profiles.full_name` esté cargado para los usuarios)
- [ ] Métodos de pago muestra el pie chart correcto
- [ ] Con el período "Año" el gráfico agrupa por mes en lugar de día

---

## 5. Notas importantes

**`get_dashboard_kpis` usa `SECURITY DEFINER`** — se ejecuta con permisos del owner de la función. Esto es necesario porque el vendedor normalmente solo ve sus propias ventas (RLS), pero para los KPIs operacionales (producción, stock, OC) necesita leer tablas completas. La función maneja esto internamente con el flag `_is_admin`.

**Si algún módulo anterior no está instalado**, la función fallará en la sección correspondiente. El orden de dependencias es:
1. `public.sales` — módulo base ✅
2. `public.orders` — módulo 1 ✅
3. `public.produccion` — módulo 2 / 5 ✅
4. `public.insumos` — módulo 4 ← necesario para `insumos_stock_bajo`
5. `public.ordenes_compra` — módulo 6 ← necesario para `oc_pendientes`

Si vas a desplegar el dashboard antes de tener los módulos 4 y 6, usa esta versión reducida de la función que comenta esas secciones y devuelve 0 para esos campos:

```sql
-- Versión reducida para despliegue parcial
-- Reemplaza las líneas de insumos y OC por:
SELECT 0 INTO _insumos_stock_bajo;
SELECT 0, 0 INTO _oc_pendientes, _oc_monto_pendiente;
```

**El `getDashboard()` original sigue en `pos.functions.ts`** después de añadir las nuevas funciones. Puedes eliminarlo cuando confirmes que nada más lo importa (solo `dashboard.tsx` lo usaba).

**`recharts` con `PieChart` + `innerRadius`** produce un donut chart que funciona mejor visualmente que un pie sólido cuando hay pocos segmentos (los 4-5 métodos de pago). Si prefieres barras horizontales, cambia el componente a `BarChart` con `layout="vertical"` igual que el de vendedores.


















































































































































































# Módulo 8 — Dashboard Central de KPIs
**G&M Mueblería** · Pantalla de misión de control, sin interacción, auto-refresh

---

## Concepto y diferencia con el módulo 7

| Módulo 7 (`/dashboard`) | Módulo 8 (`/central`) |
|---|---|
| Dashboard operativo con selector de período | Pantalla fija de estado en tiempo real |
| El usuario interactúa, filtra, navega | Sin interacción — pensado para TV/monitor |
| Carga datos bajo demanda | Auto-refresh cada 90 segundos |
| Análisis histórico | Foto actual del negocio |

`/central` es la pantalla que el dueño deja abierta en su monitor o en una TV de la tienda. Muestra siempre el estado de hoy.

---

## Decisiones de diseño

**Firma visual — el pipeline de producción como franja central.** Los 5 estados del pipeline (`pendiente → en proceso → control calidad → listo despacho → enviado`) se dibujan como nodos circulares conectados con una línea, con el conteo de órdenes en cada estado debajo. Esta franja es el elemento que no tiene equivalente en ningún dashboard genérico — codifica el flujo real de trabajo de la mueblería.

**Tipografía:** Cormorant Garamond (ya cargada en el proyecto) para todos los números grandes. Inter para etiquetas y datos secundarios. Los números grandes en serif dan carácter sin necesitar decoración extra.

**Sin fondo oscuro.** Se usa el `--background` cálido crema del sistema, no negro. El cliché de dashboard de TV en negro/verde fluorescente no corresponde a la identidad de G&M.

**Reloj y countdown.** Un reloj en tiempo real en la esquina superior derecha y un contador regresivo de los 90 segundos hasta el próximo refresh dan sensación de "vivo" sin animaciones costosas. El punto verde se vuelve rojo en los últimos 10 segundos antes del refresh.

---

## 1. Ruta `/central` — código completo

Crea `src/routes/_authenticated/central.tsx`:

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboardKpis, getDashboardSeries } from "@/lib/pos.functions";
import { useEffect, useRef, useState } from "react";
import { format, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import {
  Clock, Hammer, Package, CheckCircle2, Truck,
  AlertTriangle, Box, ShoppingCart, Globe,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/central")({
  head: () => ({ meta: [{ title: "G&M · Central KPIs" }] }),
  component: CentralPage,
});

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency", currency: "PEN", maximumFractionDigits: 0,
  }).format(n);

const fmtShort = (n: number) =>
  n >= 1000 ? `S/ ${(n / 1000).toFixed(1)}k` : fmt(n);

const hoy = () => format(new Date(), "yyyy-MM-dd");
const inicioMes = () => format(startOfMonth(new Date()), "yyyy-MM-dd");

// ── Pipeline node ─────────────────────────────────────────────
function PipelineNode({
  icon: Icon, label, count, color, bg, isLast, alert,
}: {
  icon: React.ElementType; label: string; count: number;
  color: string; bg: string; isLast?: boolean; alert?: boolean;
}) {
  return (
    <div className="flex flex-col items-center flex-1 relative">
      {/* línea conectora */}
      {!isLast && (
        <div className="absolute top-[21px] z-0"
          style={{ left: "calc(50% + 21px)", right: "calc(-50% + 21px)", height: 1, background: "var(--border)" }} />
      )}
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center relative z-10 flex-shrink-0"
        style={{ background: bg, color }}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="font-display text-2xl font-semibold mt-1.5 leading-none" style={{ color: "var(--foreground)" }}>
        {count}
        {alert && <span className="text-sm ml-1" style={{ color: "#A32D2D" }}>⚠</span>}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-center mt-1 max-w-[70px] leading-tight"
        style={{ color: "var(--muted-foreground)" }}>
        {label}
      </p>
    </div>
  );
}

// ── Barra de ranking ──────────────────────────────────────────
function RankRow({ pos, name, total, maxTotal, color }: {
  pos: number; name: string; total: number; maxTotal: number; color: string;
}) {
  const pct = Math.round((total / maxTotal) * 100);
  return (
    <div className="flex items-center gap-2.5 py-1.5 border-b last:border-0"
      style={{ borderColor: "var(--border)" }}>
      <span className="text-[11px] w-4 text-right flex-shrink-0"
        style={{ color: "var(--muted-foreground)" }}>{pos}</span>
      <span className="text-xs flex-[0_0_82px] truncate" style={{ color: "var(--foreground)" }}>{name}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--muted)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-medium flex-shrink-0 min-w-[52px] text-right"
        style={{ color: "var(--foreground)" }}>
        {fmtShort(total)}
      </span>
    </div>
  );
}

// ── KPI Card grande ────────────────────────────────────────────
function KpiCard({
  label, value, sub, trend, alert,
}: {
  label: string; value: string; sub?: string;
  trend?: { pct: number } | null; alert?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{
        background: "var(--card)",
        borderColor: alert ? "#FAC775" : "var(--border)",
        backgroundColor: alert ? "oklch(0.985 0.025 80)" : undefined,
      }}
    >
      <p className="text-[10px] uppercase tracking-widest mb-1"
        style={{ color: "var(--muted-foreground)" }}>{label}</p>
      <p className="font-display text-3xl font-semibold leading-none"
        style={{ color: "var(--foreground)" }}>{value}</p>
      {sub && <p className="text-xs mt-1.5" style={{ color: "var(--muted-foreground)" }}>{sub}</p>}
      {trend && (
        <span
          className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full"
          style={trend.pct >= 0
            ? { background: "#EAF3DE", color: "#3B6D11" }
            : { background: "#FAECE7", color: "#993C1D" }
          }
        >
          {trend.pct >= 0 ? "↑" : "↓"} {Math.abs(trend.pct)}% vs mes ant.
        </span>
      )}
    </div>
  );
}

// ── Alert pill ────────────────────────────────────────────────
function AlertPill({ icon: Icon, text, tipo }: {
  icon: React.ElementType; text: string; tipo: "warn" | "info" | "danger";
}) {
  const styles = {
    warn:   { bg: "#FAEEDA", color: "#854F0B" },
    info:   { bg: "#E6F1FB", color: "#185FA5" },
    danger: { bg: "#FCEBEB", color: "#A32D2D" },
  }[tipo];
  return (
    <div className="flex items-center gap-2 py-1.5 border-b last:border-0"
      style={{ borderColor: "var(--border)" }}>
      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: styles.bg }}>
        <Icon className="h-3.5 w-3.5" style={{ color: styles.color }} />
      </div>
      <span className="text-xs leading-tight" style={{ color: "var(--foreground)" }}>{text}</span>
    </div>
  );
}

// ── Reloj + countdown ─────────────────────────────────────────
function LiveClock({ onRefresh }: { onRefresh: () => void }) {
  const [time, setTime] = useState(new Date());
  const [countdown, setCountdown] = useState(90);
  const cdRef = useRef(90);

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date());
      cdRef.current -= 1;
      if (cdRef.current <= 0) {
        cdRef.current = 90;
        onRefresh();
      }
      setCountdown(cdRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [onRefresh]);

  const urgent = countdown <= 10;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm tabular-nums" style={{ color: "var(--muted-foreground)" }}>
        {format(time, "HH:mm:ss")}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background: urgent ? "#E24B4A" : "#3B6D11",
            transition: "background 0.3s",
          }}
        />
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {urgent ? `Actualizando en ${countdown}s...` : `En vivo · ${countdown}s`}
        </span>
      </span>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────
function CentralPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const desde = inicioMes();
  const hasta = hoy();

  const kpisQ = useQuery({
    queryKey: ["central-kpis", desde, hasta, refreshKey],
    queryFn: () => getDashboardKpis({ desde, hasta }),
    staleTime: 0,
  });

  const seriesQ = useQuery({
    queryKey: ["central-series", desde, hasta, refreshKey],
    queryFn: () => getDashboardSeries({ desde, hasta, agrupacion: "dia" }),
    staleTime: 0,
  });

  const kpis = kpisQ.data;
  const series = seriesQ.data;

  // Alertas operacionales derivadas de los KPIs
  const alertas = kpis ? [
    kpis.prod_vencidas > 0 && {
      icon: AlertTriangle,
      text: `${kpis.prod_vencidas} orden${kpis.prod_vencidas > 1 ? "es" : ""} de producción vencida${kpis.prod_vencidas > 1 ? "s" : ""}`,
      tipo: "danger" as const,
    },
    kpis.insumos_stock_bajo > 0 && {
      icon: Box,
      text: `${kpis.insumos_stock_bajo} insumo${kpis.insumos_stock_bajo > 1 ? "s" : ""} bajo stock mínimo`,
      tipo: "warn" as const,
    },
    kpis.oc_pendientes > 0 && {
      icon: Truck,
      text: `${kpis.oc_pendientes} OC pendiente${kpis.oc_pendientes > 1 ? "s" : ""} — ${fmt(kpis.oc_monto_pendiente)}`,
      tipo: "info" as const,
    },
  ].filter(Boolean) as Array<{ icon: React.ElementType; text: string; tipo: "warn" | "info" | "danger" }>
  : [];

  const topProductos = series?.top_productos_pos?.slice(0, 5) ?? [];
  const topVendedores = series?.top_vendedores?.slice(0, 3) ?? [];
  const maxProducto = Math.max(...topProductos.map((p) => p.total), 1);
  const maxVendedor = Math.max(...topVendedores.map((v) => v.total), 1);

  const PRODUCT_COLORS = ["#378ADD", "#185FA5", "#0C447C", "#1D9E75", "#0F6E56"];
  const VENDOR_COLORS  = ["#378ADD", "#1D9E75", "#7F77DD"];

  return (
    <div className="space-y-3 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-xl font-semibold" style={{ color: "var(--foreground)" }}>
            G&M Mueblería
          </h1>
          <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>Central de KPIs</span>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            · {format(new Date(), "MMMM yyyy", { locale: es })}
          </span>
        </div>
        <LiveClock onRefresh={() => setRefreshKey((k) => k + 1)} />
      </div>

      {/* Fila 1: KPIs financieros */}
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-2">
          <KpiCard
            label="Ingresos del mes"
            value={kpis ? fmt(kpis.ingresos_totales) : "—"}
            sub={kpis
              ? `POS ${fmt(kpis.ventas_pos)} · Web ${fmt(kpis.ventas_ecommerce)}`
              : undefined}
            trend={kpis?.ingresos_var_pct != null ? { pct: kpis.ingresos_var_pct } : null}
          />
        </div>
        <KpiCard
          label="Ticket promedio POS"
          value={kpis ? fmt(kpis.ticket_promedio_pos) : "—"}
          sub={kpis ? `${kpis.ventas_pos_count} transacciones` : undefined}
        />
        <KpiCard
          label="Pedidos online pagados"
          value={kpis ? String(kpis.pedidos_ec_count) : "—"}
          sub={kpis ? `${kpis.clientes_nuevos} clientes nuevos` : undefined}
        />
      </div>

      {/* Fila 2: Pipeline de producción */}
      <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <p className="text-[10px] uppercase tracking-widest mb-4"
          style={{ color: "var(--muted-foreground)" }}>
          Pipeline de producción · órdenes activas
        </p>
        <div className="flex items-start px-4">
          <PipelineNode icon={Clock}        label="Pendiente"    count={kpis?.prod_pendientes ?? 0}  color="#854F0B" bg="#FAEEDA" />
          <PipelineNode icon={Hammer}       label="En proceso"   count={kpis?.prod_en_proceso ?? 0}  color="#185FA5" bg="#E6F1FB" />
          <PipelineNode icon={CheckCircle2} label="Control calidad" count={0}                        color="#534AB7" bg="#EEEDFE" />
          <PipelineNode icon={Package}      label="Listo despacho"  count={0}                        color="#0F6E56" bg="#E1F5EE" />
          <PipelineNode icon={Truck}        label="Enviado"      count={0}                           color="#3B6D11" bg="#EAF3DE" isLast />
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          <span>Tiempo promedio: <strong style={{ color: "var(--foreground)" }}>
            {kpis?.tiempo_prod_promedio_dias
              ? `${kpis.tiempo_prod_promedio_dias} días`
              : "—"}
          </strong></span>
          <span>Terminadas este mes: <strong style={{ color: "var(--foreground)" }}>
            {kpis?.prod_terminadas ?? "—"}
          </strong></span>
          {(kpis?.prod_vencidas ?? 0) > 0 && (
            <span style={{ color: "#A32D2D", background: "#FCEBEB" }}
              className="px-2 rounded-full">
              ⚠ {kpis!.prod_vencidas} vencida{kpis!.prod_vencidas > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Fila 3: Rankings + alertas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[10px] uppercase tracking-widest mb-3"
            style={{ color: "var(--muted-foreground)" }}>Top productos (mes)</p>
          {topProductos.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "var(--muted-foreground)" }}>Sin ventas</p>
          ) : topProductos.map((p, i) => (
            <RankRow
              key={p.title}
              pos={i + 1}
              name={p.title}
              total={p.total}
              maxTotal={maxProducto}
              color={PRODUCT_COLORS[i % PRODUCT_COLORS.length]}
            />
          ))}
        </div>

        <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[10px] uppercase tracking-widest mb-3"
            style={{ color: "var(--muted-foreground)" }}>Top vendedores</p>
          {topVendedores.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "var(--muted-foreground)" }}>Sin datos</p>
          ) : topVendedores.map((v, i) => (
            <RankRow
              key={v.vendedor_id}
              pos={i + 1}
              name={v.full_name}
              total={v.total}
              maxTotal={maxVendedor}
              color={VENDOR_COLORS[i % VENDOR_COLORS.length]}
            />
          ))}
        </div>

        <div className="rounded-xl border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <p className="text-[10px] uppercase tracking-widest mb-3"
            style={{ color: "var(--muted-foreground)" }}>Alertas operacionales</p>
          {alertas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 gap-1.5">
              <CheckCircle2 className="h-6 w-6" style={{ color: "#3B6D11" }} />
              <p className="text-xs" style={{ color: "#3B6D11" }}>Todo en orden</p>
            </div>
          ) : alertas.map((a, i) => (
            <AlertPill key={i} {...a} />
          ))}
        </div>
      </div>

      {/* Fila 4: KPIs operacionales */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="Insumos bajo mínimo"
          value={kpis ? String(kpis.insumos_stock_bajo) : "—"}
          sub={kpis?.insumos_stock_bajo > 0 ? "Requiere reposición" : "Stock OK"}
          alert={kpis ? kpis.insumos_stock_bajo > 0 : false}
        />
        <KpiCard
          label="OC pendientes"
          value={kpis ? String(kpis.oc_pendientes) : "—"}
          sub={kpis?.oc_pendientes > 0 ? fmt(kpis.oc_monto_pendiente) + " comprometido" : "Al día"}
        />
        <KpiCard
          label="Clientes totales"
          value={kpis ? String(kpis.clientes_total) : "—"}
          sub={kpis ? `${kpis.clientes_nuevos} nuevos este mes` : undefined}
        />
        <KpiCard
          label="Órdenes terminadas"
          value={kpis ? String(kpis.prod_terminadas) : "—"}
          sub="este mes"
        />
      </div>
    </div>
  );
}
```

---

## 2. Ajustes en `_authenticated.tsx` — layout sin padding para pantalla completa

La ruta `/central` funciona mejor sin el sidebar ni el padding estándar. Añade soporte para un layout "fullscreen":

```tsx
// src/routes/_authenticated.tsx — en el <main>, condicionalmente quitar padding
import { useRouterState } from "@tanstack/react-router";

// Dentro de AuthLayout:
const currentPath = useRouterState({ select: (r) => r.location.pathname });
const isFullscreen = currentPath === "/central";

// En el JSX:
<main className={isFullscreen ? "flex-1 p-4 overflow-auto" : "flex-1 p-6 overflow-auto"}>
  <Outlet />
</main>
```

Para ocultarlo completamente del sidebar, puedes añadir un botón "Pantalla central" en el footer del sidebar:

```tsx
// AppSidebar.tsx — en SidebarFooter, encima del logout
<SidebarMenuItem>
  <SidebarMenuButton asChild>
    <Link to="/central">
      <LayoutGrid className="h-4 w-4" />
      <span>Central KPIs</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```

La ruta `/central` **no aparece en el array `items`** del sidebar (eso que tiene los items de navegación principal), así que no se muestra como ítem de menú. Solo el botón especial en el footer la enlaza.

---

## 3. Lista de verificación

### Requisitos previos
- [ ] Módulo 7 implementado — `getDashboardKpis()` y `getDashboardSeries()` deben existir en `pos.functions.ts`
- [ ] Funciones RPC `get_dashboard_kpis` y `get_dashboard_series` desplegadas en Supabase

### Código
- [ ] Crear `src/routes/_authenticated/central.tsx` con el código completo
- [ ] Añadir enlace "Central KPIs" en el footer del sidebar (`AppSidebar.tsx`)
- [ ] Importar `LayoutGrid` de `lucide-react` en `AppSidebar.tsx`

### Verificación funcional
- [ ] `/central` carga con los datos del mes actual
- [ ] El reloj actualiza cada segundo
- [ ] El countdown regresa desde 90s y reinicia las queries al llegar a 0
- [ ] El punto se vuelve rojo en los últimos 10 segundos
- [ ] El pipeline muestra los conteos reales de producción
- [ ] Las alertas de producción/stock/OC aparecen cuando corresponde
- [ ] El bloque de alertas muestra "Todo en orden" con check verde cuando no hay nada

---

## 4. Notas

**Los estados `control_calidad` y `listo_despacho` en el pipeline** requieren que `get_dashboard_kpis` los desglose individualmente. En la función actual del módulo 7, `prod_en_proceso` agrupa todo lo que no es `pendiente` ni `terminado`. Para mostrar cada nodo por separado, amplía la función RPC:

```sql
-- Añadir a get_dashboard_kpis, dentro del bloque de producción:
COUNT(*) FILTER (WHERE p.status = 'pendiente')          AS prod_pendientes,
COUNT(*) FILTER (WHERE p.status = 'en_proceso')         AS prod_en_proceso,
COUNT(*) FILTER (WHERE o.status = 'control_calidad')    AS prod_control_calidad,
COUNT(*) FILTER (WHERE o.status = 'listo_despacho')     AS prod_listo_despacho,
COUNT(*) FILTER (WHERE o.status = 'enviado')            AS prod_enviado,
```

Y añadir los campos al tipo de retorno en `pos.functions.ts`. Hasta que hagas esto, los nodos de control calidad, listo despacho y enviado siempre mostrarán 0 — que es el comportamiento actual en el preview.

**Auto-refresh y React Query:** el `refreshKey` que incrementa en el callback del reloj fuerza una nueva query ignorando el cache (`staleTime: 0`). Si tienes muchos usuarios viendo esta pantalla simultáneamente en la oficina, considera aumentar el intervalo a 3-5 minutos para reducir carga en Supabase.