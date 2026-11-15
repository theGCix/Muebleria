// Pruebas de src/lib/armadorPresupuesto.ts. Ejecutar: node scripts/test-armador-presupuesto.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import {
  limitesSlider,
  valorInicial,
  piezasQueAlcanzan,
  textoPiezas,
  textoOpciones,
} from "../src/lib/armadorPresupuesto.ts";

const PRECIOS = [250, 1000, 1100, 1485, 1504, 1700, 1700, 1800, 1900, 2100, 2200, 2250, 2280, 2300, 2300, 2425, 3200];

test("límites: ambos hacia arriba al paso (en todo tope alcanza al menos la pieza más barata)", () => {
  assert.deepEqual(limitesSlider(PRECIOS), { min: 300, max: 3200, paso: 100 });
  assert.deepEqual(limitesSlider([1485, 1504]), { min: 1500, max: 1600, paso: 100 });
});

test("límites: ignora precios no válidos y devuelve null sin datos", () => {
  assert.equal(limitesSlider([]), null);
  assert.equal(limitesSlider([0, NaN, -3]), null);
  assert.deepEqual(limitesSlider([0, 1200]), { min: 1200, max: 1300, paso: 100 });
});

test("valor inicial: el preferido dentro de los límites y ajustado al paso", () => {
  const l = { min: 200, max: 3200, paso: 100 };
  assert.equal(valorInicial(l, 2000), 2000);
  assert.equal(valorInicial(l, 2049), 2000);
  assert.equal(valorInicial(l, 9999), 3200);
  assert.equal(valorInicial(l, 10), 200);
  assert.equal(valorInicial(l, null), 1700);
});

test("piezas que alcanzan: conteo, «desde» y las 3 mejores con foto", () => {
  const piezas = PRECIOS.map((n, i) => ({ id: i, precioFinal: n, foto: n === 1900 ? null : "f.jpg" }));
  const a = piezasQueAlcanzan(piezas, 2000);
  assert.equal(a.total, 9); // 250 · 1000 · 1100 · 1485 · 1504 · 1700 · 1700 · 1800 · 1900
  assert.equal(a.desde, 250);
  assert.deepEqual(a.vista.map((p) => p.precioFinal), [1800, 1700, 1700]); // 1900 no tiene foto
});

test("el tope es inclusivo y sin piezas no hay «desde»", () => {
  const piezas = [{ precioFinal: 1500, foto: "f.jpg" }];
  assert.equal(piezasQueAlcanzan(piezas, 1500).total, 1);
  const nada = piezasQueAlcanzan(piezas, 1499);
  assert.equal(nada.total, 0);
  assert.equal(nada.desde, null);
  assert.deepEqual(nada.vista, []);
});

test("textos", () => {
  assert.equal(textoPiezas(1), "1 pieza");
  assert.equal(textoPiezas(5), "5 piezas");
  assert.equal(textoOpciones(5), "Ver mis 5 opciones");
  assert.equal(textoOpciones(1), "Ver mi opción");
  assert.equal(textoOpciones(0), null);
});
