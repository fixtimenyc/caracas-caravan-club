import { Car, Menu, User, X, LogOut, ChevronDown, ShieldCheck, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NotificationBell from "@/components/NotificationBell";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, roles, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getRoleLabel = () => {
    if (roles.includes('admin')) return 'Admin';
    if (roles.includes('owner')) return 'Propietario';
    return 'Arrendatario';
  };

  const getRoleBadgeColor = () => {
    if (roles.includes('admin')) return 'bg-destructive/10 text-destructive';
    if (roles.includes('owner')) return 'bg-accent/50 text-accent-foreground';
    return 'bg-primary/10 text-primary';
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 bg-gradient-hero rounded-xl flex items-center justify-center">
              <Car className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">RuedaVe</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => navigate('/como-funciona')} className="text-muted-foreground hover:text-foreground transition-smooth text-sm font-medium">
              Cómo funciona
            </button>
            <button onClick={() => navigate('/conviertete-en-anfitrion')} className="text-muted-foreground hover:text-foreground transition-smooth text-sm font-medium">
              Convertirte en anfitrión
            </button>
            <button onClick={() => navigate('/ayuda')} className="text-muted-foreground hover:text-foreground transition-smooth text-sm font-medium">
              Ayuda
            </button>
            {roles.includes('admin') && (
              <button
                onClick={() => navigate('/admin/solicitudes')}
                className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-smooth text-sm font-medium"
              >
                <ShieldCheck className="w-4 h-4" />
                Solicitudes
              </button>
            )}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            ) : user ? (
              <>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-hero flex items-center justify-center">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor()}`}>
                      {getRoleLabel()}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground">{getRoleLabel()}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="w-4 h-4 mr-2" />
                    Mi perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/mensajes')}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Mensajes
                  </DropdownMenuItem>
                  {roles.includes('owner') || roles.includes('admin') ? (
                    <DropdownMenuItem onClick={() => navigate('/my-vehicles')}>
                      <Car className="w-4 h-4 mr-2" />
                      Mis vehículos
                    </DropdownMenuItem>
                  ) : null}
                  {roles.includes('admin') && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/admin/solicitudes')}>
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Solicitudes de aliados
                      </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/admin/usuarios')}>
                        <User className="w-4 h-4 mr-2" />
                        Administrar usuarios
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/admin/soporte')}>
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Tickets de soporte
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
                  Iniciar sesión
                </Button>
                <Button variant="default" size="sm" onClick={() => navigate('/auth?mode=signup')}>
                  Registrarse
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-4">
              <button onClick={() => { navigate('/como-funciona'); setIsMenuOpen(false); }} className="text-left text-muted-foreground hover:text-foreground transition-smooth text-sm font-medium">
                Cómo funciona
              </button>
              <button onClick={() => { navigate('/conviertete-en-anfitrion'); setIsMenuOpen(false); }} className="text-left text-muted-foreground hover:text-foreground transition-smooth text-sm font-medium">
                Convertirte en anfitrión
              </button>
              <button onClick={() => { navigate('/ayuda'); setIsMenuOpen(false); }} className="text-left text-muted-foreground hover:text-foreground transition-smooth text-sm font-medium">
                Ayuda
              </button>
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                {user ? (
                  <>
                    <div className="flex items-center gap-2 px-2 py-1">
                      <div className="w-8 h-8 rounded-full bg-gradient-hero flex items-center justify-center">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{user.email}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor()}`}>
                          {getRoleLabel()}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="justify-start" onClick={() => navigate('/profile')}>
                      Mi perfil
                    </Button>
                    {(roles.includes('owner') || roles.includes('admin')) && (
                      <Button variant="ghost" size="sm" className="justify-start" onClick={() => navigate('/my-vehicles')}>
                        Mis vehículos
                      </Button>
                    )}
                    {roles.includes('admin') && (
                      <>
                        <Button variant="ghost" size="sm" className="justify-start text-primary" onClick={() => { navigate('/admin/solicitudes'); setIsMenuOpen(false); }}>
                          <ShieldCheck className="w-4 h-4 mr-2" />
                          Solicitudes de aliados
                        </Button>
                        <Button variant="ghost" size="sm" className="justify-start text-primary" onClick={() => { navigate('/admin/usuarios'); setIsMenuOpen(false); }}>
                          <User className="w-4 h-4 mr-2" />
                          Administrar usuarios
                        </Button>
                        <Button variant="ghost" size="sm" className="justify-start text-primary" onClick={() => { navigate('/admin/soporte'); setIsMenuOpen(false); }}>
                          <ShieldCheck className="w-4 h-4 mr-2" />
                          Tickets de soporte
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" className="justify-start text-destructive" onClick={handleSignOut}>
                      Cerrar sesión
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" className="justify-start" onClick={() => navigate('/auth')}>
                      Iniciar sesión
                    </Button>
                    <Button variant="default" size="sm" onClick={() => navigate('/auth?mode=signup')}>
                      Registrarse
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
