// Pruebas de src/lib/portada.ts. Ejecutar: node scripts/test-portada.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { elegirPiezaEscena, tramoInicial } from "../src/lib/portada.ts";

const p = (id, precioFinal, foto = "f.jpg") => ({ id, precioFinal, foto });
const hasta1500 = (n) => n <= 1500;
const entre = (n) => n > 1500 && n <= 2000;

test("elige la pieza de mayor precio dentro del tramo", () => {
  const lista = [p("a", 1000), p("b", 1485), p("c", 1700), p("d", 250)];
  assert.equal(elegirPiezaEscena(lista, hasta1500).id, "b");
  assert.equal(elegirPiezaEscena(lista, entre).id, "c");
});

test("ignora piezas sin foto, con precio inválido o fuera del tramo", () => {
  const lista = [p("sin-foto", 1490, null), p("vacia", 1480, ""), p("nan", NaN), p("cero", 0), p("ok", 900)];
  assert.equal(elegirPiezaEscena(lista, hasta1500).id, "ok");
});

test("sin candidatas devuelve null", () => {
  assert.equal(elegirPiezaEscena([], hasta1500), null);
  assert.equal(elegirPiezaEscena([p("x", 3200)], hasta1500), null);
});

test("empate de precio: gana la primera de la lista", () => {
  assert.equal(elegirPiezaEscena([p("primera", 1700), p("segunda", 1700)], entre).id, "primera");
});

test("el borde exacto respeta el criterio del tramo (1,500 cae en «hasta»)", () => {
  const lista = [p("borde", 1500)];
  assert.equal(elegirPiezaEscena(lista, hasta1500).id, "borde");
  assert.equal(elegirPiezaEscena(lista, entre), null);
});

test("tramoInicial: el del medio, o el último si hay menos de dos", () => {
  assert.equal(tramoInicial([{ id: "1" }, { id: "2" }, { id: "3" }]).id, "2");
  assert.equal(tramoInicial([{ id: "1" }, { id: "2" }]).id, "2");
  assert.equal(tramoInicial([{ id: "1" }]).id, "1");
  assert.equal(tramoInicial([]), null);
});

import { piezasPorTramo, moverIndice } from "../src/lib/portada.ts";

test("piezasPorTramo: una pieza por tramo, en el orden de los tramos, sin inventar", () => {
  const tramos = [
    { id: "a", min: null, max: 1500 },
    { id: "b", min: 1500, max: 2000 },
    { id: "c", min: 2000, max: null },
  ];
  const enTramo = (n, t) => (t.min == null || n > t.min) && (t.max == null || n <= t.max);
  const lista = [p("x", 1485), p("y", 1700), p("z", 1800), p("sin-foto", 2500, null)];
  const r = piezasPorTramo(lista, tramos, enTramo);
  assert.deepEqual(r.map((s) => [s.tramo.id, s.pieza.id]), [["a", "x"], ["b", "z"]]); // «c» solo tenía una pieza sin foto
  assert.deepEqual(piezasPorTramo([], tramos, enTramo), []);
});

test("moverIndice: da la vuelta y tolera 0 o 1 diapositivas", () => {
  assert.equal(moverIndice(0, 1, 3), 1);
  assert.equal(moverIndice(2, 1, 3), 0);
  assert.equal(moverIndice(0, -1, 3), 2);
  assert.equal(moverIndice(0, 1, 1), 0);
  assert.equal(moverIndice(0, -1, 0), 0);
});
