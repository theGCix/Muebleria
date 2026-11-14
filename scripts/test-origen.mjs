// Pruebas de src/lib/origen.ts. Ejecutar: node scripts/test-origen.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { limpiarOrigen, origenParaGuardar, resolverOrigen } from "../src/lib/origen.ts";

const ctx = { direccion: "Av. Gerardo Unger 5427", pasos: [{ id: "corte", titulo: "Corte" }, { id: "tapizado", titulo: "Tapizado" }, { id: "calidad", titulo: "Control" }] };

test("limpiarOrigen tolera basura de la base", () => {
  for (const raw of [null, undefined, "x", 5, [], [1]]) assert.deepEqual(limpiarOrigen(raw), {});
  assert.deepEqual(limpiarOrigen({ material: "  Madera   tornillo ", procedencia: 3, artesano: "", dias_fabricacion: "15" }), { material: "Madera tornillo", dias_fabricacion: 15 });
  assert.deepEqual(limpiarOrigen({ dias_fabricacion: 0 }), {});
  assert.deepEqual(limpiarOrigen({ dias_fabricacion: 9999 }), {});
  assert.equal(limpiarOrigen({ material: "x".repeat(500) }).material.length, 120);
});

test("origenParaGuardar descarta vacíos", () => {
  assert.deepEqual(origenParaGuardar({ material: "", procedencia: " ", artesano: "", dias: "" }), {});
  assert.deepEqual(origenParaGuardar({ material: "Tornillo", procedencia: "", artesano: "Taller", dias: "12,5" }), { material: "Tornillo", artesano: "Taller", dias_fabricacion: 13 });
});

test("manufactura sin datos: bloque del taller con pasos, sin filas inventadas", () => {
  const r = resolverOrigen({ tipo_gestion: "manufactura", origen: {}, categoria: "recamaras" }, ctx);
  assert.equal(r.tipo, "taller");
  assert.equal(r.filas.length, 0);
  assert.deepEqual(r.pasos.map((s) => s.id), ["corte", "calidad"]); // recámaras: sin tapizado
  assert.match(r.subtitulo, /Gerardo Unger/);
});

test("tipo_gestion ausente se trata como manufactura; tapizado en muebles/comedores", () => {
  const r = resolverOrigen({ origen: null, categoria: "muebles" }, ctx);
  assert.equal(r.tipo, "taller");
  assert.ok(r.pasos.some((s) => s.id === "tapizado"));
  assert.ok(resolverOrigen({ categoria: "comedores" }, ctx).pasos.some((s) => s.id === "tapizado"));
});

test("manufactura con datos: filas en orden", () => {
  const r = resolverOrigen({ origen: { material: "Tornillo", procedencia: "Pucallpa", artesano: "Taller G&M", dias_fabricacion: 15 } }, ctx);
  assert.deepEqual(r.filas.map((f) => f.etiqueta), ["Material", "Procedencia del material", "Hecho por", "Fabricación"]);
  assert.equal(r.filas[3].valor, "15 días hábiles aprox.");
});

test("retail sin datos no muestra bloque; con datos, solo lo cargado", () => {
  assert.equal(resolverOrigen({ tipo_gestion: "retail", origen: {} }, ctx), null);
  const r = resolverOrigen({ tipo_gestion: "retail", origen: { procedencia: "Marca X", artesano: "no debe salir" } }, ctx);
  assert.equal(r.tipo, "seleccion");
  assert.deepEqual(r.filas, [{ etiqueta: "Marca o procedencia", valor: "Marca X" }]);
  assert.equal(r.pasos.length, 0);
});
