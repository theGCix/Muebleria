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

import {
  TAMANO_MIN, TAMANO_MAX, TAMANO_INICIAL, limitarTamano, limitarBrillo, normalizarGiro,
  tamanoPorPellizco, moverCentro, cajaDelMueble, ajustarAlEspacio,
} from "../src/lib/salaVirtual.ts";

test("tamaño: nunca desaparece ni tapa toda la foto; un valor inválido vuelve al inicial", () => {
  assert.equal(limitarTamano(0.01), TAMANO_MIN);
  assert.equal(limitarTamano(9), TAMANO_MAX);
  assert.equal(limitarTamano(NaN), TAMANO_INICIAL);
  assert.equal(limitarBrillo(0), 0.5);
  assert.equal(limitarBrillo(3), 1.5);
});

test("pellizco: el tamaño sigue la proporción de la distancia entre dedos, con tope", () => {
  assert.equal(tamanoPorPellizco(0.5, 100, 150), 0.75);
  assert.equal(tamanoPorPellizco(0.5, 100, 20), TAMANO_MIN);
  assert.equal(tamanoPorPellizco(0.5, 100, 900), TAMANO_MAX);
  assert.equal(tamanoPorPellizco(0.5, 0, 150), 0.5);          // distancia inicial inválida: no cambia
});

test("giro se normaliza a [0, 360)", () => {
  assert.equal(normalizarGiro(-30), 330);
  assert.equal(normalizarGiro(370), 10);
  assert.equal(normalizarGiro(NaN), 0);
});

test("mover: el centro se desplaza en fracción de la foto y no sale de ella", () => {
  assert.deepEqual(moverCentro({ x: 0.5, y: 0.5 }, 50, -25, 500, 250), { x: 0.6, y: 0.4 });
  assert.deepEqual(moverCentro({ x: 0.95, y: 0.02 }, 100, -100, 500, 250), { x: 1, y: 0 });
  assert.deepEqual(moverCentro({ x: 0.5, y: 0.5 }, 10, 10, 0, 250), { x: 0.5, y: 0.5 });
});

test("caja del mueble: cuadrada, centrada en el punto y proporcional al ancho del escenario", () => {
  const c = cajaDelMueble({ x: 0.5, y: 0.6 }, 0.5, 400, 300);
  assert.equal(c.lado, 200);
  assert.equal(c.left, 100);
  assert.equal(c.top, 80);
});

test("ajustarAlEspacio conserva la proporción de la foto", () => {
  assert.deepEqual(ajustarAlEspacio(1600, 1200, 800, 800), { w: 800, h: 600 });
  assert.deepEqual(ajustarAlEspacio(1200, 1600, 800, 800), { w: 600, h: 800 });
  assert.deepEqual(ajustarAlEspacio(0, 10, 800, 800), { w: 0, h: 0 });
});
