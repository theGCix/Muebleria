// Pruebas de src/lib/segmentos.ts. Ejecutar: node scripts/test-segmentos.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SEGMENTOS, SEGMENTO_IDS, AMBIENTES, AMBIENTE_IDS, esSegmento, segmentoValido, nombreSegmento, ambienteDeTipo, accionSugerida } from "../src/lib/segmentos.ts";

test("hay 6 segmentos y 5 ambientes, sin duplicados y en sincronía con las listas de ids", () => {
  assert.equal(SEGMENTOS.length, 6);
  assert.deepEqual(SEGMENTOS.map((s) => s.id), [...SEGMENTO_IDS]);
  assert.deepEqual(AMBIENTES.map((a) => a.id), [...AMBIENTE_IDS]);
  assert.equal(new Set(SEGMENTO_IDS).size, 6);
});

test("la migración permite exactamente los mismos valores que el front", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261117_segmentacion_leads.sql", import.meta.url), "utf8");
  const dePar = (campo) => [...sql.match(new RegExp(`${campo} IS NULL OR ${campo} IN\\s*\\(([^)]*)\\)`))[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(dePar("segmento"), [...SEGMENTO_IDS]);
  assert.deepEqual(dePar("ambiente"), [...AMBIENTE_IDS]);
});

test("validación: solo ids conocidos", () => {
  assert.equal(esSegmento("familia"), true);
  for (const x of ["", "FAMILIA", null, undefined, 3, "vip"]) assert.equal(esSegmento(x), false);
  assert.equal(segmentoValido("<script>"), null);
  assert.equal(segmentoValido("regalo"), "regalo");
  assert.equal(nombreSegmento("proyecto"), "Diseñador, arquitecto o constructora");
  assert.equal(nombreSegmento("x"), null);
});

test("ambienteDeTipo mapea las etiquetas del formulario a medida", () => {
  assert.equal(ambienteDeTipo("Sala"), "sala");
  assert.equal(ambienteDeTipo("Recámara"), "recamara");
  assert.equal(ambienteDeTipo("Separador de ambiente"), "separador");
  assert.equal(ambienteDeTipo("Otro"), "otro");
  assert.equal(ambienteDeTipo(null), null);
  assert.equal(ambienteDeTipo("Cocina"), null);
});

test("acciones: solo negocio, proyecto, remodelación y regalo cambian algo", () => {
  assert.equal(accionSugerida("primer-hogar"), null);
  assert.equal(accionSugerida("familia"), null);
  assert.equal(accionSugerida(null), null);
  assert.equal(accionSugerida("negocio").destino, "medida");
  assert.equal(accionSugerida("proyecto").destino, "medida");
  assert.equal(accionSugerida("remodelacion").destino, "medida");
  assert.equal(accionSugerida("regalo").destino, "envios");
});
