// Pruebas de src/lib/telas.ts y de la migración del catálogo. Ejecutar: node --test scripts/test-telas.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { CATEGORIAS_TELA, TELAS, TONOS, hexTapizado, nombreTapizado, telasDeCategoria, buscarTela, buscarTono } from "../src/lib/telas.ts";

test("el catálogo trae 36 telas, numeradas 1-36, con ids únicos y categoría válida", () => {
  assert.equal(TELAS.length, 36);
  assert.deepEqual(TELAS.map((t) => t.numero), Array.from({ length: 36 }, (_, i) => i + 1));
  assert.equal(new Set(TELAS.map((t) => t.id)).size, 36);
  const cats = new Set(CATEGORIAS_TELA.map((c) => c.id));
  assert.ok(TELAS.every((t) => cats.has(t.categoria)));
  assert.deepEqual(CATEGORIAS_TELA.map((c) => telasDeCategoria(c.id).length), [6, 10, 6, 6, 8]);
});

test("cada tela tiene hex válido e imagen en public/telas", () => {
  for (const t of TELAS) {
    assert.match(t.hex, /^#[0-9a-f]{6}$/i, t.nombre);
    assert.ok(existsSync(new URL(`../public${t.imagen}`, import.meta.url)), t.imagen);
  }
});

test("hexTapizado: «Original» usa el color de la tela; un tono lo reemplaza; sin tela y original → null", () => {
  const velvet = buscarTela("velvet-terciopelo");
  assert.equal(hexTapizado(velvet, buscarTono("original")), velvet.hex);
  assert.equal(hexTapizado(velvet, buscarTono("vino")), "#6e2a3a");
  assert.equal(hexTapizado(null, buscarTono("original")), null);
  assert.equal(hexTapizado(null, buscarTono("gris")), "#8a8d90");
});

test("nombreTapizado combina tela y tono", () => {
  const lino = buscarTela("lino");
  assert.equal(nombreTapizado(lino, buscarTono("original")), "Lino");
  assert.equal(nombreTapizado(lino, buscarTono("azul-marino")), "Lino · Azul marino");
  assert.equal(nombreTapizado(null, buscarTono("original")), "Original");
});

test("la migración siembra las mismas 36 telas y los mismos tonos que el módulo", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261120_catalogo_telas.sql", import.meta.url), "utf8");
  for (const t of TELAS) assert.ok(sql.includes(`('${t.id}', ${t.numero}, ${t.categoria},`), t.id);
  for (const n of TONOS) assert.ok(sql.includes(`('${n.id}', '${n.nombre}',`), n.id);
  assert.ok(sql.includes("ENABLE ROW LEVEL SECURITY"));
});
