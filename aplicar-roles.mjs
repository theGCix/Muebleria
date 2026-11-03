// Uso (desde la raíz del proyecto):  node aplicar-roles.mjs
// En src/lib/pos.functions.ts:
//   1) reemplaza setUserRole por la versión de rol único con confirmación "ADMIN"
//   2) agrega listRoleAudit (lee audit_log, tabla user_roles)
//   3) agrega "confirmacion" opcional a createStaffUser
// No toca nada más. Deja una copia .bak. Si ya está aplicado, no cambia nada.
import fs from "node:fs";

const ruta = process.argv[2] || "src/lib/pos.functions.ts";
let src = fs.readFileSync(ruta, "utf8");
const crlf = src.includes("\r\n");
src = src.replace(/\r\n/g, "\n");

if (src.includes("export async function listRoleAudit")) {
  console.log("Ya estaba aplicado. No se cambió nada.");
  process.exit(0);
}

// 1) setUserRole
const ini = src.indexOf("export async function setUserRole(");
if (ini < 0) { console.error("No encontré setUserRole. No se cambió nada."); process.exit(1); }
const fin = src.indexOf("\n}\n", ini);
if (fin < 0) { console.error("No pude ubicar el final de setUserRole. No se cambió nada."); process.exit(1); }

const nuevo = `// Cada usuario tiene un solo rol. Para subir a "admin" se exige escribir ADMIN.
// La seguridad real está en RLS (solo admin escribe user_roles); cada cambio queda en audit_log.
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

  if (data.role === "admin" && data.confirmacion !== "ADMIN") {
    throw new Error('Para asignar el rol de administrador escribe ADMIN para confirmar');
  }

  const { supabase, userId } = await getAuthenticatedClient();
  const { data: adminCheck } = await supabase
    .from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!adminCheck) throw new Error("Solo administradores pueden cambiar roles");

  // Primero se agrega el rol nuevo y después se quitan los demás: así el usuario nunca queda sin rol.
  const { error: insErr } = await supabase
    .from("user_roles").insert({ user_id: data.user_id, role: data.role });
  if (insErr && !insErr.message.toLowerCase().includes("duplicate")) throw new Error(insErr.message);

  const { error: delErr } = await supabase
    .from("user_roles").delete().eq("user_id", data.user_id).neq("role", data.role);
  if (delErr) throw new Error(delErr.message);

  return { ok: true };
}

// Últimos cambios de rol (quién, cuándo y qué), desde audit_log.
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
src = src.slice(0, ini) + nuevo + src.slice(fin + 3);

// 3) createStaffUser: confirmacion opcional
src = src.replace(
  /(export async function createStaffUser\(input: \{\n\s*email: string; password: string; fullName: string;\n\s*role: "admin" \| "vendedor" \| "carpintero";)/,
  '$1\n  confirmacion?: string;'
);

let out = src;
if (crlf) out = out.replace(/\n/g, "\r\n");
fs.writeFileSync(ruta + ".bak", fs.readFileSync(ruta));
fs.writeFileSync(ruta, out);
console.log("Listo. Copia de respaldo en " + ruta + ".bak (bórrala antes del commit).");
