import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import HowItWorksPage from "./pages/HowItWorksPage";
import BecomeHostPage from "./pages/BecomeHostPage";
import OwnerApplicationPage from "./pages/OwnerApplicationPage";
import AdminApplicationsPage from "./pages/AdminApplicationsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminUserDetailPage from "./pages/AdminUserDetailPage";
import VehicleDetailPage from "./pages/VehicleDetailPage";
import OwnerDashboardPage from "./pages/OwnerDashboardPage";
import ProfilePage from "./pages/ProfilePage";
import HelpPage from "./pages/HelpPage";
import AdminSupportPage from "./pages/AdminSupportPage";
import MessagesPage from "./pages/MessagesPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import CancellationPage from "./pages/CancellationPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/como-funciona" element={<HowItWorksPage />} />
            <Route path="/conviertete-en-anfitrion" element={<BecomeHostPage />} />
            <Route path="/aliado/solicitud" element={<OwnerApplicationPage />} />
            <Route path="/admin/solicitudes" element={<AdminApplicationsPage />} />
            <Route path="/admin/usuarios" element={<AdminUsersPage />} />
            <Route path="/admin/usuarios/:userId" element={<AdminUserDetailPage />} />
            <Route path="/vehiculo/:id" element={<VehicleDetailPage />} />
            <Route path="/my-vehicles" element={<OwnerDashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/ayuda" element={<HelpPage />} />
            <Route path="/admin/soporte" element={<AdminSupportPage />} />
            <Route path="/mensajes" element={<MessagesPage />} />
            <Route path="/terminos" element={<TermsPage />} />
            <Route path="/politica-privacidad" element={<PrivacyPage />} />
            <Route path="/politica-cancelacion" element={<CancellationPage />} />
            <Route path="/recuperar-contrasena" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
