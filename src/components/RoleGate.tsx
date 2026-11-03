import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth, type AppRole } from "@/hooks/useAuth";

/**
 * Guarda de rol para páginas del panel.
 *
 * Es solo una barrera de interfaz: si alguien la saltara, la RLS y las funciones
 * del servidor siguen rechazando los datos. Mientras el rol no se haya leído del
 * servidor NO se monta la página (así tampoco se disparan sus consultas).
 */
export function RoleGate({ allow, children }: { allow: AppRole[]; children: ReactNode }) {
  const { roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allow.some((r) => roles.includes(r))) {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Sin acceso</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tu rol no tiene permiso para ver esta sección.
          </p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}