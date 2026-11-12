import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Pencil,
  Play,
  Radio,
  RotateCcw,
  Square,
  ThumbsDown,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
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
import type {
  RunFields,
  RunPhase,
  RunScenario,
  RunStepId,
  RunStepState,
} from "@/components/raisinpay/workflow-run";

const FIELD_LABELS: Array<{ key: keyof RunFields; label: string; id: string; wide?: boolean }> = [
  { key: "supplierName", label: "Supplier", id: "run-supplier" },
  { key: "invoiceNumber", label: "Invoice number", id: "run-invoice" },
  { key: "description", label: "Description", id: "run-description", wide: true },
  { key: "amount", label: "Amount", id: "run-amount" },
  { key: "currency", label: "Currency", id: "run-currency" },
];

export function IntakeForm({
  fields,
  setField,
  scenario,
  setScenario,
  mode,
  busy,
  error,
  onSubmit,
  onCancel,
  onShuffle,
}: {
  fields: RunFields;
  setField: (key: keyof RunFields, value: string) => void;
  scenario: RunScenario;
  setScenario: (value: RunScenario) => void;
  mode: "new" | "edit";
  busy: boolean;
  error?: string | undefined;
  onSubmit: () => void;
  onCancel: () => void;
  onShuffle: () => void;
}) {
  return (
    <div className="rp-run-panel" data-testid="intake-form">
      <div className="rp-run-header">
        <div>
          <h3>{mode === "edit" ? "Edit details & re-analyze" : "New payment intake"}</h3>
          <p>
            {mode === "edit"
              ? "Saving re-runs AI analysis on the real transaction."
              : "Submitting starts the live lifecycle on the canvas above."}
          </p>
        </div>
        {mode === "new" && (
          <Button variant="outline" size="sm" onClick={onShuffle} disabled={busy}>
            Shuffle sample
          </Button>
        )}
      </div>

      <div className="rp-run-form">
        {FIELD_LABELS.map((field) => (
          <div key={field.key} className={`rp-run-field ${field.wide ? "rp-run-field-wide" : ""}`}>
            <Label htmlFor={field.id}>{field.label}</Label>
            <Input
              id={field.id}
              value={fields[field.key]}
              disabled={busy}
              onChange={(event) => setField(field.key, event.target.value)}
            />
          </div>
        ))}
      </div>

      {mode === "new" && (
        <div className="rp-run-scenario">
          <Label htmlFor="run-scenario">Failure scenario</Label>
          <Select
            value={scenario}
            onValueChange={(value) => setScenario(value as RunScenario)}
            disabled={busy}
          >
            <SelectTrigger id="run-scenario" className="rp-run-scenario-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None — happy path</SelectItem>
              <SelectItem value="duplicate">Duplicate invoice number (real PayPal 422)</SelectItem>
              <SelectItem value="invalid">Invalid amount (real validation 400)</SelectItem>
            </SelectContent>
          </Select>
          {scenario === "duplicate" && (
            <p className="rp-run-note">
              <TriangleAlert className="size-3" /> Reuses invoice number INV-2026-0142 — PayPal
              rejects it at send time.
            </p>
          )}
          {scenario === "invalid" && (
            <p className="rp-run-note">
              <TriangleAlert className="size-3" /> Sends amount -5.00 — validation rejects creation.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="rp-run-step-error rp-run-step-error-block" role="alert">
          <AlertCircle className="size-3.5" /> {error}
        </p>
      )}

      <div className="rp-run-actions">
        <Button className="rp-primary-button" onClick={onSubmit} disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
          {mode === "edit" ? "Save & re-analyze" : "Start live run"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const STEP_LABEL: Record<RunStepId, string> = {
  create: "Recording payment intake",
  analyze: "AI invoice analysis",
  approve: "Recording human approval",
  send: "Creating & sending PayPal invoice",
  refresh: "Reconciling PayPal status",
};

export function StepInspector({
  phase,
  steps,
  userRole,
  onApprove,
  onReject,
  onEdit,
  onRetry,
  onAbort,
  onCheckNow,
  onSkipWait,
  onNewRun,
}: {
  phase: RunPhase;
  steps: Record<RunStepId, RunStepState>;
  userRole: "PREPARER" | "APPROVER" | null;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onEdit: () => void;
  onRetry: () => void;
  onAbort: () => void;
  onCheckNow: () => void;
  onSkipWait: () => void;
  onNewRun: () => void;
}) {
  const isApprover = userRole === null || userRole === "APPROVER";
  const [rejectReason, setRejectReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  if (phase.kind === "running") {
    const step = phase.step;
    return (
      <div className="rp-run-panel" data-testid="step-inspector">
        <div className="rp-run-header">
          <div>
            <h3>
              <LoaderCircle className="size-4 animate-spin rp-inspector-spin" /> {STEP_LABEL[step]}
            </h3>
            <p>Executing the real backend call — nothing is simulated.</p>
          </div>
        </div>
        {steps[step].state === "failed" && steps[step].error && (
          <p className="rp-run-step-error rp-run-step-error-block" role="alert">
            <AlertCircle className="size-3.5" /> {steps[step].error}
          </p>
        )}
      </div>
    );
  }

  if (phase.kind === "gate") {
    return (
      <div className="rp-run-panel rp-run-gate" data-testid="step-inspector">
        <div className="rp-run-header">
          <div>
            <h3>{phase.gate === "review" ? "Review required" : "Human approval gate"}</h3>
            <p>
              {phase.gate === "review"
                ? "AI analysis is complete. Inspect the findings in the evidence panel, then approve — approval signs the details hash."
                : "The flow is paused. Approving records a real signed approval and releases the PayPal send."}
            </p>
          </div>
        </div>
        {!isApprover && (
          <p className="rp-run-note">
            <TriangleAlert className="size-3" /> Signed in as a preparer — maker-checker means only
            an approver can approve or reject. Switch user in the sidebar.
          </p>
        )}
        {rejectOpen && isApprover && (
          <div className="rp-run-reject">
            <Input
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Reason (optional) — e.g. amount doesn't match the PO"
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setRejectOpen(false);
                onReject(rejectReason);
              }}
            >
              <ThumbsDown className="size-3.5" />
              Confirm rejection
            </Button>
          </div>
        )}
        <div className="rp-run-actions">
          <Button className="rp-primary-button" onClick={onApprove} disabled={!isApprover}>
            <Play className="size-4" />
            Approve &amp; continue
          </Button>
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="size-4" />
            Edit details first
          </Button>
          {isApprover && (
            <Button variant="destructive" onClick={() => setRejectOpen((value) => !value)}>
              <ThumbsDown className="size-4" />
              Reject
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (phase.kind === "listening") {
    const seconds = Math.floor(phase.elapsedMs / 1000);
    return (
      <div className="rp-run-panel" data-testid="step-inspector">
        <div className="rp-run-header">
          <div>
            <h3>
              <Radio className="size-4 rp-inspector-listening" /> Listening for the PayPal webhook…
            </h3>
            <p>
              Pay the invoice in the PayPal sandbox (payer account) — the verified event lights up
              the webhook node. Polling every 2s · {seconds}s{phase.note ? ` · ${phase.note}` : ""}
            </p>
          </div>
        </div>
        <div className="rp-run-actions">
          <Button variant="outline" onClick={onCheckNow}>
            <RotateCcw className="size-4" />
            Check PayPal status now
          </Button>
          <Button variant="ghost" onClick={onSkipWait}>
            Skip waiting
          </Button>
          <Button variant="ghost" onClick={onAbort}>
            <Square className="size-3.5" />
            Stop
          </Button>
        </div>
      </div>
    );
  }

  if (phase.kind === "rejected") {
    return (
      <div className="rp-run-panel rp-run-rejected" data-testid="step-inspector">
        <div className="rp-run-header">
          <div>
            <h3>
              <ThumbsDown className="size-4" /> Payment rejected
            </h3>
            <p>
              {phase.by} rejected this payment{phase.reason ? ` \u201c${phase.reason}\u201d` : ""}.
              The rejection is on the audit trail; edit the details and run again to re-request
              approval.
            </p>
          </div>
        </div>
        <div className="rp-run-actions">
          <Button className="rp-primary-button" onClick={onNewRun}>
            <Play className="size-4" />
            New run
          </Button>
        </div>
      </div>
    );
  }

  if (phase.kind === "failed") {
    return (
      <div className="rp-run-panel rp-run-failed" data-testid="step-inspector">
        <div className="rp-run-header">
          <div>
            <h3>
              <AlertCircle className="size-4" />{" "}
              {phase.step === "edit" ? "Edit rejected" : "Flow stopped"}
            </h3>
            <p className="rp-run-step-error">
              {phase.error} — the completed path stays green; retry resumes from this exact step.
            </p>
          </div>
        </div>
        <div className="rp-run-actions">
          <Button className="rp-primary-button" onClick={onRetry}>
            <RotateCcw className="size-4" />
            Retry from this step
          </Button>
          <Button variant="outline" onClick={onAbort}>
            <Square className="size-3.5" />
            Abort run
          </Button>
        </div>
      </div>
    );
  }

  if (phase.kind === "settled") {
    return (
      <div className="rp-run-panel rp-run-settled" data-testid="step-inspector">
        <div className="rp-run-header">
          <div>
            <h3>
              <CheckCircle2 className="size-4 rp-inspector-settled" /> Payment settled
            </h3>
            <p>Verified payment evidence reached the ledger — the full lifecycle completed live.</p>
          </div>
        </div>
        <div className="rp-run-actions">
          <Button className="rp-primary-button" onClick={onNewRun}>
            <Play className="size-4" />
            New run
          </Button>
        </div>
      </div>
    );
  }

  if (phase.kind === "awaiting") {
    return (
      <div className="rp-run-panel" data-testid="step-inspector">
        <div className="rp-run-header">
          <div>
            <h3>Invoice sent — awaiting payment</h3>
            <p>
              No verified webhook event yet. The invoice is live in PayPal; the ledger stays honest
              until real payment evidence arrives.
            </p>
          </div>
        </div>
        <div className="rp-run-actions">
          <Button variant="outline" onClick={onCheckNow}>
            <RotateCcw className="size-4" />
            Check PayPal status now
          </Button>
          <Button className="rp-primary-button" onClick={onNewRun}>
            <Play className="size-4" />
            New run
          </Button>
        </div>
      </div>
    );
  }

  // aborted
  return (
    <div className="rp-run-panel" data-testid="step-inspector">
      <div className="rp-run-header">
        <div>
          <h3>Run stopped</h3>
          <p>The flow keeps the real state it reached — nothing is rolled back or faked.</p>
        </div>
      </div>
      <div className="rp-run-actions">
        <Button className="rp-primary-button" onClick={onNewRun}>
          <Play className="size-4" />
          New run
        </Button>
      </div>
    </div>
  );
}

export function LiveRunCta({ onStart }: { onStart: () => void }) {
  return (
    <div className="rp-run-panel rp-run-cta" data-testid="live-run-cta">
      <div className="rp-run-header">
        <div>
          <h3>Run the lifecycle live</h3>
          <p>
            Add a payment and watch it travel the canvas: AI analysis, your approval, a real PayPal
            invoice, then verified webhooks.
          </p>
        </div>
      </div>
      <div className="rp-run-actions">
        <Button className="rp-primary-button" onClick={onStart}>
          <Play className="size-4" />
          New payment
        </Button>
      </div>
    </div>
  );
}
