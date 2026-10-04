import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { demoPages } from "@/lib/demo-store";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";

// Pathless layout: URL for children stays flat (e.g. /dashboard)
export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, isDemo } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const allowed = !isDemo || !user || demoPages[user.role].includes(pathname.replace(/\/$/, ""));
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    else if (!loading && !allowed) navigate({ to: "/dashboard" });
  }, [loading, user, allowed, navigate]);
  if (loading || !user || !allowed) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
