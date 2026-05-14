import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DollarSign } from "lucide-react";

const MyEarningsPage = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="w-7 h-7 text-primary" />
          <h1 className="text-3xl font-bold">Mis ganancias</h1>
        </div>
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">
            Aquí podrás ver el resumen de tus ganancias por reservas completadas.
          </p>
          <p className="text-sm text-muted-foreground mt-2">Próximamente.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MyEarningsPage;
