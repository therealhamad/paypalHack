import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { errorResponse, ok } from "@/lib/http";
import { AuthError, createSession, sessionCookieOptions, SESSION_COOKIE, verifyPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = loginSchema.parse(await request.json());
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AuthError("That email and password combination doesn’t match an account.", 401);
    }
    const { token, expiresAt } = await createSession(user.id);
    const response = ok(
      { user: { id: user.id, email: user.email, name: user.name, companyName: user.companyName, role: user.role } },
    ) as NextResponse;
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
