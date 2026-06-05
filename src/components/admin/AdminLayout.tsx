import { ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  CalendarDays,
  Users,
  DollarSign,
  Wrench,
  LifeBuoy,
  Settings,
  BarChart3,
  Bell,
  Database,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Gestión de Flota", url: "/admin/flota", icon: Car },
  { title: "Reservas & Calendario", url: "/admin/reservas", icon: CalendarDays },
  { title: "Usuarios", url: "/admin/usuarios", icon: Users },
  { title: "Finanzas & Pagos", url: "/admin/finanzas", icon: DollarSign },
  { title: "Inspecciones & Mantenimiento", url: "/admin/mantenimiento", icon: Wrench },
  { title: "Soporte & Reportes", url: "/admin/soporte", icon: LifeBuoy },
  { title: "Analytics & KPIs", url: "/admin/analytics", icon: BarChart3 },
  { title: "Alertas & Notificaciones", url: "/admin/alertas", icon: Bell },
  { title: "Datos & Monetización", url: "/admin/datos", icon: Database },
  { title: "Configuración", url: "/admin/configuracion", icon: Settings },
];

function AdminSidebar() {
  const { pathname } = useLocation();
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Administración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={pathname === it.url}>
                    <NavLink to={it.url} end className="flex items-center gap-2">
                      <it.icon className="h-4 w-4" />
                      <span>{it.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default function AdminLayout({ children, title }: { children: ReactNode; title: string }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        navigate("/");
      } else {
        setIsAdmin(true);
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate]);

  if (loading || checking || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Cargando" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/20">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center gap-3 border-b bg-background px-4">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">{title}</h1>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
