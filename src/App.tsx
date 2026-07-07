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
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminFleetPage from "./pages/AdminFleetPage";
import AdminVehicleDetailPage from "./pages/AdminVehicleDetailPage";
import AdminReservationsPage from "./pages/AdminReservationsPage";
import AdminReservationDetailPage from "./pages/AdminReservationDetailPage";
import AdminReservationContractPage from "./pages/AdminReservationContractPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminUserDetailPage from "./pages/AdminUserDetailPage";
import VehicleDetailPage from "./pages/VehicleDetailPage";
import OwnerDashboardPage from "./pages/OwnerDashboardPage";
import EditVehiclePage from "./pages/EditVehiclePage";
import RenterVerificationPage from "./pages/RenterVerificationPage";
import ProfilePage from "./pages/ProfilePage";
import HelpPage from "./pages/HelpPage";
import AdminSupportPage from "./pages/AdminSupportPage";
import AdminFinancePage from "./pages/AdminFinancePage";
import AdminAnalyticsPage from "./pages/AdminAnalyticsPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AdminAlertsPage from "./pages/AdminAlertsPage";
import AdminMaintenancePage from "./pages/AdminMaintenancePage";
import MessagesPage from "./pages/MessagesPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import MyEarningsPage from "./pages/MyEarningsPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import CancellationPage from "./pages/CancellationPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ReservationInspectionPage from "./pages/ReservationInspectionPage";
import ReservationDetailPage from "./pages/ReservationDetailPage";
import ReservationContractPage from "./pages/ReservationContractPage";
import DemoInspectionPage from "./pages/DemoInspectionPage";
import PrivacySettingsPage from "./pages/PrivacySettingsPage";
import AdminDataPage from "./pages/AdminDataPage";

import PendingReviewsGate from "./components/PendingReviewsGate";
import { useFraudFingerprint } from "@/hooks/useFraudFingerprint";
import NotFound from "./pages/NotFound";

const GlobalListeners = () => {
  useFraudFingerprint();
  return null;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <GlobalListeners />
          
          <PendingReviewsGate />

          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/como-funciona" element={<HowItWorksPage />} />
            <Route path="/conviertete-en-anfitrion" element={<BecomeHostPage />} />
            <Route path="/aliado/solicitud" element={<OwnerApplicationPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/flota" element={<AdminFleetPage />} />
            <Route path="/admin/flota/:vehicleId" element={<AdminVehicleDetailPage />} />
            <Route path="/admin/reservas" element={<AdminReservationsPage />} />
            <Route path="/admin/reservas/:id" element={<AdminReservationDetailPage />} />
            <Route path="/admin/reservas/:id/contrato" element={<AdminReservationContractPage />} />
            <Route path="/admin/solicitudes" element={<AdminApplicationsPage />} />
            <Route path="/admin/usuarios" element={<AdminUsersPage />} />
            <Route path="/admin/usuarios/:userId" element={<AdminUserDetailPage />} />
            <Route path="/vehiculo/:id" element={<VehicleDetailPage />} />
            <Route path="/my-vehicles" element={<OwnerDashboardPage />} />
            <Route path="/my-vehicles/:id/editar" element={<EditVehiclePage />} />
            <Route path="/arrendatario/verificacion" element={<RenterVerificationPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/ayuda" element={<HelpPage />} />
            <Route path="/admin/soporte" element={<AdminSupportPage />} />
            <Route path="/admin/finanzas" element={<AdminFinancePage />} />
            <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
            <Route path="/admin/configuracion" element={<AdminSettingsPage />} />
            <Route path="/admin/alertas" element={<AdminAlertsPage />} />
            <Route path="/admin/mantenimiento" element={<AdminMaintenancePage />} />
            <Route path="/mensajes" element={<MessagesPage />} />
            <Route path="/mis-reservas" element={<MyBookingsPage />} />
            <Route path="/reservas/:id/inspeccion-entrega" element={<ReservationInspectionPage type="pickup" />} />
            <Route path="/reservas/:id/inspeccion-devolucion" element={<ReservationInspectionPage type="return" />} />
            <Route path="/demo/inspeccion" element={<DemoInspectionPage />} />
            <Route path="/mis-ganancias" element={<MyEarningsPage />} />
            <Route path="/terminos" element={<TermsPage />} />
            <Route path="/politica-privacidad" element={<PrivacyPage />} />
            <Route path="/politica-cancelacion" element={<CancellationPage />} />
            <Route path="/recuperar-contrasena" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/perfil/privacidad" element={<PrivacySettingsPage />} />
            <Route path="/admin/datos" element={<AdminDataPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
