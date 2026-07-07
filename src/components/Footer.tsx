import { Car, Facebook, Instagram, Mail, MapPin, Phone, Twitter } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-foreground text-primary-foreground py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-gradient-accent rounded-xl flex items-center justify-center">
                <Car className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="text-xl font-bold">RuedaVe</span>
            </div>
            <p className="text-primary-foreground/70 text-sm leading-relaxed mb-6">
              La plataforma líder de alquiler de vehículos entre particulares en Venezuela.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 bg-primary-foreground/10 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-smooth">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-primary-foreground/10 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-smooth">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-primary-foreground/10 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-smooth">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-6">Explorar</h4>
            <ul className="space-y-3">
              <li><a href="/" className="text-primary-foreground/70 hover:text-primary-foreground text-sm transition-smooth">Buscar vehículos</a></li>
              <li><a href="/como-funciona" className="text-primary-foreground/70 hover:text-primary-foreground text-sm transition-smooth">Cómo funciona</a></li>
              <li><a href="/conviertete-en-anfitrion" className="text-primary-foreground/70 hover:text-primary-foreground text-sm transition-smooth">Convertirse en anfitrión</a></li>
              <li><a href="/ayuda" className="text-primary-foreground/70 hover:text-primary-foreground text-sm transition-smooth">Centro de ayuda</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-6">Legal</h4>
            <ul className="space-y-3">
              <li><a href="/terminos" className="text-primary-foreground/70 hover:text-primary-foreground text-sm transition-smooth">Términos de uso</a></li>
              <li><a href="/politica-privacidad" className="text-primary-foreground/70 hover:text-primary-foreground text-sm transition-smooth">Política de privacidad</a></li>
              <li><a href="/politica-cancelacion" className="text-primary-foreground/70 hover:text-primary-foreground text-sm transition-smooth">Política de cancelación</a></li>
              <li><a href="/ayuda" className="text-primary-foreground/70 hover:text-primary-foreground text-sm transition-smooth">Seguro</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-6">Contacto</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <span className="text-primary-foreground/70 text-sm">Caracas, Venezuela</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-accent shrink-0" />
                <span className="text-primary-foreground/70 text-sm">+58 412 123 4567</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-accent shrink-0" />
                <span className="text-primary-foreground/70 text-sm">hola@ruedave.com</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-primary-foreground/10 text-center">
          <p className="text-primary-foreground/50 text-sm">
            © 2024 RuedaVe. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
