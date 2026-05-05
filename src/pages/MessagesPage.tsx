import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { Send, Loader2, MessagesSquare, ArrowLeft, Car as CarIcon } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Conversation = {
  id: string;
  renter_id: string;
  owner_id: string;
  vehicle_id: string | null;
  reservation_id: string | null;
  last_message_at: string;
  created_at: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

type ProfileLite = { user_id: string; full_name: string | null; avatar_url: string | null };
type VehicleLite = { id: string; brand: string; model: string; year: number };

const MessagesPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const activeId = params.get("c");

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [vehicles, setVehicles] = useState<Record<string, VehicleLite>>({});
  const [lastMsgPreview, setLastMsgPreview] = useState<Record<string, string>>({});

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  // Load conversations + related profiles/vehicles
  const loadConversations = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .or(`renter_id.eq.${user.id},owner_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    if (error) {
      toast.error("No se pudieron cargar las conversaciones");
      setLoading(false);
      return;
    }
    const convs = (data || []) as Conversation[];
    setConversations(convs);

    const otherIds = Array.from(new Set(convs.map(c => c.renter_id === user.id ? c.owner_id : c.renter_id)));
    const vehIds = Array.from(new Set(convs.map(c => c.vehicle_id).filter(Boolean) as string[]));

    const [{ data: profs }, { data: vehs }] = await Promise.all([
      otherIds.length
        ? supabase.from("profiles_public" as any).select("user_id, full_name, avatar_url").in("user_id", otherIds)
        : Promise.resolve({ data: [] as ProfileLite[] }),
      vehIds.length
        ? supabase.from("vehicles").select("id, brand, model, year").in("id", vehIds)
        : Promise.resolve({ data: [] as VehicleLite[] }),
    ]);

    const pMap: Record<string, ProfileLite> = {};
    (profs || []).forEach((p: any) => { pMap[p.user_id] = p; });
    setProfiles(pMap);

    const vMap: Record<string, VehicleLite> = {};
    (vehs || []).forEach((v: any) => { vMap[v.id] = v; });
    setVehicles(vMap);

    // fetch last message preview per conv
    if (convs.length) {
      const { data: lastMsgs } = await supabase
        .from("messages")
        .select("conversation_id, content, created_at")
        .in("conversation_id", convs.map(c => c.id))
        .order("created_at", { ascending: false });
      const preview: Record<string, string> = {};
      (lastMsgs || []).forEach((m: any) => {
        if (!preview[m.conversation_id]) preview[m.conversation_id] = m.content;
      });
      setLastMsgPreview(preview);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (user) loadConversations();
    // eslint-disable-next-line
  }, [user]);

  // Realtime: bump list when any conversation updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("conversations-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        loadConversations();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        setLastMsgPreview(prev => ({ ...prev, [m.conversation_id]: m.content }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line
  }, [user]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeId || !user) { setMessages([]); return; }
    setLoadingMessages(true);
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error("No se pudieron cargar los mensajes");
        setMessages((data || []) as Message[]);
        setLoadingMessages(false);
        // mark as read
        supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .eq("conversation_id", activeId)
          .neq("sender_id", user.id)
          .is("read_at", null)
          .then(() => {});
      });

    const ch = supabase
      .channel(`messages-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
          if (m.sender_id !== user.id) {
            supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", m.id).then(() => {});
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const activeConv = useMemo(
    () => conversations.find(c => c.id === activeId) || null,
    [activeId, conversations]
  );

  const otherUser = (c: Conversation) => {
    const id = c.renter_id === user?.id ? c.owner_id : c.renter_id;
    return profiles[id];
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !activeConv || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: activeConv.id,
      sender_id: user.id,
      content: text,
    });
    if (error) {
      toast.error("No se pudo enviar el mensaje");
    } else {
      setDraft("");
    }
    setSending(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-12">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <MessagesSquare className="w-7 h-7 text-primary" />
            Mensajes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Conversa con {user && "el otro usuario"} antes de cerrar la reserva: negocia precios, fechas y dudas.
          </p>
        </div>

        <Card className="overflow-hidden">
          <div className="grid md:grid-cols-[320px_1fr] min-h-[60vh]">
            {/* Conversations list */}
            <div className={cn("border-r border-border", activeId && "hidden md:block")}>
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Aún no tienes conversaciones. Visita un vehículo y pulsa "Contactar".
                </div>
              ) : (
                <ScrollArea className="h-[60vh]">
                  <ul>
                    {conversations.map((c) => {
                      const other = otherUser(c);
                      const veh = c.vehicle_id ? vehicles[c.vehicle_id] : null;
                      const isActive = c.id === activeId;
                      return (
                        <li key={c.id}>
                          <button
                            onClick={() => setParams({ c: c.id })}
                            className={cn(
                              "w-full text-left px-4 py-3 border-b border-border hover:bg-accent/10 transition-colors flex gap-3",
                              isActive && "bg-accent/15"
                            )}
                          >
                            <Avatar className="w-10 h-10 flex-shrink-0">
                              <AvatarImage src={other?.avatar_url || undefined} />
                              <AvatarFallback>{(other?.full_name || "?").charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-sm truncate">
                                  {other?.full_name || "Usuario"}
                                </p>
                                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                  {formatDistanceToNow(new Date(c.last_message_at), { locale: es, addSuffix: false })}
                                </span>
                              </div>
                              {veh && (
                                <Badge variant="secondary" className="text-[10px] mt-0.5 gap-1">
                                  <CarIcon className="w-3 h-3" />
                                  {veh.brand} {veh.model}
                                </Badge>
                              )}
                              <p className="text-xs text-muted-foreground truncate mt-1">
                                {lastMsgPreview[c.id] || "Sin mensajes"}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              )}
            </div>

            {/* Thread */}
            <div className={cn("flex flex-col", !activeId && "hidden md:flex")}>
              {!activeConv ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-8 text-center">
                  Selecciona una conversación para comenzar.
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={() => setParams({})}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={otherUser(activeConv)?.avatar_url || undefined} />
                      <AvatarFallback>
                        {(otherUser(activeConv)?.full_name || "?").charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {otherUser(activeConv)?.full_name || "Usuario"}
                      </p>
                      {activeConv.vehicle_id && vehicles[activeConv.vehicle_id] && (
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => navigate(`/vehiculo/${activeConv.vehicle_id}`)}
                        >
                          {vehicles[activeConv.vehicle_id].brand} {vehicles[activeConv.vehicle_id].model} {vehicles[activeConv.vehicle_id].year}
                        </button>
                      )}
                    </div>
                  </div>

                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                    {loadingMessages ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-8">
                        Envía el primer mensaje para iniciar la conversación.
                      </p>
                    ) : (
                      messages.map((m) => {
                        const mine = m.sender_id === user?.id;
                        return (
                          <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                            <div
                              className={cn(
                                "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                                mine
                                  ? "bg-primary text-primary-foreground rounded-br-sm"
                                  : "bg-card border border-border rounded-bl-sm"
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words">{m.content}</p>
                              <p className={cn(
                                "text-[10px] mt-1",
                                mine ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}>
                                {format(new Date(m.created_at), "HH:mm")}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="p-3 border-t border-border flex gap-2"
                  >
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Escribe un mensaje..."
                      disabled={sending}
                    />
                    <Button type="submit" disabled={!draft.trim() || sending}>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default MessagesPage;
