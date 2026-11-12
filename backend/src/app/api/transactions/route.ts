import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { errorResponse, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { transactionInputSchema } from "@/lib/validation";
import { createTransaction } from "@/lib/transaction";
import { serializeTransaction } from "@/lib/serialize";

export async function GET() {
  try {
    await requireUser();
    const transactions = await db.transaction.findMany({ include: { lineItems: true }, orderBy: { createdAt: "desc" } });
    return ok(transactions.map(serializeTransaction));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const input = transactionInputSchema.parse(await request.json());
    const transaction = await createTransaction(input);
    return ok(serializeTransaction(transaction), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
