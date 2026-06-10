import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Loader2 } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";


export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();

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
        <AppSidebar roles={roles} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-2 border-b bg-background px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="flex-1" />
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </header>
          <main className={isFullscreen ? "flex-1 p-4 overflow-auto" : "flex-1 p-6 overflow-auto"}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
