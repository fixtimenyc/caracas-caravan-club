import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { getLegalOverride, LegalKey } from "@/lib/legalContent";

interface Props {
  title: string;
  subtitle?: string;
  updated?: string;
  children: ReactNode;
  /** If set and admins have saved custom content for this key, that content replaces `children`. */
  overrideKey?: LegalKey;
}

const LegalLayout = ({ title, subtitle, updated = "Mayo 2026", children, overrideKey }: Props) => {
  const override = overrideKey ? getLegalOverride(overrideKey) : "";
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-smooth"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al inicio
          </Link>
          <header className="mb-10 border-b border-border pb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">{title}</h1>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
            <p className="text-xs text-muted-foreground mt-3">
              Documento actualizado: {updated} · Versión 1.0 · RuedaVe C.A.
            </p>
          </header>
          <article
            className="
              prose prose-slate max-w-none
              prose-headings:text-foreground prose-headings:font-semibold
              prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
              prose-p:text-foreground/80 prose-p:leading-relaxed
              prose-li:text-foreground/80
              prose-strong:text-foreground
              prose-table:text-sm prose-th:bg-muted prose-th:text-foreground
              prose-td:align-top
              prose-a:text-primary hover:prose-a:underline
            "
          >
            {children}
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LegalLayout;
