// Pruebas de src/lib/portadaCarrusel.ts. Ejecutar: node scripts/test-portada-carrusel.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import {
  diapositivasActivas,
  diasRestantes,
  textoTermina,
  precioMinimo,
  montoCorto,
  siguiente,
} from "../src/lib/portadaCarrusel.ts";

test("con campaña hay 4 diapositivas; sin campaña, 3 sin «locura»", () => {
  assert.deepEqual(diapositivasActivas(true), ["locura", "salas", "medida", "pruebalo"]);
  assert.deepEqual(diapositivasActivas(false), ["salas", "medida", "pruebalo"]);
});

test("días restantes: redondea hacia arriba y null si venció o no hay fecha", () => {
  const ahora = 1_000_000_000;
  assert.equal(diasRestantes(ahora + 13 * 86_400_000, ahora), 13);
  assert.equal(diasRestantes(ahora + 12.2 * 86_400_000, ahora), 13);
  assert.equal(diasRestantes(ahora - 1, ahora), null);
  assert.equal(diasRestantes(null, ahora), null);
});

test("texto «TERMINA…»", () => {
  assert.equal(textoTermina(13), "TERMINA EN 13 DÍAS");
  assert.equal(textoTermina(2), "TERMINA EN 2 DÍAS");
  assert.equal(textoTermina(1), "TERMINA HOY");
  assert.equal(textoTermina(null), null);
});

test("precio mínimo ignora valores no válidos", () => {
  assert.equal(precioMinimo([2250, 1504, 0, NaN, -5, 1485.5]), 1485.5);
  assert.equal(precioMinimo([]), null);
  assert.equal(precioMinimo([0, NaN]), null);
});

test("monto corto", () => {
  assert.equal(montoCorto(1504), "S/ 1,504");
  assert.equal(montoCorto(1504.5), "S/ 1,504.50");
  assert.equal(montoCorto(250), "S/ 250");
});

test("siguiente da la vuelta y con ≤ 1 elementos devuelve 0", () => {
  assert.equal(siguiente(3, 1, 4), 0);
  assert.equal(siguiente(0, -1, 4), 3);
  assert.equal(siguiente(0, 1, 1), 0);
  assert.equal(siguiente(0, 1, 0), 0);
});
