import { afterEach, describe, expect, it, vi } from "vitest";

import { getMe, login, registerAccount } from "@/lib/raisinpay-api";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("auth api envelope parsing", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("unwraps the { data: { user } } envelope on login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          data: { user: { id: "u1", email: "dana@raisinpay.demo", name: "Dana Chen", companyName: "Raisin Demo Co", role: "APPROVER" } },
        }),
      ),
    );
    const user = await login("dana@raisinpay.demo", "demo1234");
    expect(user.role).toBe("APPROVER");
    expect(user.name).toBe("Dana Chen");
  });

  it("unwraps the envelope on register and tolerates a missing company name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { data: { user: { id: "u2", email: "new@x.dev", name: "New User", companyName: null, role: "PREPARER" } } },
          201,
        ),
      ),
    );
    const user = await registerAccount({ name: "New User", email: "new@x.dev", password: "demo1234", companyName: "Acme", role: "PREPARER" });
    expect(user.id).toBe("u2");
  });

  it("returns null from getMe when signed out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: { user: null } })));
    await expect(getMe()).resolves.toBeNull();
  });

  it("surfaces backend error messages instead of the generic one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "That email and password combination doesn’t match an account." }, 401)),
    );
    await expect(login("dana@raisinpay.demo", "nope")).rejects.toThrow(/doesn’t match an account/);
  });
});
