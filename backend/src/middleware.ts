import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  const configuredOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
  const isLocalDevelopmentOrigin = requestOrigin
    ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin)
    : false;
  const response = request.method === "OPTIONS"
    ? new NextResponse(null, { status: 204 })
    : NextResponse.next();
  response.headers.set(
    "Access-Control-Allow-Origin",
    isLocalDevelopmentOrigin ? requestOrigin! : configuredOrigin,
  );
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS",
  );
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Accept");
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
