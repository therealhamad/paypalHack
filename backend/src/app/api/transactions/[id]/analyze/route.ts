import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { analyzeInvoice } from "@/lib/ai";
import { errorResponse, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const transaction = await db.transaction.findUnique({ where: { id }, include: { lineItems: true } });
    if (!transaction) return errorResponse(new Error("Transaction not found"), "Transaction not found", 404);
    const body = (await request.json().catch(() => ({}))) as { invoiceText?: string };
    const hasProvidedText = typeof body.invoiceText === "string" && body.invoiceText.trim().length > 0;
    const invoiceText = hasProvidedText ? body.invoiceText! : JSON.stringify(transaction);
    const analysis = await analyzeInvoice(invoiceText, id, !hasProvidedText);
    await db.transaction.update({ where: { id }, data: { status: "ANALYZED", aiRiskLevel: analysis.riskLevel, aiAnalysis: analysis } });
    await audit(id, "AI_ANALYSIS_COMPLETED", "ai", { riskLevel: analysis.riskLevel });
    return ok(analysis);
  } catch (error) {
    return errorResponse(error);
  }
}
