// Ejecutar: node --test n8n/*.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("./avisar-equipo-pedido.js", import.meta.url), "utf8");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const GIAN = { nombre: "Gian", telefono: "+51987654321", apikey: "KEY1" };
const OTRA = { nombre: "Rosa", telefono: "+51911111111", apikey: "KEY2" };

// Corre el código del nodo con destinatarios de prueba y un httpRequest simulado.
async function correr(pedidos, { destinatarios = [GIAN], http } = {}) {
  const llamadas = [];
  const httpRequest = async (opts) => {
    llamadas.push(opts);
    return http ? http(opts) : { statusCode: 200, body: "Message queued. You will receive it in a few seconds." };
  };
  const codigo = src.replace(/const DESTINATARIOS = \[[\s\S]*?\n\];/, `const DESTINATARIOS = ${JSON.stringify(destinatarios)};`);
  const fn = new AsyncFunction("$input", codigo);
  const out = await fn.call({ helpers: { httpRequest } }, { all: () => pedidos.map((json) => ({ json })) });
  return { salida: out.map((x) => x.json), llamadas };
}

const pedido = (extra = {}) => ({
  id: "uuid-1", order_number: "GM-1042", nombre: "Ana Pérez", telefono: "999111222",
  total: 1250, envio: 150, metodo_entrega: "domicilio", distrito: "Miraflores", envio_estado: null,
  notas: "", aviso_equipo_intentos: 0, order_items: [{ title: "Sofá London", qty: 1, total: 1100 }], ...extra,
});

test("pedido normal → un WhatsApp con número, cliente, total y producto", async () => {
  const { salida, llamadas } = await correr([pedido()]);
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].qs.phone, "+51987654321");
  assert.equal(llamadas[0].qs.apikey, "KEY1");
  const t = llamadas[0].qs.text;
  assert.match(t, /Pedido pagado GM-1042/);
  assert.match(t, /Ana Pérez · 999111222/);
  assert.match(t, /S\/ 1,250\.00 \(envío S\/ 150\.00\)/);
  assert.match(t, /1× Sofá London/);
  assert.match(t, /Domicilio: Miraflores/);
  assert.match(t, /\/pedidos$/);
  assert.deepEqual(salida, [{ order_id: "uuid-1", enviado: true, intentos_siguiente: 1, error: null }]);
});

test("provincia con flete por cotizar → avisa que falta cotizar", async () => {
  const { llamadas } = await correr([pedido({ envio_estado: "por_cotizar", provincia: "Arequipa", envio: 0 })]);
  const t = llamadas[0].qs.text;
  assert.match(t, /PROVINCIA \(Arequipa\)/);
  assert.match(t, /falta cotizar el flete/);
  assert.match(t, /flete por confirmar/);
});

test("recojo en tienda → sin costo de envío", async () => {
  const { llamadas } = await correr([pedido({ metodo_entrega: "recojo_tienda", envio: 0 })]);
  assert.match(llamadas[0].qs.text, /recojo sin costo/);
  assert.match(llamadas[0].qs.text, /Recojo en tienda/);
});

test("muchos productos → se resumen y el texto se mantiene corto", async () => {
  const items = Array.from({ length: 7 }, (_, i) => ({ title: "Mueble con un nombre bastante largo número " + i + " de la colección", qty: 2, total: 100 }));
  const { llamadas } = await correr([pedido({ order_items: items, notas: "x".repeat(500) })]);
  const t = llamadas[0].qs.text;
  assert.match(t, /y 3 más/);
  assert.ok(t.length < 700, `texto de ${t.length} caracteres`);
});

test("dos destinatarios → un envío para cada uno", async () => {
  const { salida, llamadas } = await correr([pedido()], { destinatarios: [GIAN, OTRA] });
  assert.deepEqual(llamadas.map((l) => l.qs.apikey), ["KEY1", "KEY2"]);
  assert.equal(salida[0].enviado, true);
});

test("falla uno de dos → se marca como avisado y el error dice quién falló", async () => {
  const http = (o) => (o.qs.apikey === "KEY2" ? { statusCode: 401, body: "APIKey is invalid" } : { statusCode: 200, body: "Message queued." });
  const { salida } = await correr([pedido()], { destinatarios: [GIAN, OTRA], http });
  assert.equal(salida[0].enviado, true);
  assert.match(salida[0].error, /Rosa: 401/);
});

test("falla para todos (o httpRequest lanza) → no se marca y suma un intento", async () => {
  const lanza = () => { throw new Error("socket hang up"); };
  const a = await correr([pedido({ aviso_equipo_intentos: 1 })], { http: lanza });
  assert.equal(a.salida[0].enviado, false);
  assert.equal(a.salida[0].intentos_siguiente, 2);
  assert.match(a.salida[0].error, /socket hang up/);
  const b = await correr([pedido()], { http: () => ({ statusCode: 200, body: "ERROR: phone not registered" }) });
  assert.equal(b.salida[0].enviado, false);
});

test("pedido sin productos aún → se salta sin enviar ni gastar intentos", async () => {
  const { salida, llamadas } = await correr([pedido({ order_items: [] })]);
  assert.deepEqual(salida, []);
  assert.equal(llamadas.length, 0);
});

test("sin destinatarios configurados → falla a la vista; sin pedidos pendientes no molesta", async () => {
  await assert.rejects(correr([pedido()], { destinatarios: [{ nombre: "Gian", telefono: "+51999999999", apikey: "PEGA_AQUI_TU_APIKEY" }] }), /Configura DESTINATARIOS/);
  await assert.rejects(correr([pedido()], { destinatarios: [{ nombre: "Gian", telefono: "987654321", apikey: "K" }] }), /Configura DESTINATARIOS/);
  const vacio = await correr([], { destinatarios: [] });
  assert.deepEqual(vacio.salida, []);
});

test("varios pedidos → una salida por pedido, en orden", async () => {
  const { salida } = await correr([pedido({ id: "a" }), pedido({ id: "b", order_items: [] }), pedido({ id: "c" })]);
  assert.deepEqual(salida.map((s) => s.order_id), ["a", "c"]);
});
