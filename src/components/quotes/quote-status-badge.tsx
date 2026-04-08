import type { QuoteStatus } from "@prisma/client";

const statusConfig: Record<QuoteStatus, { label: string; className: string }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-slate-100 text-slate-700",
  },
  SENT: {
    label: "Sent",
    className: "bg-blue-100 text-blue-700",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-700",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-100 text-red-700",
  },
  EXPIRED: {
    label: "Expired",
    className: "bg-amber-100 text-amber-700",
  },
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const config = statusConfig[status] ?? statusConfig.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
