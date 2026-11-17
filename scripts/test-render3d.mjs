// Pruebas de las funciones del render 3D en src/lib/escenaEspacio.ts. Ejecutar: node --test scripts/test-render3d.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { limitesOpacos, pxPorCmRender, anchoProyectadoCm, anchoFraccion } from "../src/lib/escenaEspacio.ts";

function render(w, h, rect) {
  const d = new Uint8ClampedArray(w * h * 4); // todo transparente
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++) d[(y * w + x) * 4 + 3] = 255;
  return d;
}

test("límites de lo visible en un render transparente", () => {
  const d = render(100, 80, { x: 20, y: 30, w: 50, h: 40 });
  assert.deepEqual(limitesOpacos(d, 100, 80), { x: 20, y: 30, w: 50, h: 40 });
});

test("render vacío → null; el borde casi transparente se ignora", () => {
  assert.equal(limitesOpacos(new Uint8ClampedArray(10 * 10 * 4), 10, 10), null);
  const d = render(20, 20, { x: 5, y: 5, w: 4, h: 4 });
  d[(0 * 20 + 0) * 4 + 3] = 5; // ruido bajo el umbral
  assert.deepEqual(limitesOpacos(d, 20, 20), { x: 5, y: 5, w: 4, h: 4 });
});

test("escala: de frente mide el ancho real; girado, el ancho proyectado cambia", () => {
  const pxCm = pxPorCmRender(554, 277); // 2 px por cm
  assert.equal(pxCm, 2);
  assert.equal(anchoProyectadoCm(554, pxCm), 277);
  assert.equal(anchoProyectadoCm(418, pxCm), 209); // de lado: ≈ el fondo del conjunto
  assert.equal(pxPorCmRender(0, 277), null);
  assert.equal(pxPorCmRender(500, 0), null);
  assert.equal(anchoProyectadoCm(500, null), null);
});

test("con la foto calibrada, el conjunto ocupa su ancho real (277 cm)", () => {
  // foto de 1600 px donde 1 cm = 3 px → 277 cm = 831 px = 51.9 % del ancho
  const f = anchoFraccion(277, 3, 1600);
  assert.ok(Math.abs(f - 831 / 1600) < 1e-9);
});
