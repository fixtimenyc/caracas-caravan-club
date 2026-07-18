import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User as UserIcon,
  FileText,
  Phone,
  Users,
  Check,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Upload,
  Mail,
  UserCheck,
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
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  COUNTRY_CODES,
  toE164,
  isValidE164,
  sendVerificationCode,
  checkVerificationCode,
} from '@/lib/phoneVerification';
import { linkSocialInPopup, type LinkedIdentity } from '@/lib/socialIdentity';

const VENEZUELAN_CITIES = [
  'Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Maracay',
  'Ciudad Guayana', 'Maturín', 'Barcelona', 'Mérida', 'San Cristóbal', 'Otra',
];



const personalSchema = z.object({
  fullName: z.string().trim().min(2, 'Nombre muy corto').max(100),
  documentType: z.enum(['cedula', 'pasaporte']),
  documentNumber: z.string().trim().min(5, 'Número inválido').max(20),
  birthDate: z.string().min(1, 'Selecciona tu fecha de nacimiento').refine((v) => {
    const age = (Date.now() - new Date(v).getTime()) / (365.25 * 86400000);
    return age >= 18;
  }, 'Debes ser mayor de 18 años'),
  nationality: z.string().trim().min(2, 'Nacionalidad requerida').max(50),
  gender: z.string().min(1, 'Selecciona una opción'),
  occupation: z.string().trim().min(2, 'Ocupación requerida').max(80),
  employer: z.string().trim().max(100).optional(),
});

const contactSchema = z.object({
  phone: z.string().trim().refine(isValidE164, 'Teléfono inválido (formato internacional)'),
  phoneSecondary: z.string().trim().max(20).optional(),
  contactEmail: z.string().trim().email('Email inválido').max(255).optional().or(z.literal('')),
  address: z.string().trim().min(5, 'Dirección muy corta').max(300),
  city: z.string().min(1, 'Selecciona tu ciudad'),
  state: z.string().trim().max(60).optional(),
  country: z.string().trim().min(2).max(60),
  emergencyContactName: z.string().trim().min(2, 'Nombre requerido').max(100),
  emergencyContactRelationship: z.string().trim().min(2, 'Parentesco requerido').max(40),
  emergencyContactPhone: z.string().trim().regex(/^(\+\d{1,3})?\d{7,15}$/, 'Teléfono inválido'),
});

const licenseSchema = z.object({
  drivingLicenseNumber: z.string().trim().min(4, 'Número de licencia requerido').max(30),
  drivingLicenseExpiry: z.string().min(1, 'Fecha de vencimiento requerida'),
});


type PersonalData = z.infer<typeof personalSchema>;
type ContactData = z.infer<typeof contactSchema>;
type LicenseData = z.infer<typeof licenseSchema>;
const refEmailSchema = z.string().trim().email('Correo inválido').max(255);

const RenterVerificationPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [existingStatus, setExistingStatus] = useState<string | null>(null);

  const [personal, setPersonal] = useState<PersonalData>({
    fullName: '', documentType: 'cedula', documentNumber: '',
    birthDate: '', nationality: 'Venezolana', gender: '',
    occupation: '', employer: '',
  });
  const [contact, setContact] = useState<ContactData>({
    phone: '', phoneSecondary: '', contactEmail: '', address: '',
    city: 'Caracas', state: '', country: 'Venezuela',
    emergencyContactName: '', emergencyContactRelationship: '', emergencyContactPhone: '',
  });
  const [license, setLicense] = useState<LicenseData>({
    drivingLicenseNumber: '', drivingLicenseExpiry: '',
  });
  const [hasMedical, setHasMedical] = useState(false);
  const [linkedSocial, setLinkedSocial] = useState<LinkedIdentity | null>(null);
  const [socialLinking, setSocialLinking] = useState<'google' | 'apple' | 'facebook' | 'instagram' | null>(null);
  const [declaredAgeMonths, setDeclaredAgeMonths] = useState<number>(12);
  const [noSocialAcknowledged, setNoSocialAcknowledged] = useState<boolean>(false);
  const [refEmail, setRefEmail] = useState<string>('');

  const [identityDoc, setIdentityDoc] = useState<File | null>(null);
  const [licenseDoc, setLicenseDoc] = useState<File | null>(null);
  const [medicalDoc, setMedicalDoc] = useState<File | null>(null);
  const [utilityBill, setUtilityBill] = useState<File | null>(null);
  const [bankReference, setBankReference] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Phone verification (SMS) — currently mocked, see src/lib/phoneVerification.ts
  const [phoneCountry, setPhoneCountry] = useState<string>('+58');
  const [phoneLocal, setPhoneLocal] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [sendingOtp, setSendingOtp] = useState<boolean>(false);
  const [checkingOtp, setCheckingOtp] = useState<boolean>(false);
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);

  const isVenezuelan = personal.nationality.trim().toLowerCase().startsWith('venezol');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth?mode=signup&role=renter');
      return;
    }
    if (user) {
      supabase.from('renter_verifications')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setExistingStatus(data.status);
        });
    }
  }, [user, loading, navigate]);

  const steps = [
    { title: 'Personal', icon: UserIcon },
    { title: 'Contacto', icon: Phone },
    { title: 'Licencia', icon: FileText },
    { title: 'Documentos', icon: Upload },
    { title: 'Redes y referencia', icon: Users },
    { title: 'Revisión', icon: CheckCircle2 },
  ];

  const progress = ((step + 1) / steps.length) * 100;

  const runValidation = <T,>(schema: z.ZodSchema<T>, data: T) => {
    const result = schema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSendOtp = async () => {
    const e164 = toE164(phoneCountry, phoneLocal);
    if (!isValidE164(e164)) {
      toast.error('Ingresa un número de teléfono válido');
      return;
    }
    setSendingOtp(true);
    const res = await sendVerificationCode(e164);
    setSendingOtp(false);
    if (!res.ok) {
      toast.error(res.message ?? 'No se pudo enviar el código');
      return;
    }
    setOtpSent(true);
    setPhoneVerified(false);
    setContact((c) => ({ ...c, phone: e164 }));
    toast.success('Código enviado por SMS (modo demo: usa 123456)');
  };

  const handleVerifyOtp = async () => {
    const e164 = toE164(phoneCountry, phoneLocal);
    setCheckingOtp(true);
    const res = await checkVerificationCode(e164, otpCode);
    setCheckingOtp(false);
    if (!res.ok) {
      toast.error(res.message ?? 'Código inválido');
      return;
    }
    setPhoneVerified(true);
    setContact((c) => ({ ...c, phone: e164 }));
    toast.success('Teléfono verificado');
  };

  const handleLinkSocial = async (
    provider: 'google' | 'apple' | 'facebook' | 'instagram',
  ) => {
    setSocialLinking(provider);
    try {
      const identity = await linkSocialInPopup(provider);
      setLinkedSocial(identity);
      setNoSocialAcknowledged(false);
      const providerLabel =
        provider === 'google'
          ? 'Google'
          : provider === 'apple'
            ? 'Apple'
            : provider === 'facebook'
              ? 'Facebook'
              : 'Instagram';
      toast.success(`Identidad verificada con ${providerLabel}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo verificar';
      if (/manual linking/i.test(msg)) {
        toast.error(
          'Función deshabilitada. Un administrador debe habilitar "Manual Linking" en la configuración de Auth.',
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setSocialLinking(null);
    }
  };


  const handleNext = () => {
    if (step === 0 && !runValidation(personalSchema, personal)) return;
    if (step === 1) {
      if (!phoneVerified) {
        toast.error('Verifica tu teléfono con el código SMS antes de continuar');
        return;
      }
      if (!runValidation(contactSchema, contact)) return;
    }
    if (step === 2 && !runValidation(licenseSchema, license)) return;
    if (step === 3) {
      if (!identityDoc || !licenseDoc || !selfie) {
        toast.error('Sube los documentos requeridos (identidad, licencia, selfie)');
        return;
      }
      if (hasMedical && !medicalDoc) {
        toast.error('Sube tu certificado médico');
        return;
      }
    }
    if (step === 4) {
      if (!linkedSocial && !noSocialAcknowledged) {
        toast.error('Verifica con Google/Apple o marca "No dispongo de red"');
        return;
      }
      if (declaredAgeMonths < 6) {
        setErrors({ declaredAgeMonths: 'La cuenta debe tener al menos 6 meses' });
        return;
      }
      if (refEmail.trim().length > 0) {
        const parsed = refEmailSchema.safeParse(refEmail);
        if (!parsed.success) {
          setErrors({ refEmail: parsed.error.errors[0]?.message ?? 'Correo inválido' });
          return;
        }
      }
      setErrors({});
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const uploadFile = async (file: File, folder: string) => {
    if (!user) throw new Error('No user');
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('renter-documents')
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
      const [identityPath, licensePath, selfiePath, medicalPath, utilityPath, bankPath] = await Promise.all([
        uploadFile(identityDoc!, 'identity'),
        uploadFile(licenseDoc!, 'license'),
        uploadFile(selfie!, 'selfie'),
        hasMedical && medicalDoc ? uploadFile(medicalDoc, 'medical') : Promise.resolve(null),
        utilityBill ? uploadFile(utilityBill, 'utility') : Promise.resolve(null),
        bankReference ? uploadFile(bankReference, 'bank') : Promise.resolve(null),
      ]);

      const { data: inserted, error } = await supabase
        .from('renter_verifications')
        .insert({
          user_id: user.id,
          full_name: personal.fullName,
          document_type: personal.documentType,
          document_number: personal.documentNumber,
          birth_date: personal.birthDate,
          nationality: personal.nationality,
          gender: personal.gender,
          occupation: personal.occupation,
          employer: personal.employer || null,
          phone: contact.phone,
          phone_secondary: contact.phoneSecondary || null,
          contact_email: contact.contactEmail || null,
          address: contact.address,
          city: contact.city,
          state: contact.state || null,
          country: contact.country,
          emergency_contact_name: contact.emergencyContactName,
          emergency_contact_relationship: contact.emergencyContactRelationship,
          emergency_contact_phone: contact.emergencyContactPhone,
          driving_license_number: license.drivingLicenseNumber,
          driving_license_expiry: license.drivingLicenseExpiry,
          has_medical_condition: hasMedical,
          identity_doc_url: identityPath,
          driving_license_doc_url: licensePath,
          medical_certificate_url: medicalPath,
          utility_bill_url: utilityPath,
          bank_reference_url: bankPath,
          selfie_url: selfiePath,
          own_social_provider: linkedSocial?.provider ?? null,
          own_social_provider_user_id: linkedSocial?.providerUserId ?? null,
          own_social_verified_at: linkedSocial ? new Date().toISOString() : null,
          own_social_verified_name: linkedSocial?.name ?? null,
          own_social_verified_email: linkedSocial?.email ?? null,
          own_social_verified_picture: linkedSocial?.picture ?? null,
          own_social_declared_age_months: declaredAgeMonths,
          accepted_terms: acceptedTerms,
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          if (error.message.includes('renter_verifications_social_provider_unique')) {
            toast.error('Esta cuenta social ya fue usada por otro usuario');
          } else {
            toast.error('Ya enviaste tu verificación anteriormente');
          }
        } else {
          toast.error(error.message);
        }
        return;
      }
      // Sync profile with key fields
      await supabase.from('profiles').update({
        full_name: personal.fullName,
        phone: contact.phone,
        cedula: personal.documentNumber,
        address: contact.address,
        birth_date: personal.birthDate,
      }).eq('user_id', user.id);

      // Optional: send personal reference request
      if (refEmail.trim().length > 0 && inserted?.id) {
        const { error: refError } = await supabase.rpc(
          'request_personal_reference',
          {
            _verification_id: inserted.id,
            _email: refEmail.trim(),
            _message: null,
          },
        );
        if (refError) {
          toast.error(
            `Verificación enviada, pero la referencia no se envió: ${refError.message}`,
          );
        } else {
          toast.success('Referencia enviada. Esperando confirmación del referente.');
        }
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
      pending: { title: '¡Verificación enviada!', desc: 'Tu solicitud está en revisión. Te notificaremos en 24-48 horas.', color: 'text-primary' },
      approved: { title: '¡Verificación aprobada!', desc: 'Ya puedes alquilar vehículos en RuedaVe.', color: 'text-primary' },
      rejected: { title: 'Verificación rechazada', desc: 'Contacta al equipo de soporte para más información.', color: 'text-destructive' },
    }[status as 'pending' | 'approved' | 'rejected'];

    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-elegant text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className={cn("w-8 h-8", config.color)} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">{config.title}</h1>
          <p className="text-muted-foreground mb-6">{config.desc}</p>
          <Button onClick={() => navigate('/')} className="w-full">
            Volver al inicio
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
          <div className="bg-gradient-hero p-6 text-primary-foreground">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-6 h-6" />
              <h1 className="text-xl font-bold">Verificación de Arrendatario</h1>
            </div>
            <p className="text-sm opacity-90">
              Completa este cuestionario para verificar tu identidad y poder alquilar vehículos
            </p>
          </div>

          <div className="px-6 pt-6">
            <Progress value={progress} className="h-1.5 mb-4" />
            <div className="flex justify-between mb-6 overflow-x-auto gap-2">
              {steps.map((s, i) => {
                const Icon = s.icon;
                const active = i === step;
                const done = i < step;
                return (
                  <div key={s.title} className="flex flex-col items-center flex-1 min-w-[60px]">
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center mb-1.5 transition-smooth',
                      done && 'bg-primary text-primary-foreground',
                      active && 'bg-primary/15 text-primary ring-2 ring-primary',
                      !done && !active && 'bg-muted text-muted-foreground'
                    )}>
                      {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium text-center leading-tight',
                      active ? 'text-foreground' : 'text-muted-foreground'
                    )}>
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
                <Field label="Nombre completo" error={errors.fullName} htmlFor="fullName">
                  <Input id="fullName" value={personal.fullName} maxLength={100}
                    onChange={(e) => setPersonal({ ...personal, fullName: e.target.value })}
                    placeholder="Juan Pérez" />
                </Field>
                <FieldGroup>
                  <Field label="Tipo de documento" error={errors.documentType} htmlFor="documentType">
                    <Select value={personal.documentType}
                      onValueChange={(v) => setPersonal({ ...personal, documentType: v as 'cedula' | 'pasaporte' })}>
                      <SelectTrigger id="documentType"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cedula">Cédula</SelectItem>
                        <SelectItem value="pasaporte">Pasaporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Número" error={errors.documentNumber} htmlFor="documentNumber">
                    <Input id="documentNumber" value={personal.documentNumber} maxLength={20}
                      onChange={(e) => setPersonal({ ...personal, documentNumber: e.target.value })}
                      placeholder={personal.documentType === 'cedula' ? 'V-12345678' : 'AB1234567'} />
                  </Field>
                </FieldGroup>
                <FieldGroup>
                  <Field label="Fecha de nacimiento" error={errors.birthDate} htmlFor="birthDate">
                    <Input id="birthDate" type="date" value={personal.birthDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setPersonal({ ...personal, birthDate: e.target.value })} />
                  </Field>
                  <Field label="Nacionalidad" error={errors.nationality} htmlFor="nationality">
                    <Input id="nationality" value={personal.nationality} maxLength={50}
                      onChange={(e) => setPersonal({ ...personal, nationality: e.target.value })} />
                  </Field>
                </FieldGroup>
                <Field label="Género" error={errors.gender} htmlFor="gender">
                  <Select value={personal.gender} onValueChange={(v) => setPersonal({ ...personal, gender: v })}>
                    <SelectTrigger id="gender"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="femenino">Femenino</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                      <SelectItem value="prefiero_no_decir">Prefiero no decir</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <FieldGroup>
                  <Field label="Ocupación / Profesión" error={errors.occupation} htmlFor="occupation">
                    <Input id="occupation" value={personal.occupation} maxLength={80}
                      onChange={(e) => setPersonal({ ...personal, occupation: e.target.value })}
                      placeholder="Ej: Ingeniero" />
                  </Field>
                  <Field label="Empleador (opcional)" error={errors.employer} htmlFor="employer">
                    <Input id="employer" value={personal.employer} maxLength={100}
                      onChange={(e) => setPersonal({ ...personal, employer: e.target.value })}
                      placeholder="Empresa donde trabajas" />
                  </Field>
                </FieldGroup>
              </div>
            )}

            {/* Step 1: Contacto */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-semibold">Teléfono principal</Label>
                    {phoneVerified && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <ShieldCheck className="w-3.5 h-3.5" /> Verificado
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-[140px_1fr] gap-2">
                    <Select
                      value={phoneCountry}
                      onValueChange={(v) => {
                        setPhoneCountry(v);
                        setPhoneVerified(false);
                        setOtpSent(false);
                      }}
                      disabled={phoneVerified}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {COUNTRY_CODES.map((c) => (
                          <SelectItem key={c.iso} value={c.code}>
                            <span className="mr-2">{c.flag}</span>
                            {c.code} <span className="text-muted-foreground ml-1">{c.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="phone"
                      inputMode="tel"
                      value={phoneLocal}
                      maxLength={15}
                      onChange={(e) => {
                        setPhoneLocal(e.target.value.replace(/[^\d]/g, ''));
                        setPhoneVerified(false);
                        setOtpSent(false);
                      }}
                      placeholder={
                        COUNTRY_CODES.find((c) => c.code === phoneCountry)?.example ?? '4141234567'
                      }
                      disabled={phoneVerified}
                    />
                  </div>
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}

                  {!phoneVerified && (
                    <div className="space-y-3">
                      {!otpSent ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={handleSendOtp}
                          disabled={sendingOtp || phoneLocal.length < 7}
                        >
                          {sendingOtp ? (
                            <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Enviando...</>
                          ) : (
                            'Enviar código SMS'
                          )}
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Ingresa el código de 6 dígitos que recibiste por SMS.{' '}
                            <span className="italic">(Modo demo: usa <code className="font-mono">123456</code>)</span>
                          </p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                              <InputOTPGroup>
                                {[0, 1, 2, 3, 4, 5].map((i) => (
                                  <InputOTPSlot key={i} index={i} />
                                ))}
                              </InputOTPGroup>
                            </InputOTP>
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleVerifyOtp}
                              disabled={checkingOtp || otpCode.length !== 6}
                            >
                              {checkingOtp ? (
                                <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Verificando...</>
                              ) : (
                                'Verificar'
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={handleSendOtp}
                              disabled={sendingOtp}
                            >
                              Reenviar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Field label="Teléfono secundario (opcional)" htmlFor="phoneSecondary">
                  <Input id="phoneSecondary" value={contact.phoneSecondary} maxLength={20}
                    onChange={(e) => setContact({ ...contact, phoneSecondary: e.target.value })}
                    placeholder="+58 4141234567" />
                </Field>
                <Field label="Email de contacto (opcional)" error={errors.contactEmail} htmlFor="contactEmail"
                  hint="Si difiere de tu email de cuenta">
                  <Input id="contactEmail" type="email" value={contact.contactEmail} maxLength={255}
                    onChange={(e) => setContact({ ...contact, contactEmail: e.target.value })} />
                </Field>
                <Field label="Dirección completa" error={errors.address} htmlFor="address">
                  <Textarea id="address" value={contact.address} rows={2} maxLength={300}
                    onChange={(e) => setContact({ ...contact, address: e.target.value })}
                    placeholder="Urbanización, calle, edificio o casa, referencias" />
                </Field>
                <FieldGroup>
                  <Field label="Ciudad" error={errors.city} htmlFor="city">
                    <Select value={contact.city} onValueChange={(v) => setContact({ ...contact, city: v })}>
                      <SelectTrigger id="city"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VENEZUELAN_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Estado" htmlFor="state">
                    <Input id="state" value={contact.state} maxLength={60}
                      onChange={(e) => setContact({ ...contact, state: e.target.value })}
                      placeholder="Distrito Capital" />
                  </Field>
                </FieldGroup>
                <Field label="País" error={errors.country} htmlFor="country">
                  <Input id="country" value={contact.country} maxLength={60}
                    onChange={(e) => setContact({ ...contact, country: e.target.value })} />
                </Field>

                <div className="pt-4 border-t border-border">
                  <h3 className="font-semibold text-sm mb-3 text-foreground">Contacto de emergencia</h3>
                  <div className="space-y-4">
                    <FieldGroup>
                      <Field label="Nombre completo" error={errors.emergencyContactName} htmlFor="ecn">
                        <Input id="ecn" value={contact.emergencyContactName} maxLength={100}
                          onChange={(e) => setContact({ ...contact, emergencyContactName: e.target.value })} />
                      </Field>
                      <Field label="Parentesco" error={errors.emergencyContactRelationship} htmlFor="ecr">
                        <Input id="ecr" value={contact.emergencyContactRelationship} maxLength={40}
                          onChange={(e) => setContact({ ...contact, emergencyContactRelationship: e.target.value })}
                          placeholder="Madre, hermano, etc." />
                      </Field>
                    </FieldGroup>
                    <Field label="Teléfono" error={errors.emergencyContactPhone} htmlFor="ecp">
                      <Input id="ecp" value={contact.emergencyContactPhone} maxLength={20}
                        onChange={(e) => setContact({ ...contact, emergencyContactPhone: e.target.value })}
                        placeholder="04141234567" />
                    </Field>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Licencia */}
            {step === 2 && (
              <div className="space-y-4">
                <FieldGroup>
                  <Field label="Número de licencia de conducir" error={errors.drivingLicenseNumber} htmlFor="dln">
                    <Input id="dln" value={license.drivingLicenseNumber} maxLength={30}
                      onChange={(e) => setLicense({ ...license, drivingLicenseNumber: e.target.value })} />
                  </Field>
                  <Field label="Vencimiento" error={errors.drivingLicenseExpiry} htmlFor="dle">
                    <Input id="dle" type="date" value={license.drivingLicenseExpiry}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setLicense({ ...license, drivingLicenseExpiry: e.target.value })} />
                  </Field>
                </FieldGroup>
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div>
                    <Label className="text-sm font-semibold">¿Tienes alguna condición médica relevante?</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Si aplica, te pediremos un certificado médico vigente
                    </p>
                  </div>
                  <Switch checked={hasMedical} onCheckedChange={setHasMedical} />
                </div>
              </div>
            )}

            {/* Step 3: Documentos */}
            {step === 3 && (
              <div className="space-y-4">
                <FileField
                  label="Documento de identidad (cédula o pasaporte)"
                  hint="Foto clara y legible (PDF, JPG o PNG)"
                  file={identityDoc} onChange={setIdentityDoc}
                />
                <FileField
                  label="Licencia de conducir"
                  hint="Foto frontal de la licencia"
                  file={licenseDoc} onChange={setLicenseDoc}
                />
                <FileField
                  label="Selfie sosteniendo tu cédula"
                  hint="Tu rostro y cédula deben verse claramente"
                  file={selfie} onChange={setSelfie}
                  accept="image/*"
                />

                <div className="pt-4 border-t border-border">
                  <h3 className="font-semibold text-sm text-foreground mb-1">
                    Documentos opcionales
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    No son obligatorios, pero ayudan a acelerar tu verificación.
                  </p>
                  <div className="space-y-4">
                    <FileField
                      label="Factura de servicios (opcional)"
                      hint="Recibo reciente de luz, agua, internet o teléfono a tu nombre"
                      file={utilityBill} onChange={setUtilityBill}
                    />
                    <FileField
                      label="Referencia bancaria (opcional)"
                      hint="Carta o constancia emitida por tu banco"
                      file={bankReference} onChange={setBankReference}
                    />
                    {(hasMedical || isVenezuelan) && (
                      <FileField
                        label={
                          hasMedical
                            ? 'Certificado médico'
                            : 'Certificado médico (opcional para venezolanos)'
                        }
                        hint="Documento vigente expedido por médico autorizado"
                        file={medicalDoc} onChange={setMedicalDoc}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Red social + referencia */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-sm text-foreground mb-1">
                    Verifica tu identidad con una red social
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Inicia sesión con Google, Apple, Facebook o Instagram para
                    vincular una identidad digital verificada a tu perfil. La
                    misma cuenta no puede reutilizarse en otra verificación.
                  </p>

                  {linkedSocial ? (
                    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 flex items-start gap-3">
                      {linkedSocial.picture ? (
                        <img
                          src={linkedSocial.picture}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
                          <Check className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          Verificado con{' '}
                          {linkedSocial.provider === 'google'
                            ? 'Google'
                            : linkedSocial.provider === 'apple'
                              ? 'Apple'
                              : linkedSocial.provider === 'facebook'
                                ? 'Facebook'
                                : 'Instagram'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {linkedSocial.name || linkedSocial.email || 'Identidad confirmada'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLinkedSocial(null)}
                      >
                        Cambiar
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="justify-center"
                        disabled={socialLinking !== null}
                        onClick={() => void handleLinkSocial('google')}
                      >
                        {socialLinking === 'google' ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <span className="mr-2 font-bold text-[#4285F4]">G</span>
                        )}
                        Continuar con Google
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="justify-center"
                        disabled={socialLinking !== null}
                        onClick={() => void handleLinkSocial('apple')}
                      >
                        {socialLinking === 'apple' ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <span className="mr-2 font-bold text-foreground"></span>
                        )}
                        Continuar con Apple
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="justify-center"
                        disabled={socialLinking !== null}
                        onClick={() => void handleLinkSocial('facebook')}
                      >
                        {socialLinking === 'facebook' ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <span className="mr-2 font-bold text-[#1877F2]">f</span>
                        )}
                        Continuar con Facebook
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="justify-center"
                        disabled={socialLinking !== null}
                        onClick={() => void handleLinkSocial('instagram')}
                      >
                        {socialLinking === 'instagram' ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <span
                            className="mr-2 font-bold bg-clip-text text-transparent"
                            style={{
                              backgroundImage:
                                'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
                            }}
                          >
                            IG
                          </span>
                        )}
                        Continuar con Instagram
                      </Button>
                      <p className="text-[11px] text-muted-foreground sm:col-span-2 -mt-1">
                        Instagram requiere que tu cuenta esté configurada como
                        Business o Creator y enlazada a una página de Facebook.
                      </p>
                    </div>
                  )}

                  <div className="mt-4">
                    <Field
                      label="Antigüedad declarada de tu cuenta (meses)"
                      hint="Nuestro equipo verificará esta declaración durante la revisión."
                      error={errors.declaredAgeMonths}
                      htmlFor="dam"
                    >
                      <Input
                        id="dam"
                        type="number"
                        min={6}
                        value={declaredAgeMonths}
                        onChange={(e) => setDeclaredAgeMonths(Number(e.target.value))}
                      />
                    </Field>
                  </div>

                  {!linkedSocial && (
                    <label className="mt-3 flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer">
                      <Checkbox
                        checked={noSocialAcknowledged}
                        onCheckedChange={(c) => setNoSocialAcknowledged(!!c)}
                        className="mt-0.5"
                      />
                      <span className="text-xs text-muted-foreground">
                        No dispongo de una cuenta de Google o Apple para verificar.
                        Entiendo que mi solicitud quedará en revisión manual del
                        equipo.
                      </span>
                    </label>
                  )}
                </div>

                <div className="pt-4 border-t border-border">
                  <h3 className="font-semibold text-sm text-foreground mb-1">
                    Referencia personal (opcional)
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Agrega el correo de alguien que ya use RuedaVe. Recibirá una
                    notificación para confirmar que te conoce cuando envíes esta
                    verificación. <b>Es opcional, pero ayuda a acelerar tu
                    verificación.</b>
                  </p>
                  <Field
                    label="Correo del referente"
                    error={errors.refEmail}
                    htmlFor="ref-email"
                  >
                    <Input
                      id="ref-email"
                      type="email"
                      placeholder="referente@correo.com"
                      value={refEmail}
                      onChange={(e) => setRefEmail(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* Step 5: Revisión */}
            {step === 5 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Revisa tu información antes de enviar. Una vez enviada, tu solicitud
                  será revisada por nuestro equipo en 24-48 horas.
                </p>
                <ReviewBlock title="Datos personales">
                  <ReviewItem label="Nombre" value={personal.fullName} />
                  <ReviewItem label={`Documento (${personal.documentType})`} value={personal.documentNumber} />
                  <ReviewItem label="Nacimiento" value={personal.birthDate} />
                  <ReviewItem label="Nacionalidad" value={personal.nationality} />
                  <ReviewItem label="Ocupación" value={personal.occupation} />
                </ReviewBlock>
                <ReviewBlock title="Contacto">
                  <ReviewItem label="Teléfono" value={contact.phone} />
                  <ReviewItem label="Dirección" value={`${contact.address}, ${contact.city}`} />
                  <ReviewItem label="Emergencia" value={`${contact.emergencyContactName} (${contact.emergencyContactRelationship}) ${contact.emergencyContactPhone}`} />
                </ReviewBlock>
                <ReviewBlock title="Licencia">
                  <ReviewItem label="Número" value={license.drivingLicenseNumber} />
                  <ReviewItem label="Vence" value={license.drivingLicenseExpiry} />
                  <ReviewItem label="Condición médica" value={hasMedical ? 'Sí' : 'No'} />
                </ReviewBlock>
                <ReviewBlock title="Documentos cargados">
                  <ReviewItem label="Identidad" value={identityDoc?.name} />
                  <ReviewItem label="Licencia" value={licenseDoc?.name} />
                  <ReviewItem label="Selfie" value={selfie?.name} />
                  {hasMedical && <ReviewItem label="Médico" value={medicalDoc?.name} />}
                  {!hasMedical && medicalDoc && <ReviewItem label="Médico (opcional)" value={medicalDoc.name} />}
                  {utilityBill && <ReviewItem label="Factura de servicios" value={utilityBill.name} />}
                  {bankReference && <ReviewItem label="Referencia bancaria" value={bankReference.name} />}
                </ReviewBlock>
                <ReviewBlock title="Red social">
                  {linkedSocial ? (
                    <>
                      <ReviewItem
                        label="Proveedor"
                        value={linkedSocial.provider === 'google' ? 'Google' : 'Apple'}
                      />
                      <ReviewItem
                        label="Cuenta"
                        value={linkedSocial.email || linkedSocial.name}
                      />
                      <ReviewItem
                        label="Antigüedad declarada"
                        value={`${declaredAgeMonths} meses`}
                      />
                    </>
                  ) : (
                    <ReviewItem
                      label="Estado"
                      value="Sin verificar — revisión manual del equipo"
                    />
                  )}
                </ReviewBlock>
                <ReviewBlock title="Referencia personal">
                  <ReviewItem
                    label="Correo"
                    value={refEmail || 'No agregada (opcional)'}
                  />
                </ReviewBlock>

                <label className="flex items-start gap-2 p-4 rounded-lg border border-border cursor-pointer">
                  <Checkbox checked={acceptedTerms}
                    onCheckedChange={(c) => setAcceptedTerms(!!c)} className="mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    Confirmo que toda la información proporcionada es verídica y acepto los{' '}
                    <a href="/terminos" target="_blank" className="text-primary hover:underline">términos de uso</a>,{' '}
                    <a href="/politica-privacidad" target="_blank" className="text-primary hover:underline">política de privacidad</a> y{' '}
                    <a href="/politica-cancelacion" target="_blank" className="text-primary hover:underline">política de cancelación</a> de RuedaVe.
                  </span>
                </label>
              </div>
            )}

            <div className="flex justify-between gap-3 pt-6 mt-6 border-t border-border">
              <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || submitting}>
                Atrás
              </Button>
              {step < steps.length - 1 ? (
                <Button onClick={handleNext}>Continuar</Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting || !acceptedTerms}>
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : 'Enviar verificación'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FieldGroup = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
);

const Field = ({
  label, error, hint, htmlFor, children,
}: {
  label: string; error?: string; hint?: string; htmlFor?: string; children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor} className="text-sm">{label}</Label>
    {children}
    {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

const FileField = ({
  label, hint, file, onChange, accept = 'image/*,application/pdf',
}: {
  label: string; hint?: string; file: File | null;
  onChange: (f: File | null) => void; accept?: string;
}) => (
  <div className="space-y-1.5">
    <Label className="text-sm">{label}</Label>
    <label className={cn(
      'flex items-center gap-3 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-smooth',
      file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
    )}>
      <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {file ? file.name : 'Haz clic para subir'}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <input type="file" accept={accept} className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] || null)} />
    </label>
  </div>
);

const ReviewBlock = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg border border-border p-4">
    <h4 className="font-semibold text-sm mb-2 text-foreground">{title}</h4>
    <div className="space-y-1">{children}</div>
  </div>
);

const ReviewItem = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex justify-between gap-3 text-sm">
    <span className="text-muted-foreground">{label}:</span>
    <span className="text-foreground text-right truncate max-w-[60%]">{value || '—'}</span>
  </div>
);

export default RenterVerificationPage;
