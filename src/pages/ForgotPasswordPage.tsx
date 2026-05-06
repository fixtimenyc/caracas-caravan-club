import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';

const schema = z.object({ email: z.string().trim().email('Email inválido').max(255) });

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validation = schema.safeParse({ email });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }
    setIsLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsLoading(false);
    if (err) {
      toast.error(err.message);
    } else {
      setSent(true);
      toast.success('Si el email existe, recibirás instrucciones para restablecer tu contraseña.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          onClick={() => navigate('/auth')}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al inicio de sesión
        </Button>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-elegant">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-12 h-12 bg-gradient-hero rounded-xl flex items-center justify-center">
              <Car className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">RuedaVe</span>
          </div>

          <h1 className="text-2xl font-bold text-center text-foreground mb-2">
            Recuperar contraseña
          </h1>
          <p className="text-muted-foreground text-center mb-8">
            Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
          </p>

          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-foreground">
                Revisa tu bandeja de entrada en <strong>{email}</strong>.
              </p>
              <Button onClick={() => navigate('/auth')} className="w-full">
                Volver al inicio de sesión
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
