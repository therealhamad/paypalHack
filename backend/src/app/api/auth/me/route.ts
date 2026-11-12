import { errorResponse, ok } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    return ok({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
