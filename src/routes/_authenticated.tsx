import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AdminTopbar } from "@/components/AdminTopbar";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { useNewActivityAlerts } from "@/hooks/useNewActivityAlerts";
import { useSidebarCountsRealtime } from "@/hooks/useSidebarCounts";
import { Loader2 } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";


export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  useNewActivityAlerts(roles);
  useSidebarCountsRealtime(roles);

  const currentPath = useRouterState({ select: (r) => r.location.pathname });
const isFullscreen = currentPath === "/central";

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AppSidebar roles={roles} user={user} />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminTopbar roles={roles} />
          {/* En móvil se deja espacio abajo para la barra de navegación rápida */}
          <main className={`${isFullscreen ? "flex-1 p-4 overflow-auto" : "flex-1 p-6 overflow-auto"} max-md:pb-24`}>
            <Outlet />
          </main>
        </div>
        <MobileBottomBar roles={roles} />
      </div>
    </SidebarProvider>
  );
}
