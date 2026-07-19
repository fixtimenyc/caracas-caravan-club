import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car,
  User as UserIcon,
  FileText,
  Upload,
  Check,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CARACAS_ZONES } from '@/lib/locations';
import {
  COUNTRY_CODES,
  toE164,
  isValidE164,
  sendVerificationCode,
  checkVerificationCode,
} from '@/lib/phoneVerification';

const VENEZUELAN_CITIES = [
  'Caracas',
  'Maracaibo',
  'Valencia',
  'Barquisimeto',
  'Maracay',
  'Ciudad Guayana',
  'Maturín',
  'Barcelona',
  'Mérida',
  'San Cristóbal',
  'Otra',
];

const personalSchema = z.object({
  fullName: z.string().trim().min(2, 'Nombre muy corto').max(100),
  cedula: z
    .string()
    .trim()
    .regex(/^[VEvе]-?\d{6,9}$/i, 'Formato: V-12345678'),
  birthDate: z.string().min(1, 'Selecciona tu fecha de nacimiento'),
  phone: z.string().trim().refine(isValidE164, 'Teléfono inválido (formato internacional)'),
  city: z.string().min(1, 'Selecciona tu ciudad'),
  address: z.string().trim().min(5, 'Dirección muy corta').max(300),
});

const vehicleSchema = z.object({
  brand: z.string().trim().min(2, 'Marca requerida').max(50),
  model: z.string().trim().min(1, 'Modelo requerido').max(50),
  year: z.coerce
    .number()
    .min(2010, 'El vehículo debe ser del 2010 o más reciente')
    .max(new Date().getFullYear() + 1),
  plate: z
    .string()
    .trim()
    .min(5, 'Placa requerida')
    .max(10)
    .transform((s) => s.toUpperCase()),
  color: z.string().trim().min(2, 'Color requerido').max(30),
  fuelType: z.string().min(1, 'Selecciona el combustible'),
  transmission: z.string().min(1, 'Selecciona la transmisión'),
  mileage: z.coerce.number().min(0).max(1000000),
  pricePerDay: z.coerce.number().min(5, 'Precio mínimo 5 USD').max(1000),
  zone: z
    .string()
    .min(1, 'Selecciona la zona donde se entrega el vehículo')
    .refine((v) => (CARACAS_ZONES as readonly string[]).includes(v), {
      message: 'Zona inválida',
    }),
  addressDetail: z.string().trim().max(120).optional(),
  availabilityNotes: z.string().max(500).optional(),
});

type PersonalData = z.infer<typeof personalSchema>;
type VehicleData = z.infer<typeof vehicleSchema>;

const OwnerApplicationPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [personal, setPersonal] = useState<PersonalData>({
    fullName: '',
    cedula: '',
    birthDate: '',
    phone: '',
    city: 'Caracas',
    address: '',
  });

  const [vehicle, setVehicle] = useState<VehicleData>({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    plate: '',
    color: '',
    fuelType: '',
    transmission: '',
    mileage: 0,
    pricePerDay: 25,
    zone: '',
    addressDetail: '',
    availabilityNotes: '',
  });

  const [cedulaDoc, setCedulaDoc] = useState<File | null>(null);
  const [titleDoc, setTitleDoc] = useState<File | null>(null);
  const [insuranceDoc, setInsuranceDoc] = useState<File | null>(null);
  const [vehiclePhotos, setVehiclePhotos] = useState<File[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth?mode=signup&role=owner');
      return;
    }
    if (user) {
      supabase
        .from('owner_applications')
        .select('status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setExistingStatus(data.status);
        });
    }
  }, [user, loading, navigate]);

  const steps = [
    { title: 'Datos personales', icon: UserIcon },
    { title: 'Tu vehículo', icon: Car },
    { title: 'Documentos', icon: FileText },
    { title: 'Revisión', icon: CheckCircle2 },
  ];

  const progress = ((step + 1) / steps.length) * 100;

  const handlePersonalNext = () => {
    const result = personalSchema.safeParse(personal);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setStep(1);
  };

  const handleVehicleNext = () => {
    const result = vehicleSchema.safeParse(vehicle);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setStep(2);
  };

  const handleDocumentsNext = () => {
    if (!cedulaDoc || !titleDoc || !insuranceDoc) {
      toast.error('Sube los 3 documentos requeridos');
      return;
    }
    if (vehiclePhotos.length < 3) {
      toast.error('Sube al menos 3 fotos del vehículo');
      return;
    }
    setStep(3);
  };

  const uploadFile = async (file: File, folder: string) => {
    if (!user) throw new Error('No user');
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('owner-documents')
      .upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!acceptedTerms) {
      toast.error('Debes aceptar los términos para continuar');
      return;
    }

    setSubmitting(true);
    try {
      const [cedulaPath, titlePath, insurancePath, photoPaths] =
        await Promise.all([
          uploadFile(cedulaDoc!, 'cedula'),
          uploadFile(titleDoc!, 'title'),
          uploadFile(insuranceDoc!, 'insurance'),
          Promise.all(vehiclePhotos.map((f) => uploadFile(f, 'photos'))),
        ]);

      const { error } = await supabase.from('owner_applications').insert({
        user_id: user.id,
        cedula: personal.cedula,
        birth_date: personal.birthDate,
        city: personal.city,
        address: personal.address,
        phone: personal.phone,
        vehicle_brand: vehicle.brand,
        vehicle_model: vehicle.model,
        vehicle_year: vehicle.year,
        vehicle_plate: vehicle.plate,
        vehicle_color: vehicle.color,
        fuel_type: vehicle.fuelType,
        transmission: vehicle.transmission,
        mileage: vehicle.mileage,
        suggested_price_per_day: vehicle.pricePerDay,
        availability_notes: vehicle.availabilityNotes || null,
        vehicle_zone: vehicle.zone,
        vehicle_address_detail: vehicle.addressDetail || null,
        cedula_doc_url: cedulaPath,
        title_doc_url: titlePath,
        insurance_doc_url: insurancePath,
        vehicle_photos: photoPaths,
        accepted_terms: acceptedTerms,
      });

      // Sync personal data to the user's profile so it shows across the app/admin
      await supabase
        .from('profiles')
        .update({
          full_name: personal.fullName,
          cedula: personal.cedula,
          phone: personal.phone,
          birth_date: personal.birthDate,
          address: personal.address,
        })
        .eq('user_id', user.id);

      if (error) {
        if (error.code === '23505') {
          toast.error('Ya enviaste una solicitud anteriormente');
        } else {
          toast.error(error.message);
        }
        return;
      }

      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (existingStatus || submitted) {
    const status = submitted ? 'pending' : existingStatus!;
    const config = {
      pending: {
        title: '¡Solicitud enviada!',
        desc: 'Recibimos tu solicitud para ser Aliado de RuedaVe. Nuestro equipo la revisará en un plazo de 24 a 48 horas y te notificaremos por correo.',
        color: 'text-primary',
        action: 'Volver al inicio',
        path: '/',
      },
      approved: {
        title: '¡Solicitud aprobada!',
        desc: 'Tu cuenta ya está aprobada como Aliado. Puedes gestionar tus vehículos y reservas desde tu panel.',
        color: 'text-primary',
        action: 'Ir a mis vehículos',
        path: '/my-vehicles',
      },
      rejected: {
        title: 'Solicitud rechazada',
        desc: 'Tu solicitud fue revisada y no pudo ser aprobada. Contacta al equipo de soporte si necesitas más información.',
        color: 'text-destructive',
        action: 'Ir a ayuda',
        path: '/ayuda',
      },
    }[status as 'pending' | 'approved' | 'rejected'];

    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-elegant text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className={cn('w-8 h-8', config.color)} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            {config.title}
          </h1>
          <p className="text-muted-foreground mb-6">
            {config.desc}
          </p>
          <Button onClick={() => navigate(config.path)} className="w-full">
            {config.action}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-4 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>

        <div className="bg-card border border-border rounded-2xl shadow-elegant overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-hero p-6 text-primary-foreground">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-6 h-6" />
              <h1 className="text-xl font-bold">Solicitud de Aliado</h1>
            </div>
            <p className="text-sm opacity-90">
              Completa tu perfil para empezar a generar ingresos con tu vehículo
            </p>
          </div>

          {/* Stepper */}
          <div className="px-6 pt-6">
            <Progress value={progress} className="h-1.5 mb-4" />
            <div className="flex justify-between mb-6">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const active = i === step;
                const done = i < step;
                return (
                  <div
                    key={s.title}
                    className="flex flex-col items-center flex-1"
                  >
                    <div
                      className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center mb-1.5 transition-smooth',
                        done && 'bg-primary text-primary-foreground',
                        active && 'bg-primary/15 text-primary ring-2 ring-primary',
                        !done && !active && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span
                      className={cn(
                        'text-[11px] font-medium text-center',
                        active ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {s.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-6 pb-6">
            {/* Step 0: Personal */}
            {step === 0 && (
              <div className="space-y-4">
                <FieldGroup>
                  <Field
                    label="Nombre completo"
                    error={errors.fullName}
                    htmlFor="fullName"
                  >
                    <Input
                      id="fullName"
                      value={personal.fullName}
                      onChange={(e) =>
                        setPersonal({ ...personal, fullName: e.target.value })
                      }
                      placeholder="Juan Pérez"
                      maxLength={100}
                    />
                  </Field>
                  <Field
                    label="Cédula"
                    error={errors.cedula}
                    htmlFor="cedula"
                    hint="Ej: V-12345678"
                  >
                    <Input
                      id="cedula"
                      value={personal.cedula}
                      onChange={(e) =>
                        setPersonal({ ...personal, cedula: e.target.value })
                      }
                      placeholder="V-12345678"
                      maxLength={12}
                    />
                  </Field>
                </FieldGroup>

                <FieldGroup>
                  <Field
                    label="Fecha de nacimiento"
                    error={errors.birthDate}
                    htmlFor="birthDate"
                  >
                    <Input
                      id="birthDate"
                      type="date"
                      value={personal.birthDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) =>
                        setPersonal({ ...personal, birthDate: e.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label="Teléfono"
                    error={errors.phone}
                    htmlFor="phone"
                    hint="Con código (+58 o 0)"
                  >
                    <Input
                      id="phone"
                      value={personal.phone}
                      onChange={(e) =>
                        setPersonal({ ...personal, phone: e.target.value })
                      }
                      placeholder="04141234567"
                      maxLength={15}
                    />
                  </Field>
                </FieldGroup>

                <Field label="Ciudad" error={errors.city} htmlFor="city">
                  <Select
                    value={personal.city}
                    onValueChange={(v) => setPersonal({ ...personal, city: v })}
                  >
                    <SelectTrigger id="city">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VENEZUELAN_CITIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Dirección"
                  error={errors.address}
                  htmlFor="address"
                >
                  <Textarea
                    id="address"
                    value={personal.address}
                    onChange={(e) =>
                      setPersonal({ ...personal, address: e.target.value })
                    }
                    placeholder="Urbanización, calle, edificio o casa, referencias"
                    rows={2}
                    maxLength={300}
                  />
                </Field>
              </div>
            )}

            {/* Step 1: Vehicle */}
            {step === 1 && (
              <div className="space-y-4">
                <FieldGroup>
                  <Field label="Marca" error={errors.brand} htmlFor="brand">
                    <Input
                      id="brand"
                      value={vehicle.brand}
                      onChange={(e) =>
                        setVehicle({ ...vehicle, brand: e.target.value })
                      }
                      placeholder="Toyota"
                      maxLength={50}
                    />
                  </Field>
                  <Field label="Modelo" error={errors.model} htmlFor="model">
                    <Input
                      id="model"
                      value={vehicle.model}
                      onChange={(e) =>
                        setVehicle({ ...vehicle, model: e.target.value })
                      }
                      placeholder="Corolla"
                      maxLength={50}
                    />
                  </Field>
                </FieldGroup>

                <FieldGroup>
                  <Field label="Año" error={errors.year} htmlFor="year">
                    <Input
                      id="year"
                      type="number"
                      value={vehicle.year}
                      min={2010}
                      max={new Date().getFullYear() + 1}
                      onChange={(e) =>
                        setVehicle({ ...vehicle, year: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Placa" error={errors.plate} htmlFor="plate">
                    <Input
                      id="plate"
                      value={vehicle.plate}
                      onChange={(e) =>
                        setVehicle({
                          ...vehicle,
                          plate: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="AB123CD"
                      maxLength={10}
                    />
                  </Field>
                </FieldGroup>

                <FieldGroup>
                  <Field label="Color" error={errors.color} htmlFor="color">
                    <Input
                      id="color"
                      value={vehicle.color}
                      onChange={(e) =>
                        setVehicle({ ...vehicle, color: e.target.value })
                      }
                      placeholder="Plateado"
                      maxLength={30}
                    />
                  </Field>
                  <Field
                    label="Kilometraje"
                    error={errors.mileage}
                    htmlFor="mileage"
                  >
                    <Input
                      id="mileage"
                      type="number"
                      value={vehicle.mileage}
                      min={0}
                      onChange={(e) =>
                        setVehicle({
                          ...vehicle,
                          mileage: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                </FieldGroup>

                <FieldGroup>
                  <Field
                    label="Combustible"
                    error={errors.fuelType}
                    htmlFor="fuelType"
                  >
                    <Select
                      value={vehicle.fuelType}
                      onValueChange={(v) =>
                        setVehicle({ ...vehicle, fuelType: v })
                      }
                    >
                      <SelectTrigger id="fuelType">
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gasolina">Gasolina</SelectItem>
                        <SelectItem value="diesel">Diésel</SelectItem>
                        <SelectItem value="gnv">GNV</SelectItem>
                        <SelectItem value="hibrido">Híbrido</SelectItem>
                        <SelectItem value="electrico">Eléctrico</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label="Transmisión"
                    error={errors.transmission}
                    htmlFor="transmission"
                  >
                    <Select
                      value={vehicle.transmission}
                      onValueChange={(v) =>
                        setVehicle({ ...vehicle, transmission: v })
                      }
                    >
                      <SelectTrigger id="transmission">
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="automatica">Automática</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </FieldGroup>

                <Field
                  label="Precio sugerido por día (USD)"
                  error={errors.pricePerDay}
                  htmlFor="pricePerDay"
                  hint="Podrás ajustarlo más adelante"
                >
                  <Input
                    id="pricePerDay"
                    type="number"
                    value={vehicle.pricePerDay}
                    min={5}
                    onChange={(e) =>
                      setVehicle({
                        ...vehicle,
                        pricePerDay: Number(e.target.value),
                      })
                    }
                  />
                </Field>

                <FieldGroup>
                  <Field
                    label="Zona donde se entrega el vehículo"
                    error={errors.zone}
                    htmlFor="zone"
                    hint="Coincide con las zonas del buscador"
                  >
                    <Select
                      value={vehicle.zone}
                      onValueChange={(v) => setVehicle({ ...vehicle, zone: v })}
                    >
                      <SelectTrigger id="zone">
                        <SelectValue placeholder="Selecciona una zona" />
                      </SelectTrigger>
                      <SelectContent>
                        {CARACAS_ZONES.map((z) => (
                          <SelectItem key={z} value={z}>
                            {z}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label="Ubicación más precisa (opcional)"
                    error={errors.addressDetail}
                    htmlFor="addressDetail"
                    hint="Calle, edificio o referencia"
                  >
                    <Input
                      id="addressDetail"
                      value={vehicle.addressDetail ?? ''}
                      onChange={(e) =>
                        setVehicle({
                          ...vehicle,
                          addressDetail: e.target.value,
                        })
                      }
                      placeholder="Ej: Av. Luis Roche, frente a la plaza"
                      maxLength={120}
                    />
                  </Field>
                </FieldGroup>
                <Field
                  label="Notas de disponibilidad (opcional)"
                  htmlFor="availabilityNotes"
                >
                  <Textarea
                    id="availabilityNotes"
                    value={vehicle.availabilityNotes}
                    onChange={(e) =>
                      setVehicle({
                        ...vehicle,
                        availabilityNotes: e.target.value,
                      })
                    }
                    placeholder="Ej: disponible solo fines de semana"
                    rows={2}
                    maxLength={500}
                  />
                </Field>
              </div>
            )}

            {/* Step 2: Documents */}
            {step === 2 && (
              <div className="space-y-4">
                <FileUpload
                  label="Cédula de identidad"
                  description="Foto clara de tu cédula (frente)"
                  accept="image/*,application/pdf"
                  file={cedulaDoc}
                  onChange={setCedulaDoc}
                />
                <FileUpload
                  label="Título de propiedad del vehículo"
                  description="Documento que demuestra que eres el dueño"
                  accept="image/*,application/pdf"
                  file={titleDoc}
                  onChange={setTitleDoc}
                />
                <FileUpload
                  label="Póliza de seguro vigente"
                  description="Comprobante de seguro activo"
                  accept="image/*,application/pdf"
                  file={insuranceDoc}
                  onChange={setInsuranceDoc}
                />
                <MultiFileUpload
                  label="Fotos del vehículo"
                  description="Mínimo 3 fotos: frente, lateral e interior"
                  accept="image/*"
                  files={vehiclePhotos}
                  onChange={setVehiclePhotos}
                />
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-4">
                <ReviewSection title="Datos personales">
                  <ReviewRow label="Nombre" value={personal.fullName} />
                  <ReviewRow label="Cédula" value={personal.cedula} />
                  <ReviewRow label="Teléfono" value={personal.phone} />
                  <ReviewRow label="Ciudad" value={personal.city} />
                </ReviewSection>

                <ReviewSection title="Vehículo">
                  <ReviewRow
                    label="Vehículo"
                    value={`${vehicle.brand} ${vehicle.model} ${vehicle.year}`}
                  />
                  <ReviewRow label="Placa" value={vehicle.plate} />
                  <ReviewRow
                    label="Precio/día"
                    value={`$${vehicle.pricePerDay} USD`}
                  />
                </ReviewSection>

                <ReviewSection title="Documentos">
                  <ReviewRow
                    label="Cédula"
                    value={cedulaDoc?.name || '—'}
                  />
                  <ReviewRow
                    label="Título"
                    value={titleDoc?.name || '—'}
                  />
                  <ReviewRow
                    label="Seguro"
                    value={insuranceDoc?.name || '—'}
                  />
                  <ReviewRow
                    label="Fotos"
                    value={`${vehiclePhotos.length} fotos`}
                  />
                </ReviewSection>

                <label className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30 cursor-pointer">
                  <Checkbox
                    checked={acceptedTerms}
                    onCheckedChange={(c) => setAcceptedTerms(c === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-foreground">
                    Confirmo que la información es verídica y acepto los{' '}
                    <span className="text-primary font-medium">
                      términos y condiciones
                    </span>{' '}
                    de Aliado de RuedaVe, incluyendo la comisión del 30% por
                    cada renta.
                  </span>
                </label>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || submitting}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Atrás
              </Button>

              {step < 3 ? (
                <Button
                  onClick={
                    step === 0
                      ? handlePersonalNext
                      : step === 1
                      ? handleVehicleNext
                      : handleDocumentsNext
                  }
                >
                  Continuar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting || !acceptedTerms}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      Enviar solicitud
                      <Check className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============== Helper components ==============

const FieldGroup = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
);

const Field = ({
  label,
  error,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  error?: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
    {hint && !error && (
      <p className="text-xs text-muted-foreground">{hint}</p>
    )}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

const FileUpload = ({
  label,
  description,
  accept,
  file,
  onChange,
}: {
  label: string;
  description: string;
  accept: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) => {
  const id = `file-${label.replace(/\s+/g, '-')}`;
  return (
    <div className="border-2 border-dashed border-border rounded-lg p-4 hover:border-primary/40 transition-smooth">
      <label htmlFor={id} className="cursor-pointer block">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
              file
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {file ? (
              <Check className="w-5 h-5" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {file ? file.name : description}
            </p>
          </div>
        </div>
        <input
          id={id}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </label>
    </div>
  );
};

const MultiFileUpload = ({
  label,
  description,
  accept,
  files,
  onChange,
}: {
  label: string;
  description: string;
  accept: string;
  files: File[];
  onChange: (f: File[]) => void;
}) => {
  const id = `multi-${label.replace(/\s+/g, '-')}`;
  return (
    <div className="border-2 border-dashed border-border rounded-lg p-4 hover:border-primary/40 transition-smooth">
      <label htmlFor={id} className="cursor-pointer block">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
              files.length >= 3
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {files.length >= 3 ? (
              <Check className="w-5 h-5" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {files.length > 0
                ? `${files.length} foto${files.length === 1 ? '' : 's'} seleccionada${files.length === 1 ? '' : 's'}`
                : description}
            </p>
          </div>
        </div>
        <input
          id={id}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) =>
            onChange(e.target.files ? Array.from(e.target.files) : [])
          }
        />
      </label>
    </div>
  );
};

const ReviewSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-lg border border-border p-4">
    <h3 className="font-semibold text-sm text-foreground mb-3">{title}</h3>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const ReviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground font-medium text-right truncate">
      {value}
    </span>
  </div>
);

export default OwnerApplicationPage;
