// Pruebas de src/lib/filtrosCatalogo.ts. Ejecutar: node scripts/test-filtros-catalogo.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { filtrarCatalogo, contarFiltros, contarPor, coincideBusqueda } from "../src/lib/filtrosCatalogo.ts";

const it = (nombre, precioFinal, extra = {}) => ({
  nombre, descripcion: null, categoria: "muebles", subcategoria: "sala", material: "madera",
  precioFinal, enOferta: false, descuento: 0, creado: "2026-11-01T00:00:00Z", ...extra,
});
const lista = [
  it("Sofá modular gris", 1500, { creado: "2026-11-10T00:00:00Z" }),
  it("Mesa de centro", 250, { enOferta: true, descuento: 10, creado: "2026-10-01T00:00:00Z" }),
  it("Comedor 6 sillas", 2200, { categoria: "comedores", subcategoria: "6-sillas", enOferta: true, descuento: 25, creado: "2026-11-05T00:00:00Z" }),
  it("Cama king", 3200, { categoria: "recamaras", subcategoria: null }),
];
const nombres = (l) => l.map((x) => x.nombre);

test("presupuesto: min exclusivo, max inclusivo", () => {
  assert.deepEqual(nombres(filtrarCatalogo(lista, { max: 1500, sort: "precio_asc" })), ["Mesa de centro", "Sofá modular gris"]);
  assert.deepEqual(nombres(filtrarCatalogo(lista, { min: 1500 })).sort(), ["Cama king", "Comedor 6 sillas"]);
});

test("categoría y tipo; el tipo se ignora sin categoría", () => {
  assert.deepEqual(nombres(filtrarCatalogo(lista, { cat: "comedores", sub: "6-sillas" })), ["Comedor 6 sillas"]);
  assert.equal(filtrarCatalogo(lista, { cat: "comedores", sub: "4-sillas" }).length, 0);
  assert.equal(filtrarCatalogo(lista, { sub: "6-sillas" }).length, 4);
});

test("material: filtra por valor exacto y se cuenta como filtro", () => {
  const l = [it("A", 100, { material: "cedro" }), it("B", 200), it("C", 300, { material: null })];
  assert.deepEqual(nombres(filtrarCatalogo(l, { mat: "cedro" })), ["A"]);
  assert.equal(contarFiltros({ mat: "cedro" }), 1);
  assert.deepEqual(contarPor(l, { mat: "cedro" }, "material"), { cedro: 1, madera: 1 });
});

test("solo ofertas", () => {
  assert.equal(filtrarCatalogo(lista, { oferta: true }).length, 2);
});

test("búsqueda sin tildes y por varias palabras", () => {
  assert.ok(coincideBusqueda(lista[0], "SOFA gris"));
  assert.ok(!coincideBusqueda(lista[0], "sofa rojo"));
  assert.ok(coincideBusqueda(lista[3], "recamaras"));
  assert.ok(coincideBusqueda(lista[0], "   "));
});

test("orden por descuento: sin oferta al final, empate por más reciente", () => {
  assert.deepEqual(nombres(filtrarCatalogo(lista, { sort: "descuento" })), ["Comedor 6 sillas", "Mesa de centro", "Sofá modular gris", "Cama king"]);
});

test("orden por defecto: más recientes primero; precio_desc", () => {
  assert.equal(filtrarCatalogo(lista, {})[0].nombre, "Sofá modular gris");
  assert.equal(filtrarCatalogo(lista, { sort: "precio_desc" })[0].nombre, "Cama king");
});

test("contarFiltros no cuenta búsqueda ni orden, y el tipo solo con categoría", () => {
  assert.equal(contarFiltros({ q: "x", sort: "precio_asc" }), 0);
  assert.equal(contarFiltros({ cat: "muebles", sub: "sala", max: 1500, oferta: true }), 4);
  assert.equal(contarFiltros({ sub: "sala" }), 0);
});

test("contarPor ignora el propio filtro pero respeta los demás", () => {
  assert.deepEqual(contarPor(lista, { cat: "comedores", oferta: true }, "categoria"), { muebles: 1, comedores: 1 });
  assert.deepEqual(contarPor(lista, { cat: "muebles" }, "subcategoria"), { sala: 2 });
});

test("no modifica la lista original", () => {
  const copia = [...lista];
  filtrarCatalogo(lista, { sort: "precio_asc" });
  assert.deepEqual(lista, copia);
});
