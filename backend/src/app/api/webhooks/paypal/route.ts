import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getAccessToken, verifyWebhook } from "@/lib/paypal";
import { errorResponse, ok } from "@/lib/http";

const STATUS_IN_EVENT: Array<[RegExp, string]> = [
  [/PARTIALLY_PAID/i, "PARTIALLY_PAID"],
  [/MARKED_AS_PAID/i, "PAID"],
  [/\bPAID\b/i, "PAID"],
  [/CANCELLED|VOIDED/i, "CANCELLED"],
  [/REFUNDED/i, "REFUNDED"],
];

function statusFromEventType(eventType: string): string | null {
  for (const [pattern, status] of STATUS_IN_EVENT) {
    if (pattern.test(eventType)) return status;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const event = (await request.json()) as { id?: string; event_type?: string; resource?: { invoice?: { id?: string }; id?: string } };
    if (!event.id || !event.event_type) return errorResponse(new Error("Invalid PayPal webhook payload"), "Invalid PayPal webhook payload", 400);
    const existing = await db.webhookEvent.findUnique({ where: { paypalEventId: event.id } });
    if (existing) return ok({ received: true, duplicate: true });
    const verification = await verifyWebhook(await getAccessToken(), Object.fromEntries(request.headers.entries()), event);
    if (verification.verification_status !== "SUCCESS") return errorResponse(new Error("PayPal webhook verification failed"), "PayPal webhook verification failed", 400);
    try {
      await db.webhookEvent.create({ data: { paypalEventId: event.id, eventType: event.event_type, processingStatus: "RECEIVED" } });
    } catch (error) {
      // Concurrent duplicate delivery: the unique constraint is the dedupe guard.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return ok({ received: true, duplicate: true });
      }
      throw error;
    }
    const invoiceId = event.resource?.invoice?.id ?? event.resource?.id;
    if (invoiceId) {
      const transaction = await db.transaction.findFirst({ where: { paypalInvoiceId: invoiceId } });
      const paypalStatus = statusFromEventType(event.event_type);
      if (transaction) {
        if (paypalStatus && transaction.paypalStatus !== paypalStatus) {
          await db.transaction.update({ where: { id: transaction.id }, data: { paypalStatus } });
          await audit(transaction.id, "PAYPAL_STATUS_UPDATED", "paypal", { paypalStatus, eventId: event.id, eventType: event.event_type });
        } else {
          await audit(transaction.id, "PAYPAL_WEBHOOK_RECEIVED", "paypal", { eventId: event.id, eventType: event.event_type });
        }
      }
    }
    await db.webhookEvent.update({ where: { paypalEventId: event.id }, data: { processingStatus: "PROCESSED", processedAt: new Date() } });
    return ok({ received: true });
  } catch (error) {
    return errorResponse(error);
  }
}
