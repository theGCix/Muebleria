# Notificaciones por correo con n8n (cola `notificaciones`)

Hasta ahora la web y el panel dejaban avisos en la tabla `notificaciones` y la función `send-notifications` los enviaba con **Resend**. Sin dominio propio verificado, Resend no entrega a tus clientes, así que esos avisos se quedaban en la cola. Este flujo hace el mismo trabajo con **Gmail SMTP** desde n8n.

```
Web / panel admin / servidor → insertan en `notificaciones` (enviado = false)
                                      ▲
                                      │  cada 2 min
                         n8n: ¿hay avisos pendientes? → arma el correo → Gmail → los marca
```

## Qué envía

| Tipo | Quién lo encola |
|---|---|
| `en_produccion`, `control_calidad`, `listo_despacho`, `entregado`, `cancelado` | `cambiar_estado_pedido` (panel de producción) |
| `solicitud_resena` | función `solicitud-resenas` |
| `cupon_bienvenida` | cupón de salida (`server/cupon-salida.js`), cuando Resend no está configurado |
| `evidencia_pedido` | subir fotos de avance con "avisar al cliente" |

Los cambios de estado se encolan **sin mensaje**; el flujo escribe el texto según el tipo ("Tu pedido ya está en producción…") y agrega el botón *Ver mi pedido*. Si un aviso trae su propio mensaje, se respeta tal cual.

## Qué NO envía (a propósito)

- `pedido_confirmado`: ya lo manda **G&M — Pedido pagado (sin túnel)**. Si este también lo enviara, el cliente recibiría dos.
- `recordatorio_carrito`: ya lo manda **G&M — Carrito abandonado**. Mismo motivo.
- Canales `sms` y `whatsapp`: este flujo solo atiende `email`.

## Puesta en marcha (en este orden)

### 1. Base de datos
Supabase → *SQL Editor* → ejecuta `supabase/migrations/20261031_worker_notificaciones_n8n.sql`. Hace tres cosas:
- Agrega al enum `notif_tipo` los valores `cupon_bienvenida`, `recordatorio_carrito` y `evidencia_pedido`. El código ya los inserta, pero el enum original solo trae 7 tipos; si en tu base faltaban, esos avisos fallaban al encolarse.
- Agrega `intentos` y `ultimo_intento_at` para controlar reintentos.
- Crea un índice para el sondeo.

**Antes de activar el flujo**, corre la consulta de revisión que está comentada al final del archivo. El flujo envía todo lo pendiente de los últimos 3 días: si hay avisos viejos que ya no tienen sentido (p. ej. "en producción" de hace dos días), ahí mismo tienes el `UPDATE` para descartarlos.

### 2. Importar el flujo
n8n → *Import from file* → `n8n/notificaciones-correo.workflow.json`.

### 3. Credenciales
Las mismas que ya usas:
- **Supabase G&M** (Header Auth, `apikey` = service_role) en *Notificaciones pendientes*, *Marcar como enviado* y *Registrar fallo*.
- **Gmail G&M** (SMTP) en *Enviar correo*.

La URL de Supabase y el remitente ya vienen configurados (`SITE_URL` y `REMITENTE_EMAIL` están arriba en el nodo *Armar correos*).

### 4. Apagar el envío por Resend
En Supabase → *Edge Functions → Schedules*, quita la programación de `send-notifications` (si la tenías) para que no compita con este flujo. `recordatorios-carrito` tampoco hace falta mientras el carrito abandonado lo maneje n8n.

### 5. Probar
1. En Supabase, inserta un aviso de prueba con tu correo:
   ```sql
   insert into notificaciones (destinatario_email, destinatario_nombre, tipo, canal, asunto, mensaje)
   values ('TU_CORREO@gmail.com', 'Gian', 'entregado', 'email', 'Prueba n8n', 'Hola, este es un correo de prueba.');
   ```
2. En n8n pulsa **Execute workflow**: el correo debe llegar y la fila quedar con `enviado = true`.
3. Prueba también sin mensaje (`mensaje` en `null`) para ver el texto automático por tipo.
4. Activa el flujo (*Active*).

## Cómo funciona el control de errores

- Si el envío falla, la fila queda con el motivo en `error`, suma 1 a `intentos` y se vuelve a intentar a los 5 minutos.
- A los **5 intentos** deja de reintentar (para no escribir al mismo cliente indefinidamente).
- Si no hay correo válido, se descarta de inmediato (no tiene remedio).
- Cada ejecución envía como máximo 15 avisos. Gmail personal permite unos 500 correos al día; para una tienda de este tamaño sobra.
- Si tu PC estuvo apagada, al volver se envía lo pendiente de los últimos 3 días.

**Ver qué está fallando:**
```sql
select tipo, destinatario_email, intentos, error, created_at
  from notificaciones
 where enviado = false and error is not null
 order by created_at desc;
```

**Si Gmail estuvo caído o se rotó la contraseña**, los avisos pueden agotar sus 5 intentos. Cuando lo arregles, reactívalos (dentro de la ventana de 3 días):
```sql
update notificaciones set intentos = 0, ultimo_intento_at = null
 where enviado = false and error is not null and created_at > now() - interval '3 days';
```

## Pruebas del armado del correo
```
node --test n8n/*.test.js
```
(`node --test n8n/` a secas falla en algunas versiones de Node; con el `*.test.js` funciona.)
