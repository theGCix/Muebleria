// Pruebas de src/lib/escenaEspacio.ts. Ejecutar: node scripts/test-escena-espacio.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { quitarFondo, pxPorCm, anchoFraccion, piezaPrincipal, razonProporcion, ANCHO_POR_DEFECTO } from "../src/lib/escenaEspacio.ts";

/** Imagen w×h de un solo color de fondo con un rectángulo de otro color. */
function imagen(w, h, bg, rect, color) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dentro = rect && x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      const c = dentro ? color : bg;
      const i = (y * w + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  return d;
}

test("quita fondo blanco y recorta al mueble", () => {
  const d = imagen(100, 80, [255, 255, 255], { x: 20, y: 30, w: 50, h: 40 }, [120, 80, 50]);
  const r = quitarFondo(d, 100, 80);
  assert.equal(r.fondoQuitado, true);
  assert.equal(r.width, 50);
  assert.equal(r.height, 40);
  assert.ok(r.data[3] > 200, "el interior sigue opaco");
});

test("un hueco blanco DENTRO del mueble no se vuelve transparente (solo el fondo conectado al borde)", () => {
  const d = imagen(100, 80, [255, 255, 255], { x: 10, y: 10, w: 80, h: 60 }, [120, 80, 50]);
  // hueco blanco aislado en el centro
  for (let y = 35; y < 45; y++) for (let x = 45; x < 55; x++) { const i = (y * 100 + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; }
  const r = quitarFondo(d, 100, 80);
  const cx = 50 - 10, cy = 40 - 10; // en coordenadas del recorte
  assert.equal(r.data[(cy * r.width + cx) * 4 + 3], 255);
});

test("foto con ambiente (esquinas distintas) no se recorta", () => {
  const d = imagen(100, 80, [255, 255, 255], null, [0, 0, 0]);
  for (let y = 0; y < 80; y++) for (let x = 0; x < 50; x++) { const i = (y * 100 + x) * 4; d[i] = 30; d[i + 1] = 60; d[i + 2] = 200; }
  const r = quitarFondo(d, 100, 80);
  assert.equal(r.fondoQuitado, false);
  assert.equal(r.width, 100);
});

test("imagen toda de un color: no hay mueble", () => {
  const r = quitarFondo(imagen(60, 60, [250, 250, 250], null, [0, 0, 0]), 60, 60);
  assert.equal(r.fondoQuitado, false);
});

test("calibración: puerta de 210 cm marcada con 840 px de alto en foto 1000×1000", () => {
  const e = pxPorCm({ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.94 }, 1000, 1000, 210);
  assert.ok(Math.abs(e - 4) < 1e-9); // 840 px / 210 cm
  // sofá de 200 cm → 800 px → 80 % del ancho de la foto
  assert.ok(Math.abs(anchoFraccion(200, e, 1000) - 0.8) < 1e-9);
});

test("calibración rechaza puntos juntos y medidas inválidas", () => {
  assert.equal(pxPorCm({ x: 0.5, y: 0.5 }, { x: 0.505, y: 0.5 }, 1000, 1000, 210), null);
  assert.equal(pxPorCm({ x: 0, y: 0 }, { x: 1, y: 1 }, 1000, 1000, 0), null);
  assert.equal(pxPorCm({ x: 0, y: 0 }, { x: 1, y: 1 }, 1000, 1000, NaN), null);
});

test("sin calibrar o sin medida usa el ancho por defecto", () => {
  assert.equal(anchoFraccion(200, null, 1000), ANCHO_POR_DEFECTO);
  assert.equal(anchoFraccion(null, 4, 1000), ANCHO_POR_DEFECTO);
});

test("pieza principal = la más ancha; sin medidas → null", () => {
  const p = (nombre, ancho_cm) => ({ nombre, alto_cm: null, ancho_cm, fondo_cm: null, plazas: null });
  assert.equal(piezaPrincipal([p("A", 150), p("B", 210), p("C", null)]).nombre, "B");
  assert.equal(piezaPrincipal([p("A", null)]), null);
});

test("razón de proporción detecta fotos en ángulo", () => {
  assert.ok(Math.abs(razonProporcion(200, 85, 210, 89) - 1) < 0.05);
  assert.equal(razonProporcion(200, 85, null, 89), null);
});
