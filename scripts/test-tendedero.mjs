// Pruebas de src/lib/tendedero.ts. Ejecutar: node scripts/test-tendedero.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { caida, disposicionPC, DISPOSICION_MOVIL, anguloInclinacion, paramsPendulo, pasoPendulo } from "../src/lib/tendedero.ts";

test("la cuerda baja 0 en los extremos y `sag` en el centro", () => {
  assert.equal(caida(0, 10), 0);
  assert.equal(caida(1, 10), 0);
  assert.equal(caida(0.5, 10), 10);
});

test("PC: huecos según la cantidad de piezas, dentro de la cuerda y sin montarse", () => {
  assert.equal(disposicionPC(0).length, 0);
  for (const n of [1, 2, 3, 5]) {
    const h = disposicionPC(n);
    assert.equal(h.length, Math.min(n, 3));
    h.forEach((x) => assert.ok(x.x >= 0 && x.x + x.w <= 1));
    for (let i = 1; i < h.length; i++) assert.ok(h[i].x - (h[i - 1].x + h[i - 1].w) >= 0.11 - 1e-9, "≥ 11 % de aire");
  }
});

test("móvil: dos disposiciones dentro de la cuerda", () => {
  assert.equal(DISPOSICION_MOVIL.length, 2);
  DISPOSICION_MOVIL.forEach((x) => assert.ok(x.x + x.w <= 1));
});

test("inclinación: contraria al celular, solo en vertical, con tope", () => {
  assert.equal(anguloInclinacion(20, 0), -10);
  assert.equal(anguloInclinacion(20, 180), 10);
  assert.equal(anguloInclinacion(20, 90), 0);
  assert.equal(anguloInclinacion(90, 0), -18);
  assert.equal(anguloInclinacion(null, 0), 0);
  assert.equal(anguloInclinacion(NaN, 0), 0);
});

test("péndulo: converge a 0 sin objetivo y respeta el límite", () => {
  const p = paramsPendulo(0, true);
  const e = { a: 15, v: 0 };
  for (let i = 0; i < 60 * 12; i++) pasoPendulo(e, p, 0, i / 60, 1 / 60);
  assert.ok(Math.abs(e.a) < 2);
  const f = { a: 0, v: 5000 };
  pasoPendulo(f, p, 0, 0, 1 / 60);
  assert.ok(Math.abs(f.a) <= p.lim);
});

test("PC: las tres piezas casi iguales (al unísono); móvil: cada una a su ritmo", () => {
  const pc = [0, 1, 2].map((i) => paramsPendulo(i, true));
  assert.ok(Math.max(...pc.map((x) => x.k)) - Math.min(...pc.map((x) => x.k)) <= 2);
  assert.ok(pc.every((x) => x.lim === 18));
  assert.notEqual(paramsPendulo(0, false).k, paramsPendulo(1, false).k);
});

test("péndulo: sigue un objetivo constante", () => {
  const p = paramsPendulo(1, true);
  const e = { a: 0, v: 0 };
  for (let i = 0; i < 60 * 10; i++) pasoPendulo(e, p, 10, 0, 1 / 60);
  assert.ok(e.a > 8 && e.a <= 18);
});
