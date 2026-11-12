import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rejectionSchema } from "@/lib/validation";
import { errorResponse, ok } from "@/lib/http";
import { requireApprover } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApprover();
    const { id } = await params;
    const { reason } = rejectionSchema.parse(await request.json().catch(() => ({})));
    const transaction = await db.transaction.findUnique({ where: { id } });
    if (!transaction) return errorResponse(new Error("Transaction not found"), "Transaction not found", 404);
    if (transaction.status === "APPROVED" || transaction.paypalInvoiceId) {
      return errorResponse(
        new Error("This payment was already approved and sent. Reject is only available before the PayPal invoice is created."),
        "This payment was already approved and sent. Reject is only available before the PayPal invoice is created.",
        409,
      );
    }
    if (transaction.approvalStatus === "REJECTED") {
      return errorResponse(new Error("This payment was already rejected."), "This payment was already rejected.", 409);
    }
    const updated = await db.transaction.update({
      where: { id },
      data: {
        approvalStatus: "REJECTED",
        rejectedBy: user.name,
        rejectedAt: new Date(),
        rejectionReason: reason || null,
      },
      include: { lineItems: true },
    });
    await audit(id, "APPROVAL_REJECTED", "user", {
      rejectedBy: user.name,
      reason: reason || null,
      amount: transaction.amount.toString(),
      currency: transaction.currency,
    });
    return ok(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
