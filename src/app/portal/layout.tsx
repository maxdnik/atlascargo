import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getRequiredPortalSession } from "@/lib/portal";
import { SignOutButton } from "@/components/layout/sign-out-button";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/portal");
  }
  if (!session.user.isPortalUser) {
    redirect("/dashboard");
  }

  const portalSession = await getRequiredPortalSession();

  const nav = [
    { href: "/portal", label: "Dashboard" },
    { href: "/portal/shipments", label: "Shipments" },
    { href: "/portal/documents", label: "Documents" },
    { href: "/portal/invoices", label: "Invoices" },
    { href: "/portal/tracking", label: "Tracking" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Client Portal</p>
            <h1 className="text-lg font-semibold text-slate-900">{portalSession.companyName}</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-slate-600 sm:block">{portalSession.userName}</p>
            <SignOutButton />
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-7xl flex-wrap gap-2 px-4 pb-4 sm:px-6 lg:px-8">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
