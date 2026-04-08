import { redirect } from "next/navigation";

export default async function LegacyInvoicesPage() {
  redirect("/finance/invoices");
}
