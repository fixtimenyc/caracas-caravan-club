import { Car, MapPin, Menu, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-hero rounded-xl flex items-center justify-center">
              <Car className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">RuedaVe</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-smooth text-sm font-medium">
              Cómo funciona
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-smooth text-sm font-medium">
              Convertirte en anfitrión
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-smooth text-sm font-medium">
              Ayuda
            </a>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Iniciar sesión
            </Button>
            <Button variant="default" size="sm">
              Registrarse
            </Button>
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
              <a href="#" className="text-muted-foreground hover:text-foreground transition-smooth text-sm font-medium">
                Cómo funciona
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-smooth text-sm font-medium">
                Convertirte en anfitrión
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-smooth text-sm font-medium">
                Ayuda
              </a>
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <Button variant="ghost" size="sm" className="justify-start">
                  Iniciar sesión
                </Button>
                <Button variant="default" size="sm">
                  Registrarse
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
