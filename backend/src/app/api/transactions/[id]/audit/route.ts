import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { errorResponse, ok } from "@/lib/http";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const events = await db.auditEvent.findMany({ where: { transactionId: id }, orderBy: { createdAt: "asc" } });
    return ok(events);
  } catch (error) {
    return errorResponse(error);
  }
}
