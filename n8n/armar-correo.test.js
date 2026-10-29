// Ejecutar: node --test n8n/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("./armar-correo.js", import.meta.url), "utf8");
const correr = (json) => new Function("$input", src)({ first: () => ({ json }) });
const base = (extra = {}) => ({
  body: {
    pedido: { numero: "GM-1", nombre: "Ana Pérez", email: "ana@mail.com", subtotal: 1100, envio: 150, total: 1250, metodo_entrega: "domicilio", direccion: "Av. Larco 123", distrito: "Miraflores", entrega_estimada: "2026-11-05T05:00:00Z", requiere_cotizar_flete: false, ...extra },
    items: [{ titulo: "Sofá London", cantidad: 1, total: 1100 }],
    enlaces: { cliente_pedidos: "https://tienda.pe/perfil/pedidos" },
  },
});

test("domicilio: asunto, destinatario, montos y entrega estimada", () => {
  const [{ json }] = correr(base());
  assert.equal(json.to, "ana@mail.com");
  assert.equal(json.subject, "Recibimos tu pago · Pedido GM-1 — G&M Mueblería");
  assert.match(json.html, /Sofá London/);
  assert.match(json.html, /S\/ 1,250\.00/);
  assert.match(json.html, /Av\. Larco 123, Miraflores\. Entrega estimada: 5 de noviembre de 2026/);
  assert.match(json.html, /href="https:\/\/tienda\.pe\/perfil\/pedidos"/);
  assert.match(json.text, /Total pagado: S\/ 1,250\.00/);
});

test("provincia por cotizar: flete 'Por confirmar' y aviso de contacto", () => {
  const [{ json }] = correr(base({ requiere_cotizar_flete: true, envio: 0, provincia: "Arequipa", departamento: "Arequipa" }));
  assert.match(json.html, /Por confirmar/);
  assert.match(json.html, /confirmar el costo y la agencia de envío a Arequipa/);
});

test("recojo en tienda", () => {
  const [{ json }] = correr(base({ metodo_entrega: "recojo_tienda", envio: 0 }));
  assert.match(json.html, /Recojo sin costo/);
  assert.match(json.html, /listo para recoger/);
});

test("cupón: muestra el descuento", () => {
  const [{ json }] = correr(base({ descuento: 100, cupon: "BIENVENIDA" }));
  assert.match(json.html, /Descuento \(BIENVENIDA\)/);
  assert.match(json.html, /− S\/ 100\.00/);
});

test("escapa HTML del cliente y no deja saltos de línea en el asunto", () => {
  const [{ json }] = correr({
    body: { pedido: { numero: "GM-2\nBcc: x@y.com", nombre: "<script>alert(1)</script>", email: "a@b.com", total: 10 }, items: [{ titulo: "<img src=x onerror=1>", cantidad: 1, total: 10 }] },
  });
  assert.doesNotMatch(json.html, /<script>/);
  assert.doesNotMatch(json.html, /<img src=x/);
  assert.doesNotMatch(json.subject, /[\r\n]/);
});

test("sin correo válido no envía nada", () => {
  assert.deepEqual(correr(base({ email: "" })), []);
  assert.deepEqual(correr(base({ email: "no-es-correo" })), []);
  assert.deepEqual(correr(base({ email: "a@b.com, otro@c.com" })), []);
});
