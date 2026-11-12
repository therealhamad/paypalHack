import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { errorResponse, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { transactionInputSchema } from "@/lib/validation";
import { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { serializeTransaction } from "@/lib/serialize";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const transaction = await db.transaction.findUnique({ where: { id }, include: { lineItems: true, approvals: { orderBy: { approvedAt: "desc" } }, auditEvents: { orderBy: { createdAt: "asc" } } } });
    if (!transaction) return errorResponse(new Error("Transaction not found"), "Transaction not found", 404);
    return ok(serializeTransaction(transaction));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const input = transactionInputSchema.parse(await request.json());
    const transaction = await db.transaction.update({
      where: { id },
      data: { ...input, amount: new Prisma.Decimal(input.amount), tax: input.tax == null ? null : new Prisma.Decimal(input.tax), discount: input.discount == null ? null : new Prisma.Decimal(input.discount), aiAnalysis: Prisma.JsonNull, aiRiskLevel: null, approvalStatus: "INVALIDATED", status: "DRAFT", paypalInvoiceId: null, paypalInvoiceUrl: null, paypalStatus: null, lineItems: { deleteMany: {}, create: input.lineItems.map((item) => ({ ...item, quantity: new Prisma.Decimal(item.quantity), unitPrice: new Prisma.Decimal(item.unitPrice), total: new Prisma.Decimal(item.total) })) } },
      include: { lineItems: true },
    });
    await audit(id, "DETAILS_EDITED", "user", { approvalInvalidated: true });
    return ok(serializeTransaction(transaction));
  } catch (error) {
    return errorResponse(error);
  }
}
