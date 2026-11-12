import { NextResponse } from "next/server";
import { errorResponse, ok } from "@/lib/http";
import { destroySession, SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  try {
    await destroySession();
    const response = ok({ signedOut: true }) as NextResponse;
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", expires: new Date(0) });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
