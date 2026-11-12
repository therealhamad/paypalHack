import { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { approvalDetailsHash } from "./approval";
import type { TransactionInput } from "./validation";

export async function createTransaction(input: TransactionInput) {
  const transaction = await db.transaction.create({
    data: {
      ...input,
      amount: new Prisma.Decimal(input.amount),
      tax: input.tax == null ? null : new Prisma.Decimal(input.tax),
      discount: input.discount == null ? null : new Prisma.Decimal(input.discount),
      lineItems: { create: input.lineItems.map((item) => ({ ...item, quantity: new Prisma.Decimal(item.quantity), unitPrice: new Prisma.Decimal(item.unitPrice), total: new Prisma.Decimal(item.total) })) },
    },
    include: { lineItems: true, approvals: true, auditEvents: { orderBy: { createdAt: "asc" } } },
  });
  await audit(transaction.id, "TRANSACTION_CREATED", "user", { invoiceNumber: transaction.invoiceNumber });
  return transaction;
}

export async function invalidateApproval(id: string) {
  await db.transaction.update({ where: { id }, data: { approvalStatus: "INVALIDATED", status: "DRAFT" } });
}

export async function currentApprovalMatches(transactionId: string) {
  const transaction = await db.transaction.findUnique({ where: { id: transactionId }, include: { lineItems: true } });
  const approval = await db.approval.findFirst({ where: { transactionId }, orderBy: { approvedAt: "desc" } });
  return Boolean(transaction && approval && transaction.approvalStatus === "APPROVED" && approval.detailsHash === approvalDetailsHash(transaction));
}
