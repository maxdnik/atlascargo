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
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-slate-500">AtlasCargo</p>
          <h1 className="text-2xl font-semibold text-slate-900">Freight Forwarding Platform</h1>
          <p className="mt-1 text-sm text-slate-600">
            Access operations, quotations and shipment control.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
