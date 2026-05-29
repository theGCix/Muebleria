import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUsers, setUserRole } from "@/lib/pos.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, ShieldOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuarios — G&M POS" }] }),
  component: UsuariosPage,
});

const ROLES: Array<"admin" | "vendedor" | "cliente"> = ["admin", "vendedor", "cliente"];

function UsuariosPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["users"], queryFn: () => listUsers() });
  const m = useMutation({
    mutationFn: (v: { user_id: string; role: "admin" | "vendedor" | "cliente"; action: "add" | "remove" }) =>
      setUserRole({ data: v }),
    onSuccess: () => { toast.success("Rol actualizado"); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-3xl font-display font-semibold">Usuarios</h1>
        <p className="text-muted-foreground">Asigna roles a los miembros del equipo</p>
      </div>
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Roles</th><th className="px-4 py-3 text-right">Acciones</th></tr>
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
                      {userRoles.length === 0 ? <span className="text-muted-foreground text-xs">Sin rol</span> :
                        userRoles.map((r: string) => <Badge key={r} variant="secondary">{r}</Badge>)}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}