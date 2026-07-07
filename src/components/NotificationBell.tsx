import { Bell, Check, CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  action_url: string | null;
  reservation_id: string | null;
  vehicle_id: string | null;
  created_at: string;
};

const NotificationBell = () => {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const load = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!error && data) setNotifications(data as Notification[]);
    };
    load();

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev].slice(0, 30));
          toast.success(n.title, { description: n.message });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((x) => (x.id === n.id ? n : x))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
  };

  const onClickNotification = async (n: Notification) => {
    if (!n.read) await markAsRead(n.id);
    setOpen(false);
    if (n.action_url) {
      navigate(n.action_url === "/admin/applications" ? "/admin/solicitudes" : n.action_url);
    } else if (n.vehicle_id) {
      navigate(`/vehiculo/${n.vehicle_id}`);
    } else if (n.reservation_id) {
      navigate(roles.includes("owner") || roles.includes("admin") ? "/my-vehicles" : "/mis-reservas");
    }
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ""}`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notificaciones</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-auto py-1 px-2 text-xs"
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">
                No tienes notificaciones
              </p>
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onClickNotification(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/60 transition-smooth border-l-2 ${
                    n.read
                      ? "border-l-transparent"
                      : "border-l-primary bg-primary/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <p className="text-sm font-medium text-foreground line-clamp-1">
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                    {n.message}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70">
                    {formatDistanceToNow(new Date(n.created_at), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
