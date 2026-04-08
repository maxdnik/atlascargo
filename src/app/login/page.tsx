import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1565084888279-aca607ecce0c?auto=format&fit=crop&w=2200&q=80')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#061429]/85 via-[#0A2647]/65 to-[#0A2647]/20" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A2647]/20 to-[#061429]/70" />

      <div className="relative w-full max-w-md rounded-2xl border border-white/60 bg-white/95 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-sm">
        <div className="mb-7">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#0A2647]">
            <span className="h-2 w-2 rounded-full bg-[#0A2647]" />
            Plataforma
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0A2647]">ATLAS CARGO</h1>
          <p className="mt-1 text-sm font-medium text-slate-600">Plataforma de Gestion Logistica</p>
          <p className="mt-2 text-sm text-slate-500">
            Accede a tus operaciones, cotizaciones y envios
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
