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
import VehicleDetailPage from "./pages/VehicleDetailPage";
import OwnerDashboardPage from "./pages/OwnerDashboardPage";
import ProfilePage from "./pages/ProfilePage";
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
            <Route path="/vehiculo/:id" element={<VehicleDetailPage />} />
            <Route path="/my-vehicles" element={<OwnerDashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
