// Ejecutar: node --test server/
import { test } from "node:test";
import assert from "node:assert/strict";
import { enlacesPorTexto, enlacesPorHallazgos, enlacesDeTurno } from "./chatNavegacion.js";

const tos = (links) => links.map((l) => l.to);

test("envíos y plazos llevan a /envios (plural y tildes)", () => {
  assert.deepEqual(tos(enlacesPorTexto("¿Cuánto demora la ENTREGA?")), ["/envios"]);
  assert.deepEqual(tos(enlacesPorTexto("hacen envíos a provincia")), ["/envios"]);
});

test("garantía y reclamos llevan a /terminos", () => {
  assert.equal(enlacesPorTexto("Quiero hacer un reclamo")[0].to, "/terminos");
  assert.equal(enlacesPorTexto("¿qué garantía tienen?")[0].to, "/terminos");
});

test("a medida lleva al formulario del home con ancla", () => {
  const [l] = enlacesPorTexto("quiero cotizar un mueble a medida");
  assert.equal(l.to, "/");
  assert.equal(l.hash, "a-medida");
});

test("categorías: sofás → muebles/sala, comedor → comedores, mesa de centro → accesorios", () => {
  const sofa = enlacesPorTexto("busco sofás")[0];
  assert.equal(sofa.params.slug, "muebles");
  assert.equal(sofa.search.sub, "sala");
  assert.equal(enlacesPorTexto("quiero un comedor de 6 sillas")[0].params.slug, "comedores");
  const mesa = enlacesPorTexto("mesas de centro")[0];
  assert.equal(mesa.params.slug, "accesorios");
  assert.equal(mesa.search.sub, "mesas-centro");
});

test("'banco' (entidad) no dispara puffs y bancos", () => {
  assert.deepEqual(enlacesPorTexto("pago con mi banco"), []);
});

test("texto sin intención o vacío → sin enlaces", () => {
  assert.deepEqual(enlacesPorTexto("hola"), []);
  assert.deepEqual(enlacesPorTexto(""), []);
  assert.deepEqual(enlacesPorTexto(undefined), []);
});

test("hallazgos: producto → /product/$handle con el id; pedido y carrito", () => {
  const links = enlacesPorHallazgos({
    productos: [{ id: "abc-123", nombre: "Sofá London de tres cuerpos en tela premium" }],
    pedido: true,
    carrito: true,
  });
  assert.equal(links[0].to, "/product/$handle");
  assert.equal(links[0].params.handle, "abc-123");
  assert.ok(links[0].label.length <= 44);
  assert.deepEqual(tos(links).slice(1), ["/checkout", "/perfil/pedidos"]);
});

test("turno: lo concreto primero, sin duplicados y máximo 3", () => {
  const links = enlacesDeTurno({
    texto: "¿cuánto cuesta el envío de un sofá? y la garantía?",
    hallazgos: {
      productos: [{ id: "1", nombre: "A" }, { id: "2", nombre: "B" }],
      envio: true,
    },
  });
  assert.equal(links.length, 3);
  assert.equal(links[0].params.handle, "1");
  assert.equal(links[1].params.handle, "2");
  assert.equal(links[2].to, "/envios");
});
