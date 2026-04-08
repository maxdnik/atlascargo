"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const [email, setEmail] = useState("admin@atlascargo.local");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      setLoading(false);

      if (!result) {
        setError("No hubo respuesta del servidor de autenticacion.");
        return;
      }

      if (result.error) {
        if (result.error === "CredentialsSignin") {
          setError("Email o contrasena incorrectos.");
        } else {
          setError(`No se pudo iniciar sesion: ${result.error}`);
        }
        return;
      }

      if (!result.ok) {
        setError(`No se pudo iniciar sesion (estado ${result.status}).`);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (submitError) {
      setLoading(false);
      setError(
        submitError instanceof Error
          ? `Error inesperado al iniciar sesion: ${submitError.message}`
          : "Error inesperado al iniciar sesion.",
      );
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu.email@empresa.com"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
          Contrasena
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Ingresa tu contrasena"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full rounded-xl bg-[#0A2647] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f325b] disabled:opacity-50"
      >
        {loading ? "Ingresando..." : "Iniciar Sesion"}
      </button>
      <p className="pt-1 text-center text-sm text-slate-500 transition hover:text-slate-700">
        ¿Olvidaste tu contraseña?
      </p>
    </form>
  );
}
