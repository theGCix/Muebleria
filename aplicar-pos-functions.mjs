// Uso (desde la raíz del proyecto):  node aplicar-pos-functions.mjs
// Cambia SOLO getMaterialesOrden en src/lib/pos.functions.ts y quita sus helpers privados.
// Todo lo demás del archivo (listRoleAudit, setUserRole, etc.) queda intacto.
import fs from "node:fs";

const ruta = process.argv[2] || "src/lib/pos.functions.ts";
let src = fs.readFileSync(ruta, "utf8");
const crlf = src.includes("\r\n");
src = src.replace(/\r\n/g, "\n");

if (src.includes('rpc("materiales_orden"')) {
  console.log("Ya estaba aplicado. No se cambió nada.");
  process.exit(0);
}

const ini = src.indexOf("export async function getMaterialesOrden(");
if (ini < 0) { console.error("No encontré getMaterialesOrden. No se cambió nada."); process.exit(1); }

// fin de la función: primera línea "}" en columna 0 después del inicio
let fin = src.indexOf("\n}\n", ini);
const finArchivo = fin < 0;
fin = finArchivo ? src.length : fin + 3;

// helpers privados que venían justo después (solo si existen y nadie más los usa)
let hasta = fin;
const marca = src.indexOf("// ── helpers privados", fin);
if (marca >= 0) {
  const resto = src.slice(fin, marca).trim();
  const fueraDeAqui = src.slice(0, ini) + src.slice(marca);
  const usadoAfuera = /_buildMapa|_mapaToMateriales/.test(src.slice(0, ini));
  if (resto === "" && !usadoAfuera) {
    const ultimo = src.lastIndexOf("function _mapaToMateriales");
    const cierre = ultimo >= 0 ? src.indexOf("\n}", ultimo) : -1;
    hasta = cierre >= 0 ? cierre + 2 : src.length;
    // lo que queda después de los helpers se conserva
  }
}

const nueva = `export async function getMaterialesOrden(input: {
  order_id: string;
}): Promise<{ materiales: MaterialNecesario[] }> {
  const { order_id } = z.object({ order_id: z.string().uuid() }).parse(input);
  const { supabase } = await getAuthenticatedClient();

  // Los materiales salen de una función del servidor (materiales_orden, SECURITY DEFINER)
  // que valida que la orden sea del carpintero o que quien llama sea admin, y no expone
  // precios ni proveedor. Ya no se leen insumos / bom_items / insumo_movimientos desde aquí:
  // esas tablas son solo de administrador.
  const { data, error } = await supabase.rpc("materiales_orden", { _order_id: order_id });
  if (error) throw new Error(error.message);

  const materiales: MaterialNecesario[] = (data ?? []).map((m: {
    insumo_id: string; nombre: string; unidad: string; necesario: number | string; stock_actual: number | string;
  }) => {
    const necesario = Number(m.necesario);
    const stock_actual = Number(m.stock_actual);
    return {
      insumo_id: m.insumo_id,
      nombre: m.nombre,
      unidad: m.unidad,
      necesario,
      stock_actual,
      stockOk: stock_actual >= necesario,
    };
  });
  return { materiales };
}
`;

let out = src.slice(0, ini) + nueva + src.slice(hasta);
if (crlf) out = out.replace(/\n/g, "\r\n");
fs.writeFileSync(ruta + ".bak", fs.readFileSync(ruta));
fs.writeFileSync(ruta, out);
console.log("Listo. Copia de respaldo en " + ruta + ".bak");
