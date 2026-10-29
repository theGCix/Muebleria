// Ejecutar: node --test server/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { crearHerramientas, clasificarResultado } from "./chat.js";
import { calcularEnvioChat, normalizar } from "./envioChat.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// ── envioChat (puro) ─────────────────────────────────────────
test("normalizar quita tildes, mayúsculas y espacios", () => {
  assert.equal(normalizar("  Áncash "), "ancash");
  assert.equal(normalizar("San  MARTÍN de Porres"), "san martin de porres");
});

test("Lima: tarifa por distrito, sin importar tildes ni mayúsculas", () => {
  const r = calcularEnvioChat({ distrito: "jesus maria" });
  assert.equal(r.precio_soles, 140);
  assert.equal(r.distrito, "Jesús María");
});

test("Lima: distrito desconocido → no encontrado con sugerencias", () => {
  const r = calcularEnvioChat({ distrito: "Miraflor" });
  assert.equal(r.encontrado, false);
  assert.ok(r.sugerencias.includes("Miraflores"));
  assert.equal(clasificarResultado(JSON.stringify(r)), "vacio");
});

test("sin datos de destino → pide el dato y NO cuenta como fallo", () => {
  const r = calcularEnvioChat({});
  assert.equal(clasificarResultado(JSON.stringify(r)), "ok");
  assert.ok(r.necesita);
});

test("Provincia con volumen → estimado en soles, marcado como referencial", () => {
  const r = calcularEnvioChat({
    departamento: "Ancash",
    provincia: "Huaraz",
    producto: { id: "p1", volumen_m3: 1.2 },
    cantidad: 1,
  });
  assert.equal(r.estado, "estimado");
  assert.ok(r.desde_soles > 0 && r.hasta_soles >= r.desde_soles);
  assert.match(r.nota, /ESTIMADO/);
});

test("Provincia sin producto o sin volumen → por cotizar (no inventa monto)", () => {
  const sin = calcularEnvioChat({ departamento: "Cusco", provincia: "Cusco" });
  assert.equal(sin.estado, "por_cotizar");
  assert.equal(sin.desde_soles, undefined);
  const sinVol = calcularEnvioChat({
    departamento: "Cusco", provincia: "Cusco", producto: { id: "p1", volumen_m3: null },
  });
  assert.equal(sinVol.estado, "por_cotizar");
});

test("Destino inexistente → no encontrado", () => {
  assert.equal(calcularEnvioChat({ departamento: "Atlántida", provincia: "X" }).encontrado, false);
});

test("envio-distritos.json está sincronizado con src/lib/envios.ts", { skip: !existsSync(path.join(here, "../src/lib/envios.ts")) }, () => {
  const ts = readFileSync(path.join(here, "../src/lib/envios.ts"), "utf-8");
  const delTs = [...ts.matchAll(/\{ destino: "([^"]+)", precio: (\d+) \}/g)].map((m) => ({ destino: m[1], precio: Number(m[2]) }));
  const json = JSON.parse(readFileSync(path.join(here, "envio-distritos.json"), "utf-8")).distritos;
  assert.deepEqual(json, delTs);
});

// ── Herramientas con Supabase falso ──────────────────────────
function supabaseFalso({ rpc, tablas = {} }) {
  const builder = (respuesta) => {
    const b = new Proxy({}, { get: (_, p) => (p === "then" ? (ok, no) => Promise.resolve(respuesta).then(ok, no) : () => b) });
    return b;
  };
  return {
    rpc,
    from: (t) => {
      const sig = tablas[t]?.shift();
      if (sig === undefined) throw new Error(`Sin respuesta preparada para ${t}`);
      return builder(sig);
    },
  };
}
const tool = (sb, nombre) => crearHerramientas({ supabaseAdmin: sb }, { cartActions: [] }).find((t) => t.name === nombre);

test("buscar_productos usa la función SQL y pasa el presupuesto", async () => {
  let args;
  const sb = supabaseFalso({ rpc: async (_n, a) => { args = a; return { data: [{ id: "p1", nombre: "Sofá Milán", precio: 1200, descripcion: "x" }], error: null }; } });
  const r = JSON.parse(await tool(sb, "buscar_productos").invoke({ query: "sofás", precio_max: 1500 }));
  assert.equal(r.resultados[0].nombre, "Sofá Milán");
  assert.equal(args.p_precio_max, 1500);
});

test("buscar_productos: si la función SQL no existe, cae al ILIKE de siempre", async () => {
  const sb = supabaseFalso({
    rpc: async () => ({ data: null, error: { code: "PGRST202", message: "function not found" } }),
    tablas: { products: [{ data: [{ id: "p1", nombre: "Sofá Milán", precio: 1200 }] }] },
  });
  const r = JSON.parse(await tool(sb, "buscar_productos").invoke({ query: "sofá" }));
  assert.equal(r.resultados.length, 1);
});

test("calcular_envio (Lima) no consulta la base de datos", async () => {
  const sb = supabaseFalso({ rpc: async () => ({}) }); // from() lanzaría si se usara
  const r = JSON.parse(await tool(sb, "calcular_envio").invoke({ distrito: "San Isidro" }));
  assert.equal(r.precio_soles, 170);
});

test("calcular_envio (provincia) lee el volumen del producto y estima", async () => {
  const sb = supabaseFalso({ rpc: async () => ({}), tablas: { products: [{ data: { id: "p1", nombre: "Sofá", volumen_m3: 1.2 } }] } });
  const r = JSON.parse(await tool(sb, "calcular_envio").invoke({ departamento: "Ancash", provincia: "Huaraz", product_id: "p1" }));
  assert.equal(r.estado, "estimado");
});
