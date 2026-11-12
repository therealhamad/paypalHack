import { createHash } from "node:crypto";
import type { Transaction } from "@prisma/client";

type ApprovalMaterial = Pick<
  Transaction,
  | "supplierName"
  | "supplierEmail"
  | "invoiceNumber"
  | "amount"
  | "currency"
  | "description"
  | "issueDate"
  | "dueDate"
  | "paymentTerms"
  | "tax"
  | "discount"
> & {
  lineItems: Array<{ description: string; quantity: unknown; unitPrice: unknown; total: unknown }>;
};

function decimalValue(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

export function approvalMaterial(transaction: ApprovalMaterial) {
  return {
    supplierName: transaction.supplierName.trim(),
    supplierEmail: transaction.supplierEmail.trim().toLowerCase(),
    invoiceNumber: transaction.invoiceNumber.trim(),
    description: transaction.description.trim(),
    amount: decimalValue(transaction.amount),
    currency: transaction.currency.trim().toUpperCase(),
    issueDate: transaction.issueDate.toISOString(),
    dueDate: transaction.dueDate.toISOString(),
    paymentTerms: transaction.paymentTerms?.trim() ?? null,
    tax: decimalValue(transaction.tax),
    discount: decimalValue(transaction.discount),
    lineItems: transaction.lineItems.map((item) => ({
      description: item.description.trim(),
      quantity: decimalValue(item.quantity),
      unitPrice: decimalValue(item.unitPrice),
      total: decimalValue(item.total),
    })),
  };
}

export function approvalDetailsHash(transaction: ApprovalMaterial) {
  const canonical = JSON.stringify(approvalMaterial(transaction));
  return createHash("sha256").update(canonical).digest("hex");
}
