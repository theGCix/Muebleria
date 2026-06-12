import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUsers, setUserRole, createStaffUser } from "@/lib/pos.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Shield, ShieldOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuarios — G&M POS" }] }),
  component: UsuariosPage,
});

const ROLES: Array<"admin" | "vendedor" | "carpintero" | "cliente"> = ["admin", "vendedor", "carpintero", "cliente"];

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "cliente" as "admin" | "vendedor" | "carpintero" | "cliente" });

  const mut = useMutation({
    mutationFn: () => createStaffUser(form),
    onSuccess: () => {
      toast.success("Usuario creado correctamente");
      setOpen(false);
      setForm({ email: "", password: "", full_name: "", role: "cliente" });
      onCreated();
    },
    onError: (e: any) => toast.error(e.message),
  });

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
            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as any }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="vendedor">Vendedor</SelectItem>
                <SelectItem value="carpintero">Carpintero</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            disabled={mut.isPending || !form.email || !form.password || !form.full_name}
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

function UsuariosPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => listUsers() });
  const m = useMutation({
    mutationFn: (v: { user_id: string; role: "admin" | "vendedor" | "carpintero" | "cliente"; action: "add" | "remove" }) =>
      setUserRole(v),
    onSuccess: () => { toast.success("Rol actualizado"); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Usuarios</h1>
          <p className="text-muted-foreground">Gestiona los usuarios y sus roles</p>
        </div>
        <CreateUserDialog onCreated={() => qc.invalidateQueries({ queryKey: ["users"] })} />
      </div>
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto -mx-px">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Roles</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(data?.profiles ?? []).map((p: any) => {
                  const userRoles = (data?.roles ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role);
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.full_name ?? "Sin nombre"}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </td>
                      <td className="px-4 py-3 space-x-1">
                        {userRoles.length === 0
                          ? <span className="text-muted-foreground text-xs">Sin rol</span>
                          : userRoles.map((r: string) => <Badge key={r} variant="secondary">{r}</Badge>)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          {ROLES.map((role) => {
                            const has = userRoles.includes(role);
                            return (
                              <Button
                                key={role}
                                size="sm"
                                variant={has ? "default" : "outline"}
                                disabled={m.isPending}
                                onClick={() => m.mutate({ user_id: p.id, role, action: has ? "remove" : "add" })}
                              >
                                {has ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                                {role}
                              </Button>
                            );
                          })}
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
    </div>
  );
}