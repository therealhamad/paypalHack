import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { analyzeInvoice } from "@/lib/ai";
import { errorResponse, ok } from "@/lib/http";
import { serializeTransaction } from "@/lib/serialize";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const transaction = await db.transaction.findUnique({ where: { id } });
    if (!transaction) return errorResponse(new Error("Transaction not found"), "Transaction not found", 404);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.type !== "application/pdf") return errorResponse(new Error("A PDF file is required"), "A PDF file is required", 400);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    if (!result.text.trim()) throw new Error("The PDF contained no extractable text. Enter the invoice details manually.");
    await audit(id, "INVOICE_UPLOADED", "user", { fileName: file.name, size: file.size });
    const analysis = await analyzeInvoice(result.text, id);
    await db.transaction.update({ where: { id }, data: { status: "ANALYZED", aiRiskLevel: analysis.riskLevel, aiAnalysis: analysis } });
    await audit(id, "AI_ANALYSIS_COMPLETED", "ai", { riskLevel: analysis.riskLevel });
    const saved = await db.transaction.findUniqueOrThrow({ where: { id }, include: { lineItems: true } });
    return ok({ transaction: serializeTransaction(saved), analysis });
  } catch (error) {
    return errorResponse(error);
  }
}
