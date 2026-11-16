import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as srv from "./envioPromo.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ts = path.join(here, "../src/lib/envioPromo.ts");

const casos = [
  [[{ product_id: "a" }], [{ product_id: "a", envio_tipo: "gratis" }], 80],
  [[{ product_id: "a" }, { product_id: "b" }], [{ product_id: "a", envio_tipo: "descuento", envio_descuento: 20 }, { product_id: "b", envio_tipo: "descuento", envio_descuento: "35.5" }], 80],
  [[{ product_id: "a" }], [{ product_id: "a", envio_tipo: "descuento", envio_descuento: 500 }], 80],
  [[{ product_id: "a", comboId: "c" }], [{ product_id: "a", envio_tipo: "gratis" }], 80],
  [[{ product_id: "a" }], [{ product_id: "z", envio_tipo: "gratis" }], 80],
  [[{ product_id: "a" }], [{ product_id: "a", envio_tipo: "ninguno" }], 80],
  [[{ product_id: "a" }, { product_id: "b" }], [{ product_id: "a", envio_tipo: "gratis" }, { product_id: "b", envio_tipo: "descuento", envio_descuento: 30 }], 80],
];

test("fórmula: gratis, mayor descuento una vez, tope en 0, combos y otros productos no cuentan", () => {
  const r = casos.map(([l, q, base]) => srv.envioConPromo(base, srv.promoEnvio(l, q)));
  assert.deepEqual(r, [0, 44.5, 0, 80, 80, 80, 0]);
});

test("src/lib/envioPromo.ts da lo mismo que server/envioPromo.js", { skip: !existsSync(ts) }, async () => {
  const cli = await import(ts);
  for (const [l, q, base] of casos) {
    assert.deepEqual(cli.promoEnvio(l, q), srv.promoEnvio(l, q));
    assert.equal(cli.envioConPromo(base, cli.promoEnvio(l, q)), srv.envioConPromo(base, srv.promoEnvio(l, q)));
  }
});
