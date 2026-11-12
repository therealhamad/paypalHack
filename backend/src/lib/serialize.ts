import type { Prisma } from "@prisma/client";
import { payerInvoiceUrl } from "./paypal";

export function serializeTransaction<T extends { amount: Prisma.Decimal; tax: Prisma.Decimal | null; discount: Prisma.Decimal | null; paypalInvoiceId?: string | null; lineItems?: Array<{ quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; total: Prisma.Decimal }> }>(transaction: T) {
  return {
    ...transaction,
    amount: transaction.amount.toString(),
    tax: transaction.tax?.toString() ?? null,
    discount: transaction.discount?.toString() ?? null,
    ...(transaction.paypalInvoiceId ? { paypalPayerUrl: payerInvoiceUrl(transaction.paypalInvoiceId) } : {}),
    ...(transaction.lineItems
      ? {
          lineItems: transaction.lineItems.map((item) => ({
            ...item,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            total: item.total.toString(),
          })),
        }
      : {}),
  };
}
