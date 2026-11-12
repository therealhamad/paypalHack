import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function errorResponse(error: unknown, fallback = "Request failed", status = 500) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: error.issues },
      { status: 400 },
    );
  }
  const message = error instanceof Error ? error.message : fallback;
  const providerStatus =
    typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
      ? error.status
      : undefined;
  return NextResponse.json({ error: message }, { status: providerStatus ?? status });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}
