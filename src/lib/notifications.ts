import nodemailer from "nodemailer";
import { AlertSeverity, NotificationLevel, type Alert } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function mapAlertSeverityToLevel(severity: AlertSeverity): NotificationLevel {
  if (severity === AlertSeverity.HIGH) return NotificationLevel.ERROR;
  if (severity === AlertSeverity.MEDIUM) return NotificationLevel.WARNING;
  return NotificationLevel.INFO;
}

function formatAlertSubject(alert: Alert) {
  return `[AtlasCargo][${alert.severity}] ${alert.type.replaceAll("_", " ")}`;
}

function formatAlertBody(alert: Alert, shipmentNumber?: string | null) {
  const scope = shipmentNumber ? `Shipment ${shipmentNumber}` : "Company-level";
  return [
    `Alert type: ${alert.type}`,
    `Severity: ${alert.severity}`,
    `Scope: ${scope}`,
    `Status: ${alert.status}`,
    "",
    alert.message,
  ].join("\n");
}

async function sendEmailAlert(args: {
  recipients: string[];
  alert: Alert;
  shipmentNumber?: string | null;
}) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? "alerts@atlascargo.local";

  if (!host || !user || !pass) {
    console.warn("Alert email skipped: SMTP env vars are not fully configured.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: args.recipients.join(","),
    subject: formatAlertSubject(args.alert),
    text: formatAlertBody(args.alert, args.shipmentNumber),
  });
}

export async function sendExternalAlert(
  alert: Alert,
  context: { shipmentNumber?: string | null } = {},
) {
  // Placeholder hooks for Slack/WhatsApp integrations.
  // Keep these stubs for future provider adapters.
  const payload = {
    type: alert.type,
    severity: alert.severity,
    message: alert.message,
    shipmentNumber: context.shipmentNumber ?? null,
    createdAt: alert.createdAt.toISOString(),
  };
  console.info("sendExternalAlert placeholder", payload);
}

export async function notifyAlertCreated(args: {
  companyId: string;
  alert: Alert;
  shipmentNumber?: string | null;
}) {
  const users = await prisma.user.findMany({
    where: {
      companyId: args.companyId,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (users.length === 0) return;

  const link = args.alert.shipmentId ? `/shipments/${args.alert.shipmentId}` : "/dashboard/action-center";
  const level = mapAlertSeverityToLevel(args.alert.severity);
  const title = `${args.alert.type.replaceAll("_", " ")}`;

  await prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      title,
      body: args.alert.message,
      level,
      link,
    })),
  });

  try {
    await sendEmailAlert({
      recipients: users.map((user) => user.email),
      alert: args.alert,
      shipmentNumber: args.shipmentNumber,
    });
  } catch (error) {
    console.error("Alert email delivery failed", error);
  }

  try {
    await sendExternalAlert(args.alert, { shipmentNumber: args.shipmentNumber });
  } catch (error) {
    console.error("External alert delivery placeholder failed", error);
  }
}
