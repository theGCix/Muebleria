// Pruebas de src/lib/tapizado3d.ts. Ejecutar: node --test scripts/test-tapizado3d.mjs  (Node ≥ 22.18)
import test from "node:test";
import assert from "node:assert/strict";
import { extraerTexturaGlb, hexARgb, rgbALab, labARgb, detectarColorBase, crearMascara, recolorear } from "../src/lib/tapizado3d.ts";

// Textura sintética: 80 % tapizado gris pardo con variación de luz, 10 % dorado, 10 % madera oscura
function textura(n = 10000) {
  const d = new Uint8ClampedArray(n * 4);
  for (let p = 0; p < n; p++) {
    const t = p % 10;
    const luz = (p % 7) * 3 - 9;
    const px = t < 8 ? [150 + luz, 140 + luz, 130 + luz] : t === 8 ? [190, 150, 40] : [100, 60, 30];
    d.set([...px, 255], p * 4);
  }
  return d;
}

test("hexARgb acepta #rgb, #rrggbb y rechaza basura", () => {
  assert.deepEqual(hexARgb("#2f4a6b"), [47, 74, 107]);
  assert.deepEqual(hexARgb("fff"), [255, 255, 255]);
  assert.equal(hexARgb("azul"), null);
  assert.equal(hexARgb(null), null);
});

test("RGB → Lab → RGB es reversible", () => {
  for (const c of [[0, 0, 0], [255, 255, 255], [47, 74, 107], [190, 150, 40]]) {
    const r = labARgb(...rgbALab(...c));
    c.forEach((v, i) => assert.ok(Math.abs(v - r[i]) <= 1));
  }
});

test("detecta el tapizado como color base (no el dorado ni la madera)", () => {
  const base = detectarColorBase(textura());
  assert.ok(base);
  const [L, a, b] = base;
  assert.ok(L > 50 && L < 65, `L=${L}`);
  assert.ok(Math.hypot(a, b) < 15);
});

test("la máscara cubre el tapizado y deja fuera dorado y madera", () => {
  const d = textura();
  const m = crearMascara(d, detectarColorBase(d));
  assert.equal(m[0] > 0.9, true);   // tapizado
  assert.equal(m[8], 0);            // dorado
  assert.equal(m[9], 0);            // madera
});

test("recolorear cambia el tapizado, conserva las sombras y no toca lo demás", () => {
  const d = textura();
  const base = detectarColorBase(d);
  const out = recolorear(d, crearMascara(d, base), base, hexARgb("#2f4a6b"));
  assert.ok(out[2] > out[0], "el tapizado debe quedar azulado");
  assert.deepEqual([...out.slice(8 * 4, 8 * 4 + 4)], [190, 150, 40, 255]);
  assert.deepEqual([...out.slice(9 * 4, 9 * 4 + 4)], [100, 60, 30, 255]);
  // píxeles de distinta luz siguen siendo de distinta luz
  const L = (i) => rgbALab(out[i * 4], out[i * 4 + 1], out[i * 4 + 2])[0];
  assert.notEqual(Math.round(L(0)), Math.round(L(6)));
  assert.notEqual(out, d);
  assert.deepEqual([...d.slice(0, 3)], [141, 131, 121]); // la original no se modifica
});

test("sin píxeles de tapizado no hay color base", () => {
  assert.equal(detectarColorBase(new Uint8ClampedArray(400)), null);
});

test("extrae la textura embebida de un .glb", () => {
  const img = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  const json = new TextEncoder().encode(JSON.stringify({
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    textures: [{ source: 0 }],
    images: [{ mimeType: "image/jpeg", bufferView: 1 }],
    bufferViews: [{ byteOffset: 0, byteLength: 4 }, { byteOffset: 4, byteLength: 8 }],
  }));
  const jsonPad = new Uint8Array(Math.ceil(json.length / 4) * 4).fill(0x20); jsonPad.set(json);
  const bin = new Uint8Array(12); bin.set(img, 4);
  const buf = new ArrayBuffer(12 + 8 + jsonPad.length + 8 + bin.length);
  const dv = new DataView(buf);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, buf.byteLength, true);
  dv.setUint32(12, jsonPad.length, true); dv.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buf, 20).set(jsonPad);
  const o = 20 + jsonPad.length;
  dv.setUint32(o, bin.length, true); dv.setUint32(o + 4, 0x004e4942, true);
  new Uint8Array(buf, o + 8).set(bin);
  const r = extraerTexturaGlb(buf);
  assert.equal(r.mime, "image/jpeg");
  assert.deepEqual([...r.bytes], [...img]);
  assert.equal(extraerTexturaGlb(new ArrayBuffer(40)), null);
});
