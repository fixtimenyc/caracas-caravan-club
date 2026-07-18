import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, UserCheck, UserX, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type ReferenceRequest = {
  id: string;
  requester_user_id: string;
  status: 'pending' | 'confirmed' | 'declined';
  message: string | null;
  created_at: string;
  responded_at: string | null;
  requester_name: string;
};

const statusLabels: Record<ReferenceRequest['status'], string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  declined: 'Rechazada',
};

const RenterReferencesPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [requests, setRequests] = useState<ReferenceRequest[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const loadRequests = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('renter_reference_requests')
      .select('id, requester_user_id, status, message, created_at, responded_at')
      .eq('referent_user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const requesterIds = Array.from(
      new Set((data ?? []).map((r) => r.requester_user_id)),
    );
    let namesById: Record<string, string> = {};
    if (requesterIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', requesterIds);
      namesById = Object.fromEntries(
        (profiles ?? []).map((p) => [p.user_id, p.full_name ?? 'Usuario RuedaVe']),
      );
    }

    setRequests(
      (data ?? []).map((r) => ({
        ...r,
        status: r.status as ReferenceRequest['status'],
        requester_name: namesById[r.requester_user_id] ?? 'Usuario RuedaVe',
      })),
    );
    setLoading(false);
  };

  const respond = async (id: string, accept: boolean) => {
    setBusyId(id);
    const { error } = await supabase.rpc('confirm_personal_reference', {
      _request_id: id,
      _accept: accept,
    });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(accept ? 'Referencia confirmada' : 'Referencia rechazada');
    void loadRequests();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>

        <div className="bg-card border border-border rounded-2xl shadow-elegant overflow-hidden">
          <div className="bg-gradient-hero p-6 text-primary-foreground">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-6 h-6" />
              <h1 className="text-xl font-bold">Solicitudes de referencia</h1>
            </div>
            <p className="text-sm opacity-90">
              Personas que te agregaron como referencia personal en RuedaVe.
              Confirmar solo si conoces a la persona.
            </p>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No tienes solicitudes de referencia por el momento.
              </p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {r.requester_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString('es-VE', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        · {statusLabels[r.status]}
                      </p>
                      {r.message && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          "{r.message}"
                        </p>
                      )}
                    </div>
                    {r.status === 'pending' ? (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === r.id}
                          onClick={() => void respond(r.id, false)}
                        >
                          <UserX className="w-4 h-4 mr-1.5" />
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          disabled={busyId === r.id}
                          onClick={() => void respond(r.id, true)}
                        >
                          {busyId === r.id ? (
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          ) : (
                            <UserCheck className="w-4 h-4 mr-1.5" />
                          )}
                          Confirmar
                        </Button>
                      </div>
                    ) : (
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          r.status === 'confirmed'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-destructive/10 text-destructive'
                        }`}
                      >
                        {statusLabels[r.status]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RenterReferencesPage;
