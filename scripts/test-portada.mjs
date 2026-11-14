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
