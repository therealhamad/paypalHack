import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getAccessToken, getInvoice } from "@/lib/paypal";
import { errorResponse, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const transaction = await db.transaction.findUnique({ where: { id } });
    if (!transaction) return errorResponse(new Error("Transaction not found"), "Transaction not found", 404);
    if (!transaction.paypalInvoiceId) return errorResponse(new Error("No PayPal invoice exists for this transaction"), "No PayPal invoice exists for this transaction", 409);
    const invoice = await getInvoice(await getAccessToken(), transaction.paypalInvoiceId);
    const paypalStatus = typeof invoice.status === "string" ? invoice.status : null;
    if (!paypalStatus) throw new Error("PayPal did not return an invoice status.");
    const saved = await db.transaction.update({ where: { id }, data: { paypalStatus } });
    await audit(id, "PAYPAL_STATUS_UPDATED", "paypal", { paypalStatus });
    return ok({ paypalStatus: saved.paypalStatus, paypalInvoiceId: saved.paypalInvoiceId, paypalInvoiceUrl: saved.paypalInvoiceUrl });
  } catch (error) {
    return errorResponse(error);
  }
}
