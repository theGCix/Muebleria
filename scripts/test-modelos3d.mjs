// Pruebas de src/lib/modelos3d.ts. Ejecutar: node --test scripts/test-modelos3d.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import {
  validarModelo3d, tieneCabeceraGlb, rutaModelo3d, rutaDesdeUrl, MAX_MODELO_3D_BYTES,
} from "../src/lib/modelos3d.ts";

test("valida extensión, vacío y tamaño", () => {
  assert.equal(validarModelo3d("sala.glb", 900_000), null);
  assert.equal(validarModelo3d("SALA.GLB", 900_000), null);
  assert.match(validarModelo3d("sala.gltf", 1000), /\.glb/);
  assert.match(validarModelo3d("sala.glb", 0), /vacío/);
  assert.match(validarModelo3d("sala.glb", MAX_MODELO_3D_BYTES + 1), /máximo es 5 MB/);
  assert.equal(validarModelo3d("sala.glb", MAX_MODELO_3D_BYTES), null);
});

test("cabecera glTF", async () => {
  assert.equal(await tieneCabeceraGlb(new Blob(["glTF\x02\x00\x00\x00"])), true);
  assert.equal(await tieneCabeceraGlb(new Blob(["<html>"])), false);
  assert.equal(await tieneCabeceraGlb(new Blob([])), false);
});

test("ruta única y segura", () => {
  assert.equal(rutaModelo3d("Juego de muebles modelo asiático", 1700000000000), "juego-de-muebles-modelo-asiatico-1700000000000.glb");
  assert.equal(rutaModelo3d("GM-0042", 5), "gm-0042-5.glb");
  assert.equal(rutaModelo3d("¡¡!!", 5), "modelo-5.glb");
  assert.equal(rutaModelo3d("a".repeat(100), 1).length, 40 + "-1.glb".length);
});

test("ruta desde la URL pública", () => {
  const u = "https://abc.supabase.co/storage/v1/object/public/modelos-3d/gm-0042-5.glb";
  assert.equal(rutaDesdeUrl(u), "gm-0042-5.glb");
  assert.equal(rutaDesdeUrl(u + "?t=1"), "gm-0042-5.glb");
  assert.equal(rutaDesdeUrl("https://otro.com/modelo.glb"), null);
  assert.equal(rutaDesdeUrl(""), null);
  assert.equal(rutaDesdeUrl(null), null);
});
