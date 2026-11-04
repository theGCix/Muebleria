// Ejecutar: node --test n8n/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("./armar-correo-notificaciones.js", import.meta.url), "utf8");
const correr = (...filas) => new Function("$input", src)({ all: () => filas.map((json) => ({ json })) }).map((x) => x.json);
const fila = (extra = {}) => ({
  id: "n-1", order_id: "o-1", destinatario_email: "ana@mail.com", destinatario_nombre: "Ana Pérez",
  tipo: "solicitud_resena", canal: "email", asunto: "¿Cómo te fue con tu pedido GM-1?",
  mensaje: "Hola Ana 👋\nCuéntanos tu experiencia.", intentos: 0, ...extra,
});

test("notificación con mensaje → correo listo con el mismo asunto y texto", () => {
  const [r] = correr(fila());
  assert.equal(r.enviar, true);
  assert.equal(r.id, "n-1");
  assert.equal(r.to, "ana@mail.com");
  assert.equal(r.from, "G&M Mueblería <proyectomuebleria1@gmail.com>");
  assert.equal(r.subject, "¿Cómo te fue con tu pedido GM-1?");
  assert.match(r.html, /Cuéntanos tu experiencia/);
  assert.equal(r.intentos_siguiente, 1);
});

test("cambio de estado sin mensaje ni asunto → usa el texto por tipo", () => {
  const [r] = correr(fila({ tipo: "control_calidad", asunto: null, mensaje: null }));
  assert.equal(r.enviar, true);
  assert.match(r.subject, /calidad/i);
  assert.match(r.text, /^Hola Ana,/);
  assert.match(r.text, /control de calidad/);
  assert.match(r.html, /Ver mi pedido/);
});

test("tipo desconocido sin mensaje → texto genérico, sin botón", () => {
  const [r] = correr(fila({ tipo: "otro", asunto: null, mensaje: null }));
  assert.equal(r.enviar, true);
  assert.match(r.text, /ha cambiado de estado/);
  assert.doesNotMatch(r.html, /display:inline-block/);
});

test("sin correo válido → no se envía y se deja de reintentar", () => {
  for (const email of [null, "", "no-es-correo", "a@b", "a@b.com, c@d.com"]) {
    const [r] = correr(fila({ destinatario_email: email, intentos: 1 }));
    assert.equal(r.enviar, false);
    assert.equal(r.intentos_siguiente, 5);
  }
});

test("el contenido del cliente se escapa (no entra HTML)", () => {
  const [r] = correr(fila({ mensaje: "<script>alert(1)</script> & \"hola\"", destinatario_nombre: "<b>x</b>" }));
  assert.doesNotMatch(r.html, /<script>/);
  assert.match(r.html, /&lt;script&gt;/);
});

test("enlaces del mensaje son clicables y no arrastran la puntuación final", () => {
  const [r] = correr(fila({ mensaje: "Mira tu pedido en https://muebleria-q74c.onrender.com/perfil/pedidos." }));
  assert.match(r.html, /<a href="https:\/\/muebleria-q74c\.onrender\.com\/perfil\/pedidos"[^>]*>[^<]*<\/a>\./);
});

test("el asunto no puede traer saltos de línea", () => {
  const [r] = correr(fila({ asunto: "Hola\r\nBcc: x@y.com" }));
  assert.doesNotMatch(r.subject, /[\r\n]/);
});

test("botón de reseña lleva al pedido; el contador de intentos sube", () => {
  const [r] = correr(fila({ intentos: 2 }));
  assert.match(r.html, /https:\/\/muebleria-q74c\.onrender\.com\/resena\/o-1/);
  assert.equal(r.intentos_siguiente, 3);
});

test("varias filas → una salida por fila, en el mismo orden", () => {
  const out = correr(fila({ id: "a" }), fila({ id: "b", destinatario_email: null }), fila({ id: "c" }));
  assert.deepEqual(out.map((x) => [x.id, x.enviar]), [["a", true], ["b", false], ["c", true]]);
});
