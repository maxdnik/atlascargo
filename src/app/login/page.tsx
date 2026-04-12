import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    if (session.user.isPortalUser) {
      redirect("/portal");
    }
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=2400&q=80')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#eef3fb]/95 via-[#e4ecf7]/70 to-[#0a2647]/20" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#f3f7fd]/30 via-transparent to-[#0a2647]/25" />
      <div className="absolute -left-24 top-1/2 h-[38rem] w-[38rem] -translate-y-1/2 rounded-full bg-white/60 blur-3xl" />
      <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-sky-200/30 blur-3xl" />

      <div className="relative w-full max-w-[420px] rounded-2xl border border-slate-300/80 bg-white/95 p-8 shadow-[0_22px_55px_-24px_rgba(10,38,71,0.55)] backdrop-blur">
        <div className="mb-6">
          <div className="mb-3 inline-flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#0A2647] text-sm font-bold text-white">
              AC
            </span>
            <p className="text-[2rem] font-bold leading-none tracking-tight text-[#0A2647]">ATLAS CARGO</p>
          </div>
          <p className="text-[1.35rem] font-semibold leading-tight text-[#173964]">
            Plataforma de Gestión Logística
          </p>
          <p className="mt-1 text-base text-slate-600">
            Accedé a tus operaciones, cotizaciones y envíos
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
