import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Car, Mail, Lock, User, ArrowLeft, Key, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'Nombre muy largo'),
  email: z.string().trim().email('Email inválido').max(255),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(72),
  role: z.enum(['renter', 'owner']),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar los términos y políticas para continuar' }) }),
  acceptedPrivacy: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar la política de privacidad' }) }),
  acceptedCancellation: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar la política de cancelación' }) }),
});

type SignupRole = 'renter' | 'owner';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup';
  const initialRole = (searchParams.get('role') as SignupRole) === 'owner' ? 'owner' : 'renter';

  const [isLogin, setIsLogin] = useState(!initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<SignupRole>(initialRole);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedCancellation, setAcceptedCancellation] = useState(false);

  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      // Determine where to send the user based on their roles + verification state
      const { supabase } = await import('@/integrations/supabase/client');
      const [{ data: rolesData }, { data: verif }, { data: ownerApp }] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase.from('renter_verifications').select('status').eq('user_id', user.id).maybeSingle(),
        supabase.from('owner_applications').select('status').eq('user_id', user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      const userRoles = (rolesData ?? []).map((r) => r.role as string);
      const isOwner = userRoles.includes('owner');
      const isRenter = userRoles.includes('renter');

      // Owner pending application
      if (isRenter && !isOwner && ownerApp && ownerApp.status === 'pending') {
        navigate('/aliado/solicitud');
        return;
      }
      // Renter without verification submitted yet
      if (isRenter && !verif) {
        navigate('/arrendatario/verificacion');
        return;
      }
      navigate('/');
    })();
    return () => { cancelled = true; };
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      if (isLogin) {
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
          const fieldErrors: Record<string, string> = {};
          validation.error.errors.forEach((err) => {
            if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
          });
          setErrors(fieldErrors);
          setIsLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Credenciales inválidas');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('¡Bienvenido!');
          navigate('/');
        }
      } else {
        const validation = signupSchema.safeParse({ fullName, email, password, role, acceptedTerms, acceptedPrivacy, acceptedCancellation });
        if (!validation.success) {
          const fieldErrors: Record<string, string> = {};
          validation.error.errors.forEach((err) => {
            if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
          });
          setErrors(fieldErrors);
          setIsLoading(false);
          return;
        }

        const { error } = await signUp(email, password, fullName, role);
        if (error) {
          if (error.message.includes('User already registered')) {
            toast.error('Este email ya está registrado');
          } else {
            toast.error(error.message);
          }
        } else {
          if (role === 'owner') {
            toast.success('¡Cuenta creada! Completa tu solicitud de aliado.');
            navigate('/aliado/solicitud');
          } else {
            toast.success('¡Cuenta creada! Completa tu verificación de identidad.');
            navigate('/arrendatario/verificacion');
          }
        }
      }
    } catch (error) {
      toast.error('Ocurrió un error inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al inicio
        </Button>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-elegant">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-12 h-12 bg-gradient-hero rounded-xl flex items-center justify-center">
              <Car className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">RuedaVe</span>
          </div>

          <h1 className="text-2xl font-bold text-center text-foreground mb-2">
            {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            {isLogin
              ? 'Ingresa tus credenciales para continuar'
              : 'Elige cómo quieres usar RuedaVe'}
          </p>

          {/* Role selector for signup */}
          {!isLogin && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => setRole('renter')}
                className={cn(
                  'p-4 rounded-xl border-2 text-left transition-smooth',
                  role === 'renter'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center mb-2',
                  role === 'renter' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  <Key className="w-4 h-4" />
                </div>
                <p className="font-semibold text-sm text-foreground">Arrendatario</p>
                <p className="text-xs text-muted-foreground mt-0.5">Quiero rentar un vehículo</p>
              </button>

              <button
                type="button"
                onClick={() => setRole('owner')}
                className={cn(
                  'p-4 rounded-xl border-2 text-left transition-smooth',
                  role === 'owner'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center mb-2',
                  role === 'owner' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  <Handshake className="w-4 h-4" />
                </div>
                <p className="font-semibold text-sm text-foreground">Aliado</p>
                <p className="text-xs text-muted-foreground mt-0.5">Quiero publicar mi carro</p>
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Juan Pérez"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    maxLength={100}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  maxLength={255}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  maxLength={72}
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
              {isLogin && (
                <div className="text-right">
                  <Link
                    to="/recuperar-contrasena"
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              )}
            </div>

            {!isLogin && (
              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-foreground">
                  Para crear tu cuenta, debes leer y aceptar:
                </p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={acceptedTerms}
                    onCheckedChange={(v) => setAcceptedTerms(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-foreground leading-snug">
                    He leído y acepto los{' '}
                    <Link to="/terminos" target="_blank" className="text-primary hover:underline font-medium">
                      Términos y Condiciones
                    </Link>
                  </span>
                </label>
                {errors.acceptedTerms && (
                  <p className="text-xs text-destructive">{errors.acceptedTerms}</p>
                )}
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={acceptedPrivacy}
                    onCheckedChange={(v) => setAcceptedPrivacy(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-foreground leading-snug">
                    He leído y acepto la{' '}
                    <Link to="/politica-privacidad" target="_blank" className="text-primary hover:underline font-medium">
                      Política de Privacidad
                    </Link>
                  </span>
                </label>
                {errors.acceptedPrivacy && (
                  <p className="text-xs text-destructive">{errors.acceptedPrivacy}</p>
                )}
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={acceptedCancellation}
                    onCheckedChange={(v) => setAcceptedCancellation(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-foreground leading-snug">
                    He leído y acepto la{' '}
                    <Link to="/politica-cancelacion" target="_blank" className="text-primary hover:underline font-medium">
                      Política de Cancelación y Reembolsos
                    </Link>
                  </span>
                </label>
                {errors.acceptedCancellation && (
                  <p className="text-xs text-destructive">{errors.acceptedCancellation}</p>
                )}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? 'Cargando...'
                : isLogin
                ? 'Iniciar sesión'
                : role === 'owner'
                ? 'Crear cuenta de aliado'
                : 'Crear cuenta'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
                className="ml-1 text-primary hover:underline font-medium"
              >
                {isLogin ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-muted-foreground text-xs mt-6">
          Al registrarte, aceptas nuestros términos de servicio y política de privacidad
        </p>
      </div>
    </div>
  );
};

export default Auth;
