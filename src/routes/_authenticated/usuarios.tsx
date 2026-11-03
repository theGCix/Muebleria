import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUsers, setUserRole, createStaffUser, listRoleAudit } from "@/lib/pos.functions";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogCancel, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { TableSkeleton } from "@/components/states";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuarios — G&M POS" }] }),
  component: UsuariosPage,
});

type Rol = "admin" | "vendedor" | "carpintero" | "cliente";
const ROLES: Rol[] = ["admin", "vendedor", "carpintero", "cliente"];
const ROL_LABEL: Record<Rol, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  carpintero: "Carpintero",
  cliente: "Cliente",
};
const etiqueta = (r?: string | null) => (r ? ROL_LABEL[r as Rol] ?? r : "Sin rol");

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "", password: "", full_name: "", role: "cliente" as Rol, confirmacion: "",
  });

  const mut = useMutation({
    mutationFn: () =>
      createStaffUser({
        email: form.email,
        password: form.password,
        fullName: form.full_name,
        role: form.role,
        confirmacion: form.role === "admin" ? form.confirmacion : undefined,
      }),
    onSuccess: () => {
      toast.success("Usuario creado correctamente");
      setOpen(false);
      setForm({ email: "", password: "", full_name: "", role: "cliente", confirmacion: "" });
      onCreated();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const falta = !form.email || !form.password || !form.full_name;
  const faltaConfirmacion = form.role === "admin" && form.confirmacion !== "ADMIN";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nombre completo</Label>
            <Input
              placeholder="Juan Pérez"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Correo electrónico</Label>
            <Input
              type="email"
              placeholder="juan@email.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Contraseña</Label>
            <Input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Rol }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["cliente", "vendedor", "carpintero", "admin"] as Rol[]).map((r) => (
                  <SelectItem key={r} value={r}>{ROL_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.role === "admin" && (
            <div className="space-y-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <Label>Un administrador tiene acceso total. Escribe ADMIN para confirmar</Label>
              <Input
                value={form.confirmacion}
                onChange={(e) => setForm((f) => ({ ...f, confirmacion: e.target.value }))}
                placeholder="ADMIN"
              />
            </div>
          )}
          <Button
            className="w-full"
            disabled={mut.isPending || falta || faltaConfirmacion}
            onClick={() => mut.mutate()}
          >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Crear usuario
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Cambio = { id: string; nombre: string; actual: Rol | null; nuevo: Rol };

function UsuariosPage() {
  const qc = useQueryClient();
  const { user, roles, loading } = useAuth();
  const isAdmin = roles.includes("admin");

  // Esta guarda es solo de interfaz: la validación real está en la RPC set_user_role y en RLS.
  const { data, isLoading } = useQuery({
    queryKey: ["users"], queryFn: () => listUsers(), enabled: isAdmin, staleTime: 0,
  });
  const audit = useQuery({
    queryKey: ["role-audit"], queryFn: () => listRoleAudit(30), enabled: isAdmin, staleTime: 0,
  });

  const [pendiente, setPendiente] = useState<Cambio | null>(null);
  const [texto, setTexto] = useState("");

  const m = useMutation({
    mutationFn: (v: { user_id: string; role: Rol; confirmacion?: string }) => setUserRole(v),
    onSuccess: () => {
      toast.success("Rol actualizado");
      setPendiente(null);
      setTexto("");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["role-audit"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Sin acceso</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solo los administradores pueden gestionar usuarios y roles.
          </p>
        </Card>
      </div>
    );
  }

  const profiles: any[] = data?.profiles ?? [];
  const nombreDe = (id?: string | null) => {
    if (!id) return "Servidor / SQL";
    const p = profiles.find((x) => x.id === id);
    return p?.full_name || id.slice(0, 8);
  };

  const pedirCambio = (p: any, actual: Rol | null, nuevo: Rol) => {
    if (nuevo === actual) return;
    setTexto("");
    setPendiente({ id: p.id, nombre: p.full_name || "Sin nombre", actual, nuevo });
  };

  const confirmar = () => {
    if (!pendiente) return;
    m.mutate({
      user_id: pendiente.id,
      role: pendiente.nuevo,
      confirmacion: pendiente.nuevo === "admin" ? texto : undefined,
    });
  };

  const describir = (a: any) => {
    const antes = a.antes?.role as string | undefined;
    const despues = a.despues?.role as string | undefined;
    const afectado = (a.despues?.user_id ?? a.antes?.user_id) as string | undefined;
    let cambio: string = a.operacion;
    if (a.operacion === "UPDATE") cambio = `${etiqueta(antes)} → ${etiqueta(despues)}`;
    else if (a.operacion === "INSERT") cambio = `Asignado: ${etiqueta(despues)}`;
    else if (a.operacion === "DELETE") cambio = `Quitado: ${etiqueta(antes)}`;
    else if (a.operacion === "ALTA_USUARIO") cambio = `Usuario creado como ${etiqueta(despues)}`;
    return { afectado, cambio };
  };

  const exigeEscribirAdmin = pendiente?.nuevo === "admin";
  const confirmarDeshabilitado = m.isPending || (exigeEscribirAdmin && texto !== "ADMIN");

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Usuarios</h1>
          <p className="text-muted-foreground">
            Cada usuario tiene un solo rol. El administrador tiene acceso a todo.
          </p>
        </div>
        <CreateUserDialog onCreated={() => {
          qc.invalidateQueries({ queryKey: ["users"] });
          qc.invalidateQueries({ queryKey: ["role-audit"] });
        }} />
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} cols={3} bare />
        ) : (
          <div className="overflow-x-auto -mx-px">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol actual</th>
                  <th className="px-4 py-3 text-right">Cambiar rol</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p: any) => {
                  const rolesDe = (data?.roles ?? [])
                    .filter((r: any) => r.user_id === p.id)
                    .map((r: any) => r.role as Rol);
                  const variosRoles = rolesDe.length > 1;
                  const actual: Rol | null = variosRoles ? null : rolesDe[0] ?? null;
                  const esYo = p.id === user?.id;
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.full_name || "Sin nombre"}</div>
                        {esYo && <div className="text-xs text-muted-foreground">Tú</div>}
                      </td>
                      <td className="px-4 py-3">
                        {variosRoles ? (
                          <div className="space-y-1">
                            <div className="space-x-1">
                              {rolesDe.map((r) => <Badge key={r} variant="secondary">{etiqueta(r)}</Badge>)}
                            </div>
                            <p className="text-xs text-destructive">Tiene varios roles: elige uno para corregirlo.</p>
                          </div>
                        ) : actual ? (
                          <Badge variant="secondary">{etiqueta(actual)}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Sin rol</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Select
                            value={actual ?? undefined}
                            onValueChange={(v) => pedirCambio(p, actual, v as Rol)}
                            disabled={m.isPending || esYo}
                          >
                            <SelectTrigger className="w-44" aria-label={`Rol de ${p.full_name || "usuario"}`}>
                              <SelectValue placeholder={variosRoles ? "Elegir rol" : "Asignar rol"} />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>{ROL_LABEL[r]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold">Historial de cambios de rol</h2>
          <p className="text-xs text-muted-foreground">Últimos 30 movimientos (quién, cuándo y qué).</p>
        </div>
        {audit.isLoading ? (
          <TableSkeleton rows={4} cols={4} bare />
        ) : (audit.data ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Aún no hay cambios registrados.</p>
        ) : (
          <div className="overflow-x-auto -mx-px">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Usuario afectado</th>
                  <th className="px-4 py-2">Cambio</th>
                  <th className="px-4 py-2">Realizado por</th>
                </tr>
              </thead>
              <tbody>
                {(audit.data ?? []).map((a: any) => {
                  const { afectado, cambio } = describir(a);
                  return (
                    <tr key={a.id} className="border-t">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString("es-PE")}
                      </td>
                      <td className="px-4 py-2">{nombreDe(afectado)}</td>
                      <td className="px-4 py-2">{cambio}</td>
                      <td className="px-4 py-2">{nombreDe(a.usuario)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AlertDialog open={!!pendiente} onOpenChange={(o) => { if (!o && !m.isPending) { setPendiente(null); setTexto(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio de rol</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Vas a cambiar el rol de <strong>{pendiente?.nombre}</strong> de{" "}
                  <strong>{etiqueta(pendiente?.actual)}</strong> a <strong>{etiqueta(pendiente?.nuevo)}</strong>.
                  El cambio queda registrado con tu usuario y la fecha.
                </p>
                {pendiente?.actual === "admin" && (
                  <p className="text-destructive">Esta persona perderá el acceso de administrador.</p>
                )}
                {exigeEscribirAdmin && (
                  <div className="space-y-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                    <p className="text-destructive">
                      Un administrador tiene acceso total (ventas, caja, usuarios, proveedores). Escribe ADMIN para confirmar.
                    </p>
                    <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="ADMIN" autoFocus />
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmarDeshabilitado}
              onClick={(e) => { e.preventDefault(); confirmar(); }}
            >
              {m.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar cambio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}