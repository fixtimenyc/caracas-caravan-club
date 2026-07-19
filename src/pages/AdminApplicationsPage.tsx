import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Car as CarIcon,
  User as UserIcon,
  MapPin,
  Phone,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type Application = Tables<'owner_applications'>;
type Status = 'pending' | 'approved' | 'rejected';

const statusConfig: Record<Status, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Pendiente', icon: Clock, className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  approved: { label: 'Aprobada', icon: CheckCircle2, className: 'bg-primary/15 text-primary border-primary/30' },
  rejected: { label: 'Rechazada', icon: XCircle, className: 'bg-destructive/15 text-destructive border-destructive/30' },
};

const AdminApplicationsPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, hasRole } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | 'all'>('pending');
  const [selected, setSelected] = useState<Application | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  const fetchApps = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('owner_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Error al cargar solicitudes: ' + error.message);
    } else {
      setApps((data || []) as Application[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && hasRole('admin')) fetchApps();
  }, [user, hasRole]);

  const handleAction = async () => {
    if (!selected || !actionType) return;
    setProcessing(true);
    const newStatus: Status = actionType === 'approve' ? 'approved' : 'rejected';
    const { error } = await supabase
      .from('owner_applications')
      .update({
        status: newStatus,
        admin_notes: adminNotes.trim() || null,
      })
      .eq('id', selected.id);

    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success(
        actionType === 'approve'
          ? '✓ Solicitud aprobada y vehículo creado'
          : 'Solicitud rechazada'
      );
      setSelected(null);
      setActionType(null);
      setAdminNotes('');
      fetchApps();
    }
    setProcessing(false);
  };

  const openDocument = async (path: string | null) => {
    if (!path) {
      toast.error('Documento no disponible');
      return;
    }
    const { data, error } = await supabase.storage
      .from('owner-documents')
      .createSignedUrl(path, 60 * 5);
    if (error || !data) {
      toast.error('No se pudo abrir el documento');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  // Loading auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not admin
  if (user && !hasRole('admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-elegant">
          <div className="w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Acceso restringido</h1>
          <p className="text-muted-foreground mb-6">
            Esta sección es solo para administradores de RuedaVe.
          </p>
          <Button onClick={() => navigate('/')} className="w-full">
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  const filtered = filter === 'all' ? apps : apps.filter((a) => a.status === filter);
  const counts = {
    all: apps.length,
    pending: apps.filter((a) => a.status === 'pending').length,
    approved: apps.filter((a) => a.status === 'approved').length,
    rejected: apps.filter((a) => a.status === 'rejected').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10 py-6 px-4">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Solicitudes de Aliados</h1>
            <p className="text-sm text-muted-foreground">
              Revisa, aprueba o rechaza solicitudes para publicar vehículos
            </p>
          </div>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as Status | 'all')}>
          <TabsList className="mb-4">
            <TabsTrigger value="pending">
              Pendientes <Badge variant="secondary" className="ml-2">{counts.pending}</Badge>
            </TabsTrigger>
            <TabsTrigger value="approved">
              Aprobadas <Badge variant="secondary" className="ml-2">{counts.approved}</Badge>
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rechazadas <Badge variant="secondary" className="ml-2">{counts.rejected}</Badge>
            </TabsTrigger>
            <TabsTrigger value="all">
              Todas <Badge variant="secondary" className="ml-2">{counts.all}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-2xl">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No hay solicitudes en esta categoría</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filtered.map((app) => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    onView={() => {
                      setSelected(app);
                      setActionType(null);
                      setAdminNotes(app.admin_notes || '');
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="text-xl">
                      {selected.vehicle_brand} {selected.vehicle_model} {selected.vehicle_year}
                    </DialogTitle>
                    <DialogDescription>
                      Solicitud creada el{' '}
                      {new Date(selected.created_at).toLocaleDateString('es-VE', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </DialogDescription>
                  </div>
                  <StatusBadge status={selected.status as Status} />
                </div>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <Section title="Datos personales" icon={UserIcon}>
                  <DetailRow label="Cédula" value={selected.cedula} />
                  <DetailRow label="Teléfono" value={selected.phone} icon={Phone} />
                  <DetailRow label="Dirección" value={selected.address} />
                  {selected.birth_date && (
                    <DetailRow
                      label="Nacimiento"
                      value={new Date(selected.birth_date).toLocaleDateString('es-VE')}
                      icon={Calendar}
                    />
                  )}
                </Section>

                <Section title="Vehículo" icon={CarIcon}>
                  <DetailRow label="Placa" value={selected.vehicle_plate} />
                  <DetailRow label="Color" value={selected.vehicle_color || '—'} />
                  <DetailRow label="Combustible" value={selected.fuel_type || '—'} />
                  <DetailRow label="Transmisión" value={selected.transmission || '—'} />
                  <DetailRow
                    label="Kilometraje"
                    value={selected.mileage ? `${selected.mileage.toLocaleString()} km` : '—'}
                  />
                  <DetailRow
                    label="Precio sugerido"
                    value={`$${selected.suggested_price_per_day} USD/día`}
                  />
                  {selected.availability_notes && (
                    <DetailRow label="Notas" value={selected.availability_notes} />
                  )}
                </Section>

                {(selected.driving_license_number || selected.driving_license_expiry || selected.has_medical_condition) && (
                  <Section title="Licencia de conducir" icon={FileText}>
                    <DetailRow label="Número" value={selected.driving_license_number || '—'} />
                    <DetailRow
                      label="Vencimiento"
                      value={
                        selected.driving_license_expiry
                          ? new Date(selected.driving_license_expiry).toLocaleDateString('es-VE')
                          : '—'
                      }
                    />
                    <DetailRow
                      label="Condición médica"
                      value={selected.has_medical_condition ? 'Sí' : 'No'}
                    />
                  </Section>
                )}

                {(selected.own_social_provider ||
                  selected.own_social_verified_name ||
                  selected.personal_reference_email) && (
                  <Section title="Redes sociales y referencia" icon={UserIcon}>
                    <DetailRow label="Proveedor OAuth" value={selected.own_social_provider || '—'} />
                    <DetailRow
                      label="Verificado el"
                      value={
                        selected.own_social_verified_at
                          ? new Date(selected.own_social_verified_at).toLocaleString('es-VE')
                          : '—'
                      }
                    />
                    <DetailRow label="Nombre en red" value={selected.own_social_verified_name || '—'} />
                    <DetailRow label="Email en red" value={selected.own_social_verified_email || '—'} />
                    <DetailRow
                      label="Antigüedad declarada"
                      value={
                        selected.own_social_declared_age_months
                          ? `${selected.own_social_declared_age_months} meses`
                          : '—'
                      }
                    />
                    <DetailRow
                      label="Referencia personal (email)"
                      value={selected.personal_reference_email || '—'}
                    />
                  </Section>
                )}

                <Section title="Documentos" icon={FileText}>
                  <DocLink label="Cédula" path={selected.cedula_doc_url} onOpen={openDocument} />
                  <DocLink label="Certificado de circulación" path={selected.title_doc_url} onOpen={openDocument} />
                  <DocLink label="Póliza de seguro" path={selected.insurance_doc_url} onOpen={openDocument} />
                  <DocLink label="Licencia de conducir" path={selected.driving_license_doc_url} onOpen={openDocument} />
                  <DocLink label="Selfie" path={selected.selfie_url} onOpen={openDocument} />
                  <DocLink label="Factura de servicios" path={selected.utility_bill_url} onOpen={openDocument} />
                  <DocLink label="Referencia bancaria" path={selected.bank_reference_url} onOpen={openDocument} />
                  <DocLink label="Certificado médico" path={selected.medical_certificate_url} onOpen={openDocument} />
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      {selected.vehicle_photos?.length || 0} foto(s) del vehículo
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selected.vehicle_photos?.map((p, i) => (
                        <Button
                          key={p}
                          variant="outline"
                          size="sm"
                          onClick={() => openDocument(p)}
                        >
                          <ExternalLink className="w-3 h-3 mr-1.5" />
                          Foto {i + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                </Section>

                {selected.status === 'pending' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Notas para el aliado (opcional)
                    </label>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Comentarios visibles para el aliado..."
                      rows={3}
                      maxLength={500}
                    />
                  </div>
                )}

                {selected.status !== 'pending' && selected.admin_notes && (
                  <div className="rounded-lg bg-muted/40 border border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Notas del admin
                    </p>
                    <p className="text-sm text-foreground">{selected.admin_notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                {selected.status === 'pending' ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionType('reject');
                        handleAction();
                      }}
                      disabled={processing}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      {processing && actionType === 'reject' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      Rechazar
                    </Button>
                    <Button
                      onClick={() => {
                        setActionType('approve');
                        handleAction();
                      }}
                      disabled={processing}
                    >
                      {processing && actionType === 'approve' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      Aprobar y crear vehículo
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    Cerrar
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// =============== Sub-components ===============

const StatusBadge = ({ status }: { status: Status }) => {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        cfg.className
      )}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

const ApplicationCard = ({
  app,
  onView,
}: {
  app: Application;
  onView: () => void;
}) => (
  <button
    onClick={onView}
    className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-md transition-smooth"
  >
    <div className="flex items-start justify-between gap-4 mb-3">
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-foreground truncate">
          {app.vehicle_brand} {app.vehicle_model} {app.vehicle_year}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Placa {app.vehicle_plate} · {app.vehicle_zone}
        </p>
      </div>
      <StatusBadge status={app.status as Status} />
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Phone className="w-3 h-3" /> {app.phone}
      </span>
      <span>${app.suggested_price_per_day} USD/día</span>
      <span>
        {new Date(app.created_at).toLocaleDateString('es-VE', {
          day: 'numeric',
          month: 'short',
        })}
      </span>
    </div>
  </button>
);

const Section = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof UserIcon;
  children: React.ReactNode;
}) => (
  <div>
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <h3 className="font-semibold text-sm text-foreground">{title}</h3>
    </div>
    <div className="space-y-1.5 pl-6">{children}</div>
  </div>
);

const DetailRow = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof UserIcon;
}) => (
  <div className="flex justify-between gap-4 text-sm">
    <span className="text-muted-foreground flex items-center gap-1.5">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
    <span className="text-foreground text-right">{value}</span>
  </div>
);

const DocLink = ({
  label,
  path,
  onOpen,
}: {
  label: string;
  path: string | null;
  onOpen: (p: string | null) => void;
}) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    {path ? (
      <Button variant="ghost" size="sm" onClick={() => onOpen(path)}>
        <ExternalLink className="w-3 h-3 mr-1.5" />
        Ver
      </Button>
    ) : (
      <span className="text-xs text-muted-foreground italic">No subido</span>
    )}
  </div>
);

export default AdminApplicationsPage;
