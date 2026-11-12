import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { approvalDetailsHash } from "@/lib/approval";
import { approvalSchema } from "@/lib/validation";
import { errorResponse, ok } from "@/lib/http";
import { requireApprover } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApprover();
    const { id } = await params;
    const { approvedBy } = approvalSchema.parse(await request.json().catch(() => ({})));
    const approver = user.name || approvedBy;
    const transaction = await db.transaction.findUnique({ where: { id }, include: { lineItems: true } });
    if (!transaction) return errorResponse(new Error("Transaction not found"), "Transaction not found", 404);
    if (transaction.status !== "ANALYZED") return errorResponse(new Error("Transaction must be analysed before approval"), "Transaction must be analysed before approval", 409);
    const detailsHash = approvalDetailsHash(transaction);
    const approval = await db.approval.create({ data: { transactionId: id, approvedBy: approver, approvedAmount: transaction.amount, approvedCurrency: transaction.currency, approvedSupplier: transaction.supplierName, detailsHash } });
    await db.transaction.update({ where: { id }, data: { approvalStatus: "APPROVED", status: "APPROVED" } });
    await audit(id, "APPROVAL_GRANTED", "user", { approvedBy: approver, approvedByEmail: user.email, approvedAmount: transaction.amount.toString(), approvedCurrency: transaction.currency, detailsHash });
    return ok(approval, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
