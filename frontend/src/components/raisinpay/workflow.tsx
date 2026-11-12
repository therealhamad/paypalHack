import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowUpRight, ExternalLink, ListChecks, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RaisinPayLayout, SectionLabel, StatusPill } from "@/components/raisinpay/shared";
import { useSession } from "@/lib/session";
import {
  getAuditTrail,
  getTransaction,
  getTransactions,
  RaisinApiError,
  refreshPaypalStatus,
  type JsonRecord,
  type RaisinTransaction,
} from "@/lib/raisinpay-api";
import {
  CHAIN,
  deriveNodeStates,
  edgeIdFor,
  NODE_IDS,
  WorkflowCanvas,
  type EdgePulse,
  type FlowNodeOverrides,
  type NodeId,
  type NodeRunState,
  type WorkflowAuditEvent,
} from "@/components/raisinpay/workflow-canvas";
import {
  RUN_STEPS,
  STEP_NODE,
  useWorkflowRun,
  type RunStepId,
} from "@/components/raisinpay/workflow-run";
import { IntakeForm, LiveRunCta, StepInspector } from "@/components/raisinpay/workflow-run-ui";

const money = (value: number | null, currency: string) => {
  if (value === null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
};

const formatDateTime = (value: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const recordOf = (value: unknown): JsonRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
const firstText = (record: JsonRecord | null, ...keys: string[]) => {
  if (!record) return "";
  for (const key of keys)
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  return "";
};
const asStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

type EvidenceRow = { label: string; value: string };

function EvidenceRows({ rows }: { rows: EvidenceRow[] }) {
  return (
    <dl className="rp-evidence-rows">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function EvidenceNote({ tone, children }: { tone: "info" | "warn"; children: React.ReactNode }) {
  return (
    <p className={`rp-evidence-note rp-evidence-note-${tone}`}>
      <AlertCircle className="size-3.5" />
      <span>{children}</span>
    </p>
  );
}

function EvidencePanel({
  node,
  transaction,
  audit,
}: {
  node: NodeId;
  transaction: RaisinTransaction | null;
  audit: WorkflowAuditEvent[];
}) {
  const analysis = transaction?.analysis ? recordOf(transaction.analysis) : null;
  const approvals = Array.isArray(transaction?.raw["approvals"])
    ? (transaction!.raw["approvals"] as JsonRecord[])
    : [];
  const latestApproval = approvals[0] ? recordOf(approvals[0]) : null;
  const payerUrl = transaction?.paypalPayerUrl || transaction?.paypalInvoiceUrl;

  if (!transaction)
    return (
      <div className="rp-evidence-empty">
        Start a live run or select a transaction to inspect real evidence for each step.
      </div>
    );

  if (node === "intake") {
    return (
      <div className="rp-evidence-body">
        <EvidenceRows
          rows={[
            { label: "Invoice number", value: transaction.invoiceNumber },
            { label: "Supplier", value: transaction.supplierName },
            { label: "Supplier email", value: transaction.supplierEmail },
            { label: "Description", value: transaction.description },
            { label: "Amount", value: money(transaction.amount, transaction.currency) },
            { label: "Issue date", value: formatDateTime(transaction.issueDate) },
            { label: "Due date", value: formatDateTime(transaction.dueDate) },
            { label: "Created", value: formatDateTime(transaction.createdAt) },
          ]}
        />
      </div>
    );
  }

  if (node === "analysis") {
    if (!analysis)
      return (
        <div className="rp-evidence-empty">
          No AI analysis has been recorded for this transaction yet.
        </div>
      );
    const findings = Array.isArray(analysis["findings"]) ? analysis["findings"] : [];
    const missing = asStringList(analysis["missingInformation"]);
    return (
      <div className="rp-evidence-body">
        <div className="rp-evidence-badges">
          <StatusPill value={`risk: ${firstText(analysis, "riskLevel") || "unknown"}`} />
        </div>
        {firstText(analysis, "explanation") && (
          <p className="rp-evidence-text">{firstText(analysis, "explanation")}</p>
        )}
        {missing.length > 0 && (
          <div className="rp-evidence-list">
            <strong>Missing information</strong>
            <ul>
              {missing.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {findings.length > 0 ? (
          <div className="rp-evidence-list">
            <strong>Findings</strong>
            <ul>
              {findings.map((finding, index) => {
                const item = recordOf(finding);
                return (
                  <li key={index}>
                    <em>{firstText(item, "severity").replaceAll("_", " ") || "finding"}</em> —{" "}
                    {firstText(item, "message")}
                    {firstText(item, "evidence") ? ` · ${firstText(item, "evidence")}` : ""}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <EvidenceNote tone="info">No findings were returned for this invoice.</EvidenceNote>
        )}
        {firstText(analysis, "recommendedNextAction") && (
          <div className="rp-evidence-list">
            <strong>Suggested next step</strong>
            <p>{firstText(analysis, "recommendedNextAction")}</p>
          </div>
        )}
        <EvidenceNote tone="info">
          AI output is advisory only — not fraud verification.
        </EvidenceNote>
      </div>
    );
  }

  if (node === "review") {
    const edits = audit.filter((event) => event.eventType === "DETAILS_EDITED");
    if (edits.length === 0)
      return (
        <div className="rp-evidence-empty">
          No edits recorded — the extracted details were used as submitted.
        </div>
      );
    return (
      <div className="rp-evidence-body">
        <div className="rp-evidence-list">
          <strong>
            {edits.length} edit event{edits.length === 1 ? "" : "s"}
          </strong>
          <ul>
            {edits.map((event, index) => (
              <li key={index}>
                {formatDateTime(event.createdAt)} — approval invalidated and analysis cleared
              </li>
            ))}
          </ul>
        </div>
        <EvidenceNote tone="warn">
          Every material edit invalidates the previous approval by design.
        </EvidenceNote>
      </div>
    );
  }

  if (node === "approval") {
    if (!latestApproval)
      return (
        <div className="rp-evidence-empty">
          No approval record exists yet. Approval is required before any PayPal operation.
        </div>
      );
    return (
      <div className="rp-evidence-body">
        <EvidenceRows
          rows={[
            { label: "Status", value: (transaction.approvalStatus || "").toLowerCase() },
            { label: "Approved by", value: firstText(latestApproval, "approvedBy") },
            {
              label: "Approved at",
              value: formatDateTime(firstText(latestApproval, "approvedAt")),
            },
            {
              label: "Approved amount",
              value: `${firstText(latestApproval, "approvedCurrency")} ${firstText(latestApproval, "approvedAmount")}`,
            },
            { label: "Approved supplier", value: firstText(latestApproval, "approvedSupplier") },
            {
              label: "Details hash (SHA-256)",
              value: `${firstText(latestApproval, "detailsHash").slice(0, 24)}…`,
            },
          ]}
        />
        <EvidenceNote tone="info">
          The hash binds this approval to the exact supplier, amount, currency and line items. Any
          edit invalidates it server-side.
        </EvidenceNote>
      </div>
    );
  }

  if (node === "paypal") {
    if (!transaction.paypalInvoiceId)
      return (
        <div className="rp-evidence-empty">
          No PayPal invoice has been created for this transaction.
        </div>
      );
    return (
      <div className="rp-evidence-body">
        <EvidenceRows
          rows={[
            { label: "PayPal invoice ID", value: transaction.paypalInvoiceId },
            { label: "PayPal status", value: (transaction.paypalStatus || "").toLowerCase() },
            {
              label: "Recorded",
              value: formatDateTime(
                audit.find((event) => event.eventType === "PAYPAL_INVOICE_CREATED_AND_SENT")
                  ?.createdAt ?? "",
              ),
            },
          ]}
        />
        {payerUrl && /^https:\/\//i.test(payerUrl) && (
          <Button asChild variant="outline" size="sm" className="rp-evidence-link">
            <a href={payerUrl} target="_blank" rel="noreferrer">
              Open PayPal invoice <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
        <EvidenceNote tone="info">
          The invoice ID and status come from real PayPal API responses — never generated locally.
        </EvidenceNote>
      </div>
    );
  }

  if (node === "tracking") {
    return (
      <div className="rp-evidence-body">
        <EvidenceRows
          rows={[
            {
              label: "PayPal status",
              value: (transaction.paypalStatus || "not retrieved").toLowerCase(),
            },
            {
              label: "Last reconciliation",
              value: formatDateTime(
                audit.filter((event) => event.eventType === "PAYPAL_STATUS_UPDATED").at(-1)
                  ?.createdAt ?? "",
              ),
            },
          ]}
        />
        <EvidenceNote tone="info">
          Status is pulled server-side from PayPal. The database never claims a payment PayPal has
          not confirmed.
        </EvidenceNote>
      </div>
    );
  }

  if (node === "webhook") {
    const events = audit.filter(
      (event) =>
        event.eventType === "PAYPAL_WEBHOOK_RECEIVED" ||
        event.eventType === "PAYPAL_STATUS_UPDATED",
    );
    if (events.length === 0)
      return (
        <div className="rp-evidence-empty">
          No verified PayPal webhook events have arrived for this transaction yet.
        </div>
      );
    return (
      <div className="rp-evidence-body">
        <div className="rp-evidence-list">
          <strong>Verified events</strong>
          <ul>
            {events.map((event, index) => (
              <li key={index}>
                {formatDateTime(event.createdAt)} —{" "}
                {firstText(recordOf(event.details), "eventType") || event.eventType}
              </li>
            ))}
          </ul>
        </div>
        <EvidenceNote tone="info">
          Every event is signature-verified against PayPal before it is recorded.
        </EvidenceNote>
      </div>
    );
  }

  const paypalStatus = (transaction.paypalStatus || "").toLowerCase();
  const paid = /paid/.test(paypalStatus);
  return (
    <div className="rp-evidence-body">
      <div className="rp-evidence-badges">
        <StatusPill value={paid ? paypalStatus : "awaiting payment"} />
      </div>
      {paid ? (
        <p className="rp-evidence-text">
          PayPal reports this invoice as {paypalStatus}. This state exists only because PayPal
          confirmed it.
        </p>
      ) : (
        <p className="rp-evidence-text">
          The recipient pays through PayPal's hosted invoice experience. This node turns green only
          on verified PayPal evidence — via webhook or server-side reconciliation.
        </p>
      )}
    </div>
  );
}

export function WorkflowPage() {
  const [transactions, setTransactions] = useState<RaisinTransaction[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [transaction, setTransaction] = useState<RaisinTransaction | null>(null);
  const [audit, setAudit] = useState<WorkflowAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<NodeId | null>("intake");
  const [mode, setMode] = useState<"replay" | "live">("replay");
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useSession();
  const [pulse, setPulse] = useState<EdgePulse>(null);
  const pulseTimers = useRef<number[]>([]);

  const firePulse = useCallback((edgeId: string, kind: "success" | "failed") => {
    setPulse({ edgeId, kind });
    pulseTimers.current.push(window.setTimeout(() => setPulse(null), 1250));
  }, []);

  useEffect(
    () => () => {
      for (const timer of pulseTimers.current) window.clearTimeout(timer);
    },
    [],
  );

  const loadList = useCallback(async () => {
    try {
      setTransactions(await getTransactions());
    } catch (cause) {
      setError(cause instanceof RaisinApiError ? cause.message : "Couldn't load transactions.");
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) {
      setTransaction(null);
      setAudit([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [detail, rawEvents] = await Promise.all([
        getTransaction(id),
        getAuditTrail(id).catch(() => []),
      ]);
      setTransaction(detail);
      const events: WorkflowAuditEvent[] = [];
      for (const event of rawEvents) {
        const record = recordOf(event);
        const eventType = record ? String(record["eventType"] ?? "") : "";
        if (!record || !eventType) continue;
        events.push({
          eventType,
          source: String(record["source"] ?? ""),
          createdAt: String(record["createdAt"] ?? ""),
          details: recordOf(record["details"]),
        });
      }
      setAudit(events);
    } catch (cause) {
      setTransaction(null);
      setAudit([]);
      setError(cause instanceof RaisinApiError ? cause.message : "Couldn't load the transaction.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    if (mode === "replay" && selectedId) void loadDetail(selectedId);
  }, [mode, selectedId, loadDetail]);

  const run = useWorkflowRun({
    onTransactionCreated: (id) => {
      setSelectedId(id);
    },
    onStateRefresh: async (id) => {
      const target = id ?? selectedId;
      if (target) await loadDetail(target);
      await loadList();
    },
    onStepDone: (stepId, ok) => {
      const node = STEP_NODE[stepId];
      const index = CHAIN.indexOf(node);
      if (ok && index >= 0 && index < CHAIN.length - 1) {
        firePulse(edgeIdFor(CHAIN[index]!, CHAIN[index + 1]!), "success");
      } else if (!ok && index > 0) {
        firePulse(edgeIdFor(CHAIN[index - 1]!, CHAIN[index]!), "failed");
      }
    },
  });

  const overrides = useMemo<FlowNodeOverrides>(() => {
    if (mode !== "live") return {};
    const result: FlowNodeOverrides = {};
    const phase = run.phase;
    if (phase.kind === "running") {
      const meta = RUN_STEPS.find((step) => step.id === phase.step);
      result[STEP_NODE[phase.step]] = {
        state: "running" as NodeRunState,
        hint: meta?.hint ?? "Executing real API call…",
      };
    } else if (phase.kind === "gate") {
      if (phase.gate === "review")
        result["review"] = {
          state: "info" as NodeRunState,
          hint: "AI findings ready — review required",
        };
      else
        result["approval"] = {
          state: "info" as NodeRunState,
          hint: "Paused — awaiting your approval",
        };
    } else if (phase.kind === "listening") {
      result["webhook"] = {
        state: "info" as NodeRunState,
        hint: `Listening for verified events… ${Math.floor(phase.elapsedMs / 1000)}s`,
      };
    } else if (phase.kind === "failed") {
      if (phase.step !== "edit")
        result[STEP_NODE[phase.step]] = {
          state: "failed" as NodeRunState,
          hint: phase.error,
        };
    } else if (phase.kind === "settled") {
      result["terminal"] = {
        state: "success" as NodeRunState,
        hint: "Paid — verified via webhook",
      };
    } else if (phase.kind === "awaiting") {
      result["webhook"] = {
        state: "info" as NodeRunState,
        hint: "No verified event yet — invoice is live",
      };
    } else if (phase.kind === "rejected") {
      result["approval"] = {
        state: "failed" as NodeRunState,
        badge: "rejected",
        hint: `Rejected by ${phase.by}`,
      };
    } else if (phase.kind === "form" || phase.kind === "idle") {
      result["intake"] = {
        state: "info" as NodeRunState,
        hint:
          phase.kind === "form"
            ? phase.mode === "edit"
              ? "Editing details — saving re-runs analysis"
              : "Fill the intake form to begin"
            : "Start here — add a payment",
      };
    }
    return result;
  }, [mode, run.phase]);

  // The selection follows the flow: the evidence panel always shows the live node.
  useEffect(() => {
    const phase = run.phase;
    if (phase.kind === "running") setSelectedNode(STEP_NODE[phase.step]);
    else if (phase.kind === "gate")
      setSelectedNode(phase.gate === "review" ? "review" : "approval");
    else if (phase.kind === "listening" || phase.kind === "awaiting") setSelectedNode("webhook");
    else if (phase.kind === "failed" && phase.step !== "edit")
      setSelectedNode(STEP_NODE[phase.step]);
    else if (phase.kind === "settled") setSelectedNode("terminal");
  }, [run.phase]);

  const states = useMemo(
    () => deriveNodeStates(transaction, audit, overrides),
    [transaction, audit, overrides],
  );

  // Replay intro: when a transaction loads, pulse the completed path edge by edge,
  // like the workflow "telling the story" of what already happened.
  const introPlayedFor = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== "replay" || !transaction) return;
    if (introPlayedFor.current === transaction.id) return;
    introPlayedFor.current = transaction.id;
    const timers: number[] = [];
    let delay = 400;
    for (let index = 0; index < CHAIN.length - 1; index += 1) {
      const source = CHAIN[index]!;
      const target = CHAIN[index + 1]!;
      if (states[source].state === "success" && states[target].state === "success") {
        const edgeId = edgeIdFor(source, target);
        timers.push(window.setTimeout(() => setPulse({ edgeId, kind: "success" }), delay));
        timers.push(
          window.setTimeout(
            () => setPulse((current) => (current?.edgeId === edgeId ? null : current)),
            delay + 1150,
          ),
        );
        delay += 650;
      }
    }
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, transaction?.id]);

  const refreshStatus = async () => {
    if (!transaction?.paypalInvoiceId) return;
    setRefreshing(true);
    try {
      await refreshPaypalStatus(transaction.id);
      await loadDetail(transaction.id);
    } catch (cause) {
      setError(cause instanceof RaisinApiError ? cause.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <RaisinPayLayout
      title="Lifecycle canvas"
      description="The full payment lifecycle — intake, AI analysis, approval, PayPal execution, reconciliation — rendered from real workspace events."
      action={
        mode === "replay" ? (
          <Button
            className="rp-primary-button"
            onClick={() => {
              setMode("live");
              run.resetRun();
            }}
          >
            <ListChecks className="size-4" />
            New live run
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              setMode("replay");
              run.resetRun();
            }}
          >
            <RefreshCw className="size-4" />
            Back to replay
          </Button>
        )
      }
    >
      <section className="rp-workflow-canvas-section">
        <div className="rp-workflow-toolbar">
          {mode === "replay" ? (
            <div className="rp-workflow-picker">
              <label htmlFor="workflow-tx">Replay a transaction</label>
              <select
                id="workflow-tx"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                <option value="">Select a transaction…</option>
                {transactions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.invoiceNumber} — {item.supplierName} ({item.currency} {item.amount ?? "—"}
                    )
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="rp-workflow-live-note">
              <span className="rp-live-dot" /> Live mode — the canvas executes the real backend flow
              step by step. Click the intake node to add a payment.
            </p>
          )}
          {transaction?.paypalInvoiceId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshStatus()}
              disabled={refreshing}
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh PayPal status
            </Button>
          )}
        </div>

        {error && (
          <p className="rp-workflow-error" role="alert">
            <AlertCircle className="size-4" />
            {error}
          </p>
        )}
        {loading && !transaction && mode === "replay" && selectedId && (
          <p className="rp-workflow-loading">Loading transaction events…</p>
        )}
        {mode === "replay" && !selectedId && (
          <div className="rp-workflow-placeholder">
            <h3>Pick a transaction to replay its lifecycle</h3>
            <p>
              Every node below is derived from real audit events, approval records and PayPal
              responses — nothing is simulated.
            </p>
          </div>
        )}
        {(mode === "live" || (mode === "replay" && selectedId)) && (
          <WorkflowCanvas
            states={states}
            pulse={pulse}
            selectedNode={selectedNode}
            onSelectNode={(node) => {
              setSelectedNode(node);
              if (mode === "live" && node === "intake" && run.phase.kind === "idle") run.openForm();
            }}
          />
        )}
      </section>

      <div
        className={`rp-workflow-bottom ${
          mode === "live" ? "rp-workflow-bottom-live" : "rp-workflow-bottom-replay"
        }`}
      >
        {mode === "live" && run.phase.kind === "idle" && <LiveRunCta onStart={run.openForm} />}
        {mode === "live" && run.phase.kind === "form" && (
          <IntakeForm
            fields={run.fields}
            setField={run.setField}
            scenario={run.scenario}
            setScenario={run.setScenario}
            mode={run.phase.mode}
            busy={false}
            onSubmit={() =>
              void (run.phase.kind === "form" && run.phase.mode === "edit"
                ? run.saveEdit()
                : run.startRun())
            }
            onCancel={() =>
              run.phase.kind === "form" && run.phase.mode === "edit"
                ? run.cancelEdit()
                : run.closeForm()
            }
            onShuffle={run.shuffleSample}
          />
        )}
        {mode === "live" &&
          (run.phase.kind === "running" ||
            run.phase.kind === "gate" ||
            run.phase.kind === "listening" ||
            run.phase.kind === "failed" ||
            run.phase.kind === "settled" ||
            run.phase.kind === "awaiting" ||
            run.phase.kind === "rejected" ||
            run.phase.kind === "aborted") && (
            <StepInspector
              phase={run.phase}
              steps={run.steps}
              userRole={user?.role ?? null}
              onApprove={() => void run.approve()}
              onReject={(reason) => void run.reject(reason)}
              onEdit={run.beginEdit}
              onRetry={() => void run.retryFromFailed()}
              onAbort={run.abort}
              onCheckNow={() => void run.checkNow()}
              onSkipWait={run.skipWait}
              onNewRun={run.resetRun}
            />
          )}
        <section className="rp-evidence-panel">
          <SectionLabel
            trailing={
              selectedNode ? (
                <span className="rp-evidence-node-name">
                  {NODE_IDS.includes(selectedNode) ? selectedNode : ""}
                </span>
              ) : null
            }
          >
            Node evidence
          </SectionLabel>
          <EvidencePanel node={selectedNode ?? "intake"} transaction={transaction} audit={audit} />
        </section>
        <section className="rp-evidence-panel">
          <SectionLabel trailing={<span className="rp-count-label">{audit.length}</span>}>
            Audit trail
          </SectionLabel>
          {audit.length === 0 ? (
            <p className="rp-evidence-empty">Events appear here as the backend records them.</p>
          ) : (
            <ol className="rp-audit-list">
              {audit.map((event, index) => (
                <li key={index}>
                  <span className={`rp-audit-source rp-audit-${event.source}`}>
                    <ArrowUpRight className="size-3" />
                  </span>
                  <div>
                    <strong>{event.eventType.replaceAll("_", " ").toLowerCase()}</strong>
                    <small>
                      {formatDateTime(event.createdAt)} · {event.source}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </RaisinPayLayout>
  );
}
