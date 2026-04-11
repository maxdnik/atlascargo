import { NextResponse } from "next/server";
import { runScheduledAlertChecksForAllCompanies } from "@/lib/alerts";

function isAuthorized(request: Request) {
  const expected = process.env.ALERT_CRON_TOKEN;
  if (!expected) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledAlertChecksForAllCompanies();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return POST(request);
}
