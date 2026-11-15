// Pruebas de src/lib/seccionesHome.ts. Ejecutar: node scripts/test-secciones-home.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { topOfertas, textoPiezasConDescuento, pasosTallerHome } from "../src/lib/seccionesHome.ts";

test("topOfertas: mayor descuento primero, empate por precio, ignora sin descuento", () => {
  const o = [
    { id: "a", descuento: 20, precioFinal: 900 },
    { id: "b", descuento: 30, precioFinal: 2280 },
    { id: "c", descuento: 30, precioFinal: 1504 },
    { id: "d", descuento: 0, precioFinal: 100 },
    { id: "e", descuento: 10, precioFinal: 500 },
  ];
  assert.deepEqual(topOfertas(o, 3).map((x) => x.id), ["c", "b", "a"]);
  assert.deepEqual(topOfertas(o, 0), []);
  assert.equal(o.length, 5, "no muta la entrada");
});

test("texto de conteo en singular y plural", () => {
  assert.equal(textoPiezasConDescuento(1), "1 pieza con descuento");
  assert.equal(textoPiezasConDescuento(5), "5 piezas con descuento");
});

const REALES = [
  { id: "corte", titulo: "Selección y corte de la madera", descripcion: "madera tornillo seca y tratada." },
  { id: "lijado", titulo: "Lijado", descripcion: "lija 120 y 220." },
  { id: "armado", titulo: "Armado de la estructura", descripcion: "escuadra y nivel." },
  { id: "acabado", titulo: "Sellado y acabado", descripcion: "sellador y barniz." },
  { id: "calidad", titulo: "Control de calidad", descripcion: "revisión." },
  { id: "embalaje", titulo: "Embalaje y despacho", descripcion: "film stretch." },
];

test("pasos del taller: 4 pasos del boceto numerados, con texto de los pasos reales", () => {
  const p = pasosTallerHome(REALES);
  assert.deepEqual(p.map((x) => [x.n, x.titulo, x.sub]), [
    [1, "Madera tornillo", "Selección"],
    [2, "Armado", "y lijado"],
    [3, "Barniz", "y acabado"],
    [4, "Entrega", "a tu casa"],
  ]);
  assert.match(p[1].descripcion, /Lijado.*Armado de la estructura/);
});

test("pasos del taller: si falta un paso real, no se muestra ni se inventa", () => {
  const sin = REALES.filter((r) => r.id !== "lijado");
  const p = pasosTallerHome(sin);
  assert.deepEqual(p.map((x) => x.titulo), ["Madera tornillo", "Barniz", "Entrega"]);
  assert.deepEqual(p.map((x) => x.n), [1, 2, 3]);
  assert.deepEqual(pasosTallerHome([]), []);
});
