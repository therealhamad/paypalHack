import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, Building2, LoaderCircle, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RaisinApiError, registerAccount, type RaisinUser } from "@/lib/raisinpay-api";
import { DEMO_USERS, useSession } from "@/lib/session";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Mode = "signin" | "register";

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, setUser } = useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("dana@raisinpay.demo");
  const [password, setPassword] = useState("demo1234");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState<"PREPARER" | "APPROVER">("PREPARER");

  const done = (user: RaisinUser) => {
    setUser(user);
    void navigate({ to: "/" });
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (mode === "signin") {
        done(await signIn(email, password));
      } else {
        done(await registerAccount({ name, email, password, companyName, role }));
      }
    } catch (cause) {
      setError(
        cause instanceof RaisinApiError ? cause.message : "Sign-in failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const quickSignIn = async (demoEmail: string, demoPassword: string) => {
    setBusy(true);
    setError("");
    try {
      done(await signIn(demoEmail, demoPassword));
    } catch (cause) {
      setError(
        cause instanceof RaisinApiError ? cause.message : "Sign-in failed. Please try again.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="rp-auth-shell">
      <div className="rp-auth-card">
        <div className="rp-auth-brand">
          <img src="/logo.png" alt="RaisinPay logo" className="rp-auth-logo" />
          <div>
            <h1>RaisinPay</h1>
            <p>AI payments clerk · automation, control, proof</p>
          </div>
        </div>

        <div className="rp-auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={mode === "signin" ? "rp-auth-tab-active" : ""}
            onClick={() => setMode("signin")}
          >
            <LogIn className="size-3.5" /> Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "rp-auth-tab-active" : ""}
            onClick={() => setMode("register")}
          >
            <UserPlus className="size-3.5" /> Create workspace account
          </button>
        </div>

        <form
          className="rp-auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {mode === "register" && (
            <>
              <div className="rp-auth-field">
                <Label htmlFor="auth-name">Your name</Label>
                <Input
                  id="auth-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Alex Rivera"
                  required
                  minLength={2}
                />
              </div>
              <div className="rp-auth-field">
                <Label htmlFor="auth-company">Company / workspace</Label>
                <div className="rp-auth-field-icon">
                  <Building2 className="size-3.5" />
                  <Input
                    id="auth-company"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="Raisin Demo Co"
                    required
                    minLength={2}
                  />
                </div>
              </div>
              <div className="rp-auth-field">
                <Label htmlFor="auth-role">Your role in payment controls</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as "PREPARER" | "APPROVER")}
                >
                  <SelectTrigger id="auth-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PREPARER">Preparer — creates and edits payments</SelectItem>
                    <SelectItem value="APPROVER">
                      Approver — approves or rejects payments
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="rp-auth-hint">
                  Maker-checker: preparers can never approve their own payments.
                </p>
              </div>
            </>
          )}

          <div className="rp-auth-field">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="rp-auth-field">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={mode === "register" ? 8 : 1}
            />
          </div>

          {error && (
            <p className="rp-auth-error" role="alert">
              <AlertCircle className="size-3.5" /> {error}
            </p>
          )}

          <Button type="submit" className="rp-primary-button" disabled={busy}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            {mode === "signin" ? "Sign in" : "Create account & sign in"}
          </Button>
        </form>

        <div className="rp-auth-demo">
          <p>
            <ShieldCheck className="size-3.5" /> Demo accounts — password <code>demo1234</code>
          </p>
          <div className="rp-auth-demo-buttons">
            {DEMO_USERS.map((demo) => (
              <Button
                key={demo.email}
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void quickSignIn(demo.email, demo.password)}
              >
                {demo.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
