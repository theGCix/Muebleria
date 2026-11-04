# Aviso al equipo por WhatsApp cuando entra un pedido pagado

Cuando un cliente paga, n8n te manda (a ti y a quien quieras, máximo 3 personas) un WhatsApp con lo que ventas necesita saber de inmediato.

```
Cliente paga → el servidor guarda el pedido en Supabase
                         ▲
                         │  cada minuto
              n8n (tu PC): ¿pedidos pagados sin avisar? → WhatsApp (CallMeBot) → los marca
```

Ejemplo del mensaje:

```
🛒 Pedido pagado GM-1042
👤 Ana Pérez · 999111222
💰 S/ 1,250.00 (envío S/ 150.00)
🪑 1× Sofá London
📦 Domicilio: Miraflores
👉 https://muebleria-q74c.onrender.com/pedidos
```

Si el pedido es a provincia, en vez de la línea de entrega aparece: `⚠️ PROVINCIA (Arequipa): falta cotizar el flete y confirmarlo con el cliente`. Si es recojo en tienda, lo dice. Si el cliente dejó una nota, también se incluye.

## Qué es CallMeBot y qué límites tiene

Es un servicio gratuito y **no oficial** que envía WhatsApp a tu propio número mediante una llamada HTTP. Sirve muy bien para avisos internos, con estas condiciones:

- **Cada persona activa su propio número**, una sola vez. No se puede escribir a números que no lo hayan autorizado.
- Es de un tercero ajeno a WhatsApp: puede cambiar o dejar de funcionar. Los pedidos nunca dependen de él (el flujo solo avisa); si falla, el pedido sigue normal y verás el motivo en Supabase.
- No lo uses para escribir a clientes: para eso está el correo.

## Puesta en marcha (en este orden)

### 1. Activar CallMeBot (cada persona, desde su WhatsApp)
Sigue las instrucciones de la página oficial: <https://www.callmebot.com/blog/free-api-whatsapp-messages/>. En resumen:
1. Agrega a tus contactos el número del bot que indica esa página (el número ha cambiado con el tiempo, usa el de la página).
2. Envíale por WhatsApp el mensaje `I allow callmebot to send me messages`.
3. Espera la respuesta con tu **apikey**. Si no llega en 2 minutos, la propia guía dice que lo intentes de nuevo pasadas 24 horas.

### 2. Probar el envío solo (sin n8n)
Pega esto en el navegador con tu número (con `+51`), tu apikey y el texto codificado:

```
https://api.callmebot.com/whatsapp.php?phone=+51TU_NUMERO&text=Prueba+G%26M&apikey=TU_APIKEY
```

Debe llegarte el WhatsApp. Si esto no funciona, el flujo tampoco lo hará: arréglalo primero.

### 3. Base de datos
Supabase → *SQL Editor* → ejecuta `supabase/migrations/20261031b_aviso_equipo_pedido.sql`. Agrega las columnas de control y **marca todos los pedidos actuales como ya avisados**, para que no te lleguen WhatsApp de pedidos antiguos.

### 4. Importar el flujo
n8n → *Import from file* → `n8n/aviso-equipo-pedido.workflow.json`. Asigna la credencial **Supabase G&M** (la misma de los otros flujos) a los 3 nodos de Supabase.

### 5. Configurar a quién avisar
Abre el nodo **Avisar al equipo** y edita `DESTINATARIOS` al inicio del código:

```js
const DESTINATARIOS = [
  { nombre: "Gian", telefono: "+51999999999", apikey: "tu-apikey" },
  { nombre: "Otra persona", telefono: "+51988888888", apikey: "su-apikey" },
];
```

> Las apikeys quedan dentro del flujo en tu n8n. Si exportas el flujo para guardarlo en el repositorio, **bórralas antes** o déjalo con los valores de ejemplo.

### 6. Probar con un pedido real
1. Elige un pedido tuyo de menos de 24 horas y más de 2 minutos, y márcalo como pendiente de aviso:
   ```sql
   update orders set aviso_equipo_enviado_at = null, aviso_equipo_intentos = 0
    where order_number = 'GM-XXXX';
   ```
   (si es más antiguo, haz esta prueba con una compra nueva)
2. En n8n pulsa **Execute workflow**: debe llegar el WhatsApp y el pedido quedar con `aviso_equipo_enviado_at`.
3. Activa el flujo (*Active*).

## Cómo funciona el control de errores

- **Si llega al menos a una persona**, el pedido se marca como avisado. Si falló con otra, el motivo queda en `aviso_equipo_error` (con el nombre de quién falló).
- **Si no llega a nadie**, se suma un intento y se reintenta en la siguiente vuelta. A los **3 intentos** se rinde, para no insistirle a CallMeBot.
- Si el pedido aún no tiene productos guardados, espera a la siguiente vuelta sin gastar intentos.
- Si `DESTINATARIOS` sigue con los valores de ejemplo, el flujo falla a la vista en *Executions* en vez de descartar avisos en silencio.
- Si tu PC estuvo apagada, al volver avisa de los pedidos de las últimas **24 horas**; los más antiguos ya no se avisan.
- Cada vuelta procesa como máximo 5 pedidos.

**Ver qué pedidos no se pudieron avisar:**
```sql
select order_number, aviso_equipo_intentos, aviso_equipo_error, created_at
  from orders
 where aviso_equipo_enviado_at is null and aviso_equipo_error is not null
 order by created_at desc;
```

**Si cambiaste de apikey o número y quieres reintentar** (dentro de las 24 horas):
```sql
update orders set aviso_equipo_intentos = 0, aviso_equipo_error = null
 where aviso_equipo_enviado_at is null and created_at > now() - interval '24 hours';
```

## Notas técnicas

- El código envía con `this.helpers.httpRequest` dentro del nodo de código (no con un nodo HTTP aparte), para poder decidir por pedido si llegó a alguien. Si tu versión de n8n marcara que `this.helpers` no existe, avísame y lo paso a nodos separados.
- Pruebas: `node --test n8n/*.test.js`.
