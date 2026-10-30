// Ejecutar: node --test n8n/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("./armar-correo-carrito.js", import.meta.url), "utf8");
const correr = (...filas) => new Function("$input", src)({ all: () => filas.map((json) => ({ json })) }).map((x) => x.json);
const hace = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const fila = (extra = {}) => ({
  id: "a1b2c3d4-0000-4000-8000-000000000000", nombre: "Ana Pérez", email: "ana@mail.com", estado: "activo",
  last_activity_at: hace(2), recordatorio_1_at: null, recordatorio_2_at: null,
  items: [{ id: "p1", title: "Sofá London", price: 1100, qty: 1, image: "https://res.cloudinary.com/x/a.jpg" }], ...extra,
});

test("2 h sin actividad y sin avisos → paso 1, sin cupón", () => {
  const [r] = correr(fila());
  assert.equal(r.enviar, true);
  assert.equal(r.paso, 1);
  assert.equal(r.to, "ana@mail.com");
  assert.equal(r.cupon, null);
  assert.match(r.html, /Sofá London/);
  assert.match(r.html, /S\/ 1,100\.00/);
  assert.match(r.html, /utm_content=paso1/);
  assert.deepEqual(Object.keys(r.marca).sort(), ["estado", "recordatorio_1_at", "recordatorio_enviado"]);
});

test("menos de 1 h sin actividad → no sale nada", () => {
  assert.deepEqual(correr(fila({ last_activity_at: hace(0.5) })), []);
});

test("paso 2: 30 h sin actividad, aviso 1 hace 20 h → cupón VUELVE-XXXXXXXX", () => {
  const [r] = correr(fila({ last_activity_at: hace(30), recordatorio_1_at: hace(20) }));
  assert.equal(r.paso, 2);
  assert.equal(r.cupon.codigo, "VUELVE-A1B2C3D4");
  assert.equal(r.cupon.origen, "carrito_abandonado");
  assert.match(r.html, /VUELVE-A1B2C3D4/);
  assert.ok(r.marca.recordatorio_2_at);
  assert.ok(new Date(r.cupon.vence_el) > new Date());
});

test("paso 2 no sale pegado al paso 1 ni antes de 24 h de inactividad", () => {
  assert.deepEqual(correr(fila({ last_activity_at: hace(30), recordatorio_1_at: hace(2) })), []);
  assert.deepEqual(correr(fila({ last_activity_at: hace(10), recordatorio_1_at: hace(9) })), []);
});

test("ya tuvo los 2 avisos → nada", () => {
  assert.deepEqual(correr(fila({ last_activity_at: hace(60), recordatorio_1_at: hace(50), recordatorio_2_at: hace(30) })), []);
});

test("sin correo válido o sin productos → enviar:false y se cierra el seguimiento", () => {
  for (const extra of [{ email: "no-es-correo" }, { items: [] }, { items: null }]) {
    const [r] = correr(fila(extra));
    assert.equal(r.enviar, false);
    assert.ok(r.marca.recordatorio_1_at && r.marca.recordatorio_2_at);
  }
});

test("el HTML escapa lo que escribe el cliente", () => {
  const [r] = correr(fila({ nombre: "<b>Ana</b>", items: [{ id: "p", title: "<script>x</script>", price: 10, qty: 1 }] }));
  assert.ok(!r.html.includes("<script>"));
  assert.ok(!r.html.includes("<b>Ana"));
});
