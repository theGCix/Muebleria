// Ejecutar: node --test n8n/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("./armar-correo-polling.js", import.meta.url), "utf8");
const correr = (...filas) => new Function("$input", src)({ all: () => filas.map((json) => ({ json })) }).map((x) => x.json);
const fila = (extra = {}) => ({
  id: "uuid-1", order_number: "GM-1", nombre: "Ana Pérez", email: "ana@mail.com", subtotal: 1100, envio: 150, total: 1250,
  metodo_entrega: "domicilio", direccion: "Av. Larco 123", distrito: "Miraflores", estimated_delivery: "2026-11-05T05:00:00Z",
  envio_estado: null, order_items: [{ title: "Sofá London", qty: 1, total: 1100 }], ...extra,
});

test("pedido con productos → correo listo con order_id", () => {
  const [r] = correr(fila());
  assert.equal(r.enviar, true);
  assert.equal(r.order_id, "uuid-1");
  assert.equal(r.to, "ana@mail.com");
  assert.match(r.subject, /Pedido GM-1/);
  assert.match(r.html, /Sofá London/);
  assert.match(r.html, /S\/ 1,250\.00/);
});

test("sin productos aún → no sale nada (se reintenta luego)", () => {
  assert.deepEqual(correr(fila({ order_items: [] })), []);
  assert.deepEqual(correr(fila({ order_items: null })), []);
});

test("sin correo válido → enviar:false (solo se marca)", () => {
  const [r] = correr(fila({ email: "" }));
  assert.deepEqual(r, { order_id: "uuid-1", enviar: false });
});

test("provincia por cotizar y recojo", () => {
  const [a] = correr(fila({ envio_estado: "por_cotizar", envio: 0, provincia: "Arequipa" }));
  assert.match(a.html, /Por confirmar/);
  const [b] = correr(fila({ metodo_entrega: "recojo_tienda", envio: 0 }));
  assert.match(b.html, /Recojo sin costo/);
});

test("varios pedidos → un resultado por pedido; HTML del cliente escapado", () => {
  const r = correr(fila(), fila({ id: "uuid-2", order_number: "GM-2", nombre: "<b>x</b>" }));
  assert.equal(r.length, 2);
  assert.doesNotMatch(r[1].html, /<b>x<\/b>/);
});
