import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { currentApprovalMatches } from "@/lib/transaction";
import { createInvoice, getAccessToken, invoiceHref, sendInvoice } from "@/lib/paypal";
import { errorResponse, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const transaction = await db.transaction.findUnique({ where: { id }, include: { lineItems: true } });
    if (!transaction) return errorResponse(new Error("Transaction not found"), "Transaction not found", 404);
    if (!(await currentApprovalMatches(id))) return errorResponse(new Error("A current approval is required before PayPal execution"), "Approval required or invalidated", 409);
    if (transaction.paypalInvoiceId && transaction.paypalStatus) return ok({ paypalInvoiceId: transaction.paypalInvoiceId, paypalStatus: transaction.paypalStatus, paypalInvoiceUrl: transaction.paypalInvoiceUrl });
    await db.transaction.update({ where: { id }, data: { status: "PAYPAL_PROCESSING" } });
    const token = await getAccessToken();
    const created = await createInvoice(token, { invoiceNumber: transaction.invoiceNumber, description: transaction.description, supplierEmail: transaction.supplierEmail, amount: transaction.amount.toString(), currency: transaction.currency, dueDate: transaction.dueDate, lineItems: transaction.lineItems.map((item) => ({ description: item.description, quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString() })) });
    const invoiceId = String(created.id ?? "");
    if (!invoiceId) throw new Error("PayPal did not return an invoice ID.");
    const sent = await sendInvoice(token, invoiceId);
    const paypalStatus = typeof sent.status === "string" ? sent.status : "SENT";
    const url = invoiceHref(created);
    const saved = await db.transaction.update({ where: { id }, data: { paypalInvoiceId: invoiceId, paypalInvoiceUrl: url, paypalStatus, status: "SENT" } });
    await audit(id, "PAYPAL_INVOICE_CREATED_AND_SENT", "paypal", { paypalInvoiceId: invoiceId, paypalInvoiceUrl: url, paypalStatus });
    return ok({ paypalInvoiceId: saved.paypalInvoiceId, paypalInvoiceUrl: saved.paypalInvoiceUrl, paypalStatus: saved.paypalStatus });
  } catch (error) {
    return errorResponse(error);
  }
}
