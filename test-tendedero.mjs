// Pruebas de src/lib/tendedero.ts. Ejecutar: node scripts/test-tendedero.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import {
  caida,
  disposicionPC,
  DISPOSICION_MOVIL,
  anguloInclinacion,
  paramsPendulo,
  pasoPendulo,
} from "../src/lib/tendedero.ts";

test("caida: 0 en los extremos y máxima en el centro", () => {
  assert.equal(caida(0, 10), 0);
  assert.equal(caida(1, 10), 0);
  assert.equal(caida(0.5, 10), 10);
  assert.ok(caida(0.25, 10) < caida(0.5, 10));
});

test("disposicionPC: tamaño según la cantidad y sin solaparse", () => {
  assert.equal(disposicionPC(0).length, 0);
  assert.equal(disposicionPC(1).length, 1);
  assert.equal(disposicionPC(2).length, 2);
  assert.equal(disposicionPC(5).length, 3);
  for (const n of [1, 2, 3]) {
    const h = disposicionPC(n);
    for (let i = 0; i < h.length; i++) {
      assert.ok(h[i].x >= 0 && h[i].x + h[i].w <= 1, "cabe en la cuerda");
      if (i > 0) assert.ok(h[i].x - (h[i - 1].x + h[i - 1].w) >= 0.1, "al menos 10 % de aire");
    }
  }
});

test("disposicionMovil: una pieza por cuerda, dentro de la cuerda", () => {
  assert.equal(DISPOSICION_MOVIL.length, 2);
  for (const h of DISPOSICION_MOVIL) assert.ok(h.x >= 0 && h.x + h.w <= 1);
});

test("anguloInclinacion: sentido contrario, límite y orientaciones", () => {
  assert.equal(anguloInclinacion(20, 0), -10);
  assert.equal(anguloInclinacion(-20, 0), 10);
  assert.equal(anguloInclinacion(80, 0), -18);
  assert.equal(anguloInclinacion(-80, 0), 18);
  assert.equal(anguloInclinacion(20, 180), 10);
  assert.equal(anguloInclinacion(20, 90), 0);
  assert.equal(anguloInclinacion(20, 270), 0);
  assert.equal(anguloInclinacion(20, -90), 0);
  assert.equal(anguloInclinacion(null, 0), 0);
  assert.equal(anguloInclinacion(Number.NaN, 0), 0);
  assert.equal(anguloInclinacion(0, 0), 0);
});

function simular(pc, n, segundos, fuerza) {
  const par = Array.from({ length: n }, (_, i) => paramsPendulo(i, pc));
  const est = Array.from({ length: n }, (_, i) => ({ a: i % 2 ? 1.5 : -1.5, v: 0 }));
  est.forEach((e, i) => (e.v += fuerza * par[i].s * par[i].g));
  const dt = 1 / 60;
  let maxAng = 0;
  let maxDif = 0;
  for (let t = 0; t < segundos; t += dt) {
    est.forEach((e, i) => pasoPendulo(e, par[i], 0, t, dt));
    for (let i = 0; i < n; i++) maxAng = Math.max(maxAng, Math.abs(est[i].a));
    for (let i = 1; i < n; i++) maxDif = Math.max(maxDif, Math.abs(est[i].a - est[i - 1].a));
  }
  return { maxAng, maxDif, est };
}

test("péndulo: se mantiene dentro del límite y se calma cerca del reposo", () => {
  const pc = simular(true, 3, 12, 140);
  assert.ok(pc.maxAng <= 18);
  for (const e of pc.est) assert.ok(Math.abs(e.a) < 3, "vuelve cerca de la vertical");
  const mv = simular(false, 2, 12, 140);
  assert.ok(mv.maxAng <= 40);
});

test("péndulo PC: las tres piezas se mueven casi al unísono (no se cruzan)", () => {
  const { maxDif } = simular(true, 3, 8, 140);
  assert.ok(maxDif < 6, `diferencia máxima entre vecinas: ${maxDif.toFixed(2)}°`);
});

test("péndulo: sigue la inclinación (objetivo) y respeta la sensibilidad", () => {
  const par = paramsPendulo(0, true);
  const e = { a: 0, v: 0 };
  for (let t = 0; t < 10; t += 1 / 60) pasoPendulo(e, par, 10, t, 1 / 60);
  assert.ok(e.a > 6 && e.a <= 18, `ángulo final ${e.a.toFixed(2)}°`);
});
