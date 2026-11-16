// Pruebas de src/lib/ofertaBanner.ts. Ejecutar: node scripts/test-oferta-banner.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { partirNombre, fmtSolesBanner, textoRegalo, REGALO_COJINES } from "../src/lib/ofertaBanner.ts";

test("parte el nombre en «modelo»", () => {
  assert.deepEqual(partirNombre("Mueble modelo lineal"), { kicker: "Mueble", principal: "lineal" });
  assert.deepEqual(partirNombre("Juego de muebles modelo reclinable"), { kicker: "Juego de muebles", principal: "reclinable" });
  assert.deepEqual(partirNombre("Sala  MODELO  Brasilia 3-2-1"), { kicker: "Sala", principal: "Brasilia 3-2-1" });
});

test("sin «modelo»: la primera palabra es el rótulo", () => {
  assert.deepEqual(partirNombre("Dormitorio 2 plazas"), { kicker: "Dormitorio", principal: "2 plazas" });
});

test("una sola palabra o vacío", () => {
  assert.deepEqual(partirNombre("Sofá"), { kicker: "", principal: "Sofá" });
  assert.deepEqual(partirNombre("  "), { kicker: "", principal: "" });
});

test("precio en soles", () => {
  assert.equal(fmtSolesBanner(1504), "S/ 1,504");
  assert.equal(fmtSolesBanner(2280), "S/ 2,280");
  assert.equal(fmtSolesBanner(999), "S/ 999");
  assert.equal(fmtSolesBanner(1504.5), "S/ 1,504.50");
  assert.equal(fmtSolesBanner(1234567), "S/ 1,234,567");
});

test("regalo: 3 cojines por ahora", () => {
  assert.equal(REGALO_COJINES, 3);
  assert.equal(textoRegalo(), "JUEGO DE 3 COJINES");
});
