import { db } from "./db";
import type { Prisma } from "@prisma/client";

export async function audit(
  transactionId: string,
  eventType: string,
  source: "user" | "ai" | "paypal" | "system",
  details: Prisma.InputJsonObject = {},
) {
  return db.auditEvent.create({ data: { transactionId, eventType, source, details } });
}
