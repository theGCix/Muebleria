// Uso (desde la raíz del proyecto):  node aplicar-roles-v2.mjs
// En src/lib/pos.functions.ts:
//   1) setUserRole pasa a llamar la RPC set_user_role (ya no escribe directo en user_roles)
//   2) asegura listRoleAudit (lee audit_log, tabla user_roles)
//   3) asegura "confirmacion" opcional en createStaffUser
// Funciona si ya aplicaste aplicar-roles.mjs o si no. Deja una copia .bak. Idempotente.
import fs from "node:fs";

const ruta = process.argv[2] || "src/lib/pos.functions.ts";
let src = fs.readFileSync(ruta, "utf8");
const crlf = src.includes("\r\n");
src = src.replace(/\r\n/g, "\n");
let cambios = 0;

// 1) setUserRole -> RPC
if (!src.includes('rpc("set_user_role"')) {
  let ini = src.indexOf("export async function setUserRole(");
  if (ini < 0) { console.error("No encontré setUserRole. No se cambió nada."); process.exit(1); }
  const fin = src.indexOf("\n}\n", ini);
  if (fin < 0) { console.error("No pude ubicar el final de setUserRole. No se cambió nada."); process.exit(1); }
  // incluir los comentarios // pegados justo encima
  while (true) {
    const prev = src.lastIndexOf("\n", ini - 2);
    const linea = src.slice(prev + 1, ini - 1);
    if (linea.startsWith("//")) ini = prev + 1; else break;
  }
  const nuevo = `// Cada usuario tiene un solo rol. El cambio lo hace la función set_user_role en la base de datos
// (SECURITY DEFINER): ella valida que quien llama sea admin, exige "ADMIN" para otorgar admin,
// impide cambiar el propio rol y el trigger deja el registro en audit_log.
export async function setUserRole(input: {
  user_id: string;
  role: "admin" | "vendedor" | "carpintero" | "cliente";
  confirmacion?: string;
}) {
  const data = z.object({
    user_id: z.string().uuid(),
    role: z.enum(["admin", "vendedor", "carpintero", "cliente"]),
    confirmacion: z.string().optional(),
  }).parse(input);

  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase.rpc("set_user_role", {
    _user_id: data.user_id,
    _role: data.role,
    _confirmacion: data.confirmacion,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}`;
  src = src.slice(0, ini) + nuevo + src.slice(fin + 2);
  cambios++;
}

// 2) listRoleAudit
if (!src.includes("export async function listRoleAudit")) {
  const marca = src.indexOf("export async function anularVenta(");
  if (marca < 0) { console.error("No encontré dónde insertar listRoleAudit. No se cambió nada."); process.exit(1); }
  const audit = `// Últimos cambios de rol (quién, cuándo y qué), desde audit_log.
export async function listRoleAudit(limit = 30) {
  const n = z.number().int().min(1).max(200).parse(limit);
  const { supabase } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, created_at, operacion, usuario, antes, despues")
    .eq("tabla", "user_roles")
    .order("created_at", { ascending: false })
    .limit(n);
  if (error) throw new Error(error.message);
  return data ?? [];
}

`;
  src = src.slice(0, marca) + audit + src.slice(marca);
  cambios++;
}

// 3) createStaffUser: confirmacion opcional
if (!/export async function createStaffUser\(input: \{[^}]*confirmacion\?: string/.test(src)) {
  const antes = src;
  src = src.replace(
    /(export async function createStaffUser\(input: \{\n\s*email: string; password: string; fullName: string;\n\s*role: "admin" \| "vendedor" \| "carpintero";)/,
    '$1\n  confirmacion?: string;'
  );
  if (src !== antes) cambios++;
}

if (cambios === 0) { console.log("Ya estaba aplicado. No se cambió nada."); process.exit(0); }
let out = src;
if (crlf) out = out.replace(/\n/g, "\r\n");
fs.writeFileSync(ruta + ".bak", fs.readFileSync(ruta));
fs.writeFileSync(ruta, out);
console.log("Listo (" + cambios + " cambio(s)). Copia de respaldo en " + ruta + ".bak (bórrala antes del commit).");
