import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { assistantQuestionSchema } from "@/lib/validation";
import { errorResponse, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { chatCompletionWithFallback } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const { question } = assistantQuestionSchema.parse(await request.json());
    const records = await db.transaction.findMany({ select: { invoiceNumber: true, supplierName: true, amount: true, currency: true, dueDate: true, status: true, paypalStatus: true, approvalStatus: true }, orderBy: { createdAt: "desc" }, take: 200 });
    const response = await chatCompletionWithFallback([
      { role: "system", content: "Answer only from the supplied workspace records. State when records do not contain enough information. Do not invent transactions or payment states." },
      { role: "user", content: JSON.stringify({ question, records: records.map((record) => ({ ...record, amount: record.amount.toString() })) }) },
    ]);
    return ok({ answer: response.choices[0]?.message.content ?? "The AI returned no answer." });
  } catch (error) {
    return errorResponse(error);
  }
}
