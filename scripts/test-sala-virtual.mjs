// Pruebas de src/lib/salaVirtual.ts. Ejecutar: node --test scripts/test-sala-virtual.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { AMBIENTES, VISTAS_CAMARA, metrosACm, puntosDeMedida } from "../src/lib/salaVirtual.ts";

test("metrosACm redondea a centímetros enteros", () => {
  assert.equal(metrosACm(2.774), 277);
  assert.equal(metrosACm(0.82), 82);
});

test("puntosDeMedida usa las dimensiones del modelo y ubica los puntos en su caja", () => {
  const p = puntosDeMedida({ x: 0, y: 0.41, z: 0 }, { x: 2.77, y: 0.82, z: 2.09 });
  assert.deepEqual(p.map((x) => x.etiqueta), ["Ancho 277 cm", "Fondo 209 cm", "Alto 82 cm"]);
  assert.equal(p[0].posicion, "0m 0m 1.045m");     // ancho: centro en X, base, borde frontal
  assert.equal(p[1].posicion, "1.385m 0m 0m");     // fondo: borde lateral, base, centro en Z
  assert.equal(p[2].posicion, "1.385m 0.41m 1.045m");
});

test("tamaños inválidos no producen medidas", () => {
  assert.deepEqual(puntosDeMedida({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 1 }), []);
  assert.deepEqual(puntosDeMedida({ x: NaN, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }), []);
});

test("ambientes y vistas: ids únicos, exposición y sombra positivas, paleta sin colores prohibidos", () => {
  assert.equal(new Set(AMBIENTES.map((a) => a.id)).size, AMBIENTES.length);
  assert.equal(new Set(VISTAS_CAMARA.map((v) => v.id)).size, VISTAS_CAMARA.length);
  for (const a of AMBIENTES) { assert.ok(a.exposicion > 0 && a.sombra > 0); assert.match(a.fondo, /^linear-gradient/); }
});
