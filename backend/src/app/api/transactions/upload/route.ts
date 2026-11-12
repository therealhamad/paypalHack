import { NextRequest } from "next/server";
import { analyzeInvoice } from "@/lib/ai";
import { createTransaction } from "@/lib/transaction";
import { errorResponse, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { transactionInputSchema } from "@/lib/validation";
import { serializeTransaction } from "@/lib/serialize";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.type !== "application/pdf") return errorResponse(new Error("A PDF file is required"), "A PDF file is required", 400);
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });
    const result = await parser.getText();
    await parser.destroy();
    if (!result.text.trim()) throw new Error("The PDF contained no extractable text. Enter the invoice details manually.");
    const analysis = await analyzeInvoice(result.text);
    const input = transactionInputSchema.parse(analysis.extracted);
    const transaction = await createTransaction(input);
    return ok({ transaction: serializeTransaction(transaction), analysis }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
