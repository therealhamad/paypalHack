import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validation";
import { errorResponse, ok } from "@/lib/http";
import { AuthError, createSession, hashPassword, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const input = registerSchema.parse(await request.json());
    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AuthError("An account with that email already exists. Sign in instead.", 409);
    }
    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        companyName: input.companyName,
        role: input.role,
        passwordHash: await hashPassword(input.password),
      },
    });
    const { token, expiresAt } = await createSession(user.id);
    const response = ok(
      { user: { id: user.id, email: user.email, name: user.name, companyName: user.companyName, role: user.role } },
      201,
    ) as NextResponse;
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
