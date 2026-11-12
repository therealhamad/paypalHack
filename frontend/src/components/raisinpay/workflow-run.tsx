import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeTransaction,
  approveTransaction,
  createTransaction,
  getTransaction,
  refreshPaypalStatus,
  rejectTransaction,
  sendPaypalInvoice,
  updateTransaction,
  type RaisinTransaction,
} from "@/lib/raisinpay-api";
import type { NodeId } from "@/components/raisinpay/workflow-canvas";

export type RunStepId = "create" | "analyze" | "approve" | "send" | "refresh";

export const RUN_STEPS: { id: RunStepId; label: string; node: NodeId; hint: string }[] = [
  { id: "create", label: "Record payment intake", node: "intake", hint: "Recording the payment…" },
  {
    id: "analyze",
    label: "AI invoice analysis",
    node: "analysis",
    hint: "Extracting fields, checking arithmetic & duplicates…",
  },
  {
    id: "approve",
    label: "Record human approval",
    node: "approval",
    hint: "Signing the approval hash…",
  },
  {
    id: "send",
    label: "Create & send PayPal invoice",
    node: "paypal",
    hint: "Calling the PayPal invoicing API…",
  },
  {
    id: "refresh",
    label: "Reconcile PayPal status",
    node: "tracking",
    hint: "Fetching PayPal status server-side…",
  },
];

export const STEP_NODE: Record<RunStepId, NodeId> = Object.fromEntries(
  RUN_STEPS.map((step) => [step.id, step.node]),
) as Record<RunStepId, NodeId>;

export type RunStepState = { state: "pending" | "running" | "success" | "failed"; error?: string };

export type RunScenario = "none" | "duplicate" | "invalid";

export type RunFields = {
  supplierName: string;
  supplierEmail: string;
  invoiceNumber: string;
  description: string;
  amount: string;
  currency: string;
  issueDate: string;
  dueDate: string;
};

export type RunPhase =
  | { kind: "idle" }
  | { kind: "form"; mode: "new" | "edit" }
  | { kind: "running"; step: RunStepId }
  | { kind: "gate"; gate: "review" | "approval" }
  | { kind: "listening"; startedAt: number; elapsedMs: number; note?: string }
  | { kind: "failed"; step: RunStepId | "edit"; error: string }
  | { kind: "settled" }
  | { kind: "awaiting" }
  | { kind: "rejected"; by: string; reason: string }
  | { kind: "aborted" };

const SAMPLES: RunFields[] = [
  {
    supplierName: "Juniper Analytics Ltd",
    supplierEmail: "accounts@juniperanalytics.example",
    invoiceNumber: "INV-2026-0155",
    description: "Data pipeline maintenance retainer - November",
    amount: "2850.00",
    currency: "USD",
    issueDate: "2026-11-10",
    dueDate: "2026-12-10",
  },
  {
    supplierName: "Ferris & Blake Printing",
    supplierEmail: "invoices@ferrisblake.example",
    invoiceNumber: "INV-2026-0156",
    description: "Conference brochure printing - 500 copies",
    amount: "1180.40",
    currency: "EUR",
    issueDate: "2026-11-11",
    dueDate: "2026-12-11",
  },
  {
    supplierName: "Halcyon Security Audits",
    supplierEmail: "billing@halcyonaudit.example",
    invoiceNumber: "INV-2026-0157",
    description: "Quarterly penetration test - finance portal",
    amount: "4600.00",
    currency: "GBP",
    issueDate: "2026-11-11",
    dueDate: "2026-12-01",
  },
  {
    supplierName: "Meridian Couriers",
    supplierEmail: "ar@meridiancouriers.example",
    invoiceNumber: "INV-2026-0158",
    description: "Document courier runs - October to November",
    amount: "412.60",
    currency: "CAD",
    issueDate: "2026-11-09",
    dueDate: "2026-11-30",
  },
];

const DUPLICATE_INVOICE_NUMBER = "INV-2026-0142";

const SEQUENCE: RunStepId[] = ["create", "analyze", "approve", "send", "refresh"];
const BEAT_MS = 800;
const POLL_INTERVAL_MS = 2000;
const LISTEN_TIMEOUT_MS = 180_000;

const emptySteps = (): Record<RunStepId, RunStepState> => ({
  create: { state: "pending" },
  analyze: { state: "pending" },
  approve: { state: "pending" },
  send: { state: "pending" },
  refresh: { state: "pending" },
});

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isPaidStatus = (status: string) => status.toUpperCase().includes("PAID");

export function useWorkflowRun(callbacks: {
  onTransactionCreated: (id: string) => void;
  onStateRefresh: (id?: string) => Promise<void>;
  onStepDone?: (step: RunStepId, ok: boolean) => void;
}) {
  const [phase, setPhase] = useState<RunPhase>({ kind: "idle" });
  const [steps, setSteps] = useState<Record<RunStepId, RunStepState>>(emptySteps);
  const [fields, setFields] = useState<RunFields>(SAMPLES[0]!);
  const [scenario, setScenario] = useState<RunScenario>("none");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const transactionIdRef = useRef<string | null>(null);
  const tokenRef = useRef(0);
  const listenTimerRef = useRef<number | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(
    () => () => {
      tokenRef.current += 1;
      if (listenTimerRef.current !== null) window.clearInterval(listenTimerRef.current);
    },
    [],
  );

  const alive = (token: number) => tokenRef.current === token;

  const stopListening = () => {
    if (listenTimerRef.current !== null) {
      window.clearInterval(listenTimerRef.current);
      listenTimerRef.current = null;
    }
  };

  const setStep = (id: RunStepId, update: RunStepState) =>
    setSteps((current) => ({ ...current, [id]: update }));

  const runStep = useCallback(
    async (id: RunStepId, token: number): Promise<boolean> => {
      setStep(id, { state: "running" });
      try {
        if (id === "create") {
          const body = {
            supplierName: fields.supplierName,
            supplierEmail: fields.supplierEmail,
            invoiceNumber:
              scenario === "duplicate" ? DUPLICATE_INVOICE_NUMBER : fields.invoiceNumber,
            description: fields.description,
            amount: scenario === "invalid" ? -5 : Number(fields.amount),
            currency: fields.currency,
            issueDate: fields.issueDate,
            dueDate: fields.dueDate,
            lineItems: [],
          };
          const created: RaisinTransaction = await createTransaction(body);
          transactionIdRef.current = created.id;
          setTransactionId(created.id);
          callbacksRef.current.onTransactionCreated(created.id);
        } else if (id === "analyze") {
          await analyzeTransaction(transactionIdRef.current!);
        } else if (id === "approve") {
          await approveTransaction(transactionIdRef.current!);
        } else if (id === "send") {
          await sendPaypalInvoice(transactionIdRef.current!);
        } else if (id === "refresh") {
          await refreshPaypalStatus(transactionIdRef.current!);
        }
        setStep(id, { state: "success" });
        callbacksRef.current.onStepDone?.(id, true);
        await callbacksRef.current.onStateRefresh(transactionIdRef.current ?? undefined);
        return true;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "The step failed.";
        setStep(id, { state: "failed", error: message });
        callbacksRef.current.onStepDone?.(id, false);
        await callbacksRef.current.onStateRefresh(transactionIdRef.current ?? undefined);
        if (alive(token)) setPhase({ kind: "failed", step: id, error: message });
        return false;
      }
    },
    [fields, scenario],
  );

  // Runs the remaining sequence from a step index, pausing at the two human gates.
  const runFrom = useCallback(
    async (startIndex: number, token: number) => {
      for (let index = startIndex; index < SEQUENCE.length; index += 1) {
        const step = SEQUENCE[index]!;
        if (step === "approve") {
          if (alive(token)) setPhase({ kind: "gate", gate: "approval" });
          return;
        }
        if (alive(token)) setPhase({ kind: "running", step });
        const ok = await runStep(step, token);
        if (!alive(token) || !ok) return;
        if (step === "analyze") {
          await wait(400);
          if (alive(token)) setPhase({ kind: "gate", gate: "review" });
          return;
        }
        await wait(BEAT_MS);
        if (!alive(token)) return;
      }
      startListening(token);
    },
    [runStep],
  );

  const startListening = (token: number) => {
    if (!alive(token)) return;
    const startedAt = Date.now();
    setPhase({ kind: "listening", startedAt, elapsedMs: 0 });
    stopListening();
    listenTimerRef.current = window.setInterval(async () => {
      if (!alive(token)) {
        stopListening();
        return;
      }
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs > LISTEN_TIMEOUT_MS || !transactionIdRef.current) {
        stopListening();
        if (alive(token)) setPhase({ kind: "awaiting" });
        return;
      }
      try {
        const tx = await getTransaction(transactionIdRef.current);
        if (!alive(token)) return;
        if (isPaidStatus(String(tx.paypalStatus ?? ""))) {
          stopListening();
          setPhase({ kind: "settled" });
          await callbacksRef.current.onStateRefresh(transactionIdRef.current);
          return;
        }
        setPhase({ kind: "listening", startedAt, elapsedMs });
      } catch {
        // Network blip while polling — keep listening honestly.
        setPhase({ kind: "listening", startedAt, elapsedMs, note: "poll failed, retrying…" });
      }
    }, POLL_INTERVAL_MS);
  };

  const openForm = useCallback(() => setPhase({ kind: "form", mode: "new" }), []);
  const closeForm = useCallback(() => setPhase({ kind: "idle" }), []);

  const startRun = useCallback(async () => {
    const token = ++tokenRef.current;
    stopListening();
    setSteps(emptySteps());
    transactionIdRef.current = null;
    setTransactionId(null);
    await runFrom(0, token);
  }, [runFrom]);

  const approve = useCallback(async () => {
    const token = tokenRef.current;
    setPhase({ kind: "running", step: "approve" });
    const ok = await runStep("approve", token);
    if (!alive(token) || !ok) return;
    await wait(BEAT_MS);
    if (!alive(token)) return;
    await runFrom(SEQUENCE.indexOf("send"), token);
  }, [runFrom, runStep]);

  const beginEdit = useCallback(() => {
    if (transactionIdRef.current) setPhase({ kind: "form", mode: "edit" });
  }, []);

  const cancelEdit = useCallback(() => {
    if (transactionIdRef.current) setPhase({ kind: "gate", gate: "review" });
    else setPhase({ kind: "idle" });
  }, []);

  const saveEdit = useCallback(async () => {
    const token = tokenRef.current;
    const id = transactionIdRef.current;
    if (!id) return;
    try {
      await updateTransaction(id, {
        supplierName: fields.supplierName,
        supplierEmail: fields.supplierEmail,
        description: fields.description,
        amount: Number(fields.amount),
        currency: fields.currency,
        dueDate: fields.dueDate,
      });
      await callbacksRef.current.onStateRefresh(id);
      if (!alive(token)) return;
      setPhase({ kind: "running", step: "analyze" });
      const ok = await runStep("analyze", token);
      if (!alive(token) || !ok) return;
      await wait(400);
      if (alive(token)) setPhase({ kind: "gate", gate: "review" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Saving the edit failed.";
      await callbacksRef.current.onStateRefresh(id);
      if (alive(token)) setPhase({ kind: "failed", step: "edit", error: message });
    }
  }, [fields, runStep]);

  const retryFromFailed = useCallback(async () => {
    if (phase.kind !== "failed") return;
    const token = ++tokenRef.current;
    const index =
      phase.step === "edit" ? SEQUENCE.indexOf("analyze") : SEQUENCE.indexOf(phase.step);
    if (index < 0) return;
    if (phase.step === "edit") {
      await saveEdit();
      return;
    }
    await runFrom(index, token);
  }, [phase, runFrom, saveEdit]);

  const checkNow = useCallback(async () => {
    const id = transactionIdRef.current;
    if (!id) return;
    try {
      await refreshPaypalStatus(id);
      const tx = await getTransaction(id);
      if (isPaidStatus(String(tx.paypalStatus ?? ""))) {
        stopListening();
        setPhase({ kind: "settled" });
        await callbacksRef.current.onStateRefresh(id);
        return;
      }
      if (phase.kind === "listening")
        setPhase({
          kind: "listening",
          startedAt: phase.startedAt,
          elapsedMs: phase.elapsedMs,
          note: "no payment recorded yet",
        });
      else setPhase({ kind: "awaiting" });
      await callbacksRef.current.onStateRefresh(id);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Status check failed.";
      setPhase({ kind: "failed", step: "refresh", error: message });
    }
  }, [phase]);

  const skipWait = useCallback(() => {
    stopListening();
    setPhase({ kind: "awaiting" });
  }, []);

  const reject = useCallback(async (reason: string) => {
    const id = transactionIdRef.current;
    if (!id) return;
    try {
      const record = (await rejectTransaction(id, reason)) as { rejectedBy?: string } | null;
      await callbacksRef.current.onStateRefresh(id);
      setPhase({ kind: "rejected", by: record?.rejectedBy ?? "approver", reason });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The rejection failed.";
      setPhase({ kind: "failed", step: "approve", error: message });
    }
  }, []);

  const abort = useCallback(() => {
    tokenRef.current += 1;
    stopListening();
    setPhase({ kind: "aborted" });
  }, []);

  const resetRun = useCallback(() => {
    tokenRef.current += 1;
    stopListening();
    transactionIdRef.current = null;
    setTransactionId(null);
    setSteps(emptySteps());
    setScenario("none");
    setPhase({ kind: "idle" });
  }, []);

  const shuffleSample = useCallback(() => {
    setFields((current) => {
      const current_ = SAMPLES.findIndex(
        (sample) => sample.invoiceNumber === current.invoiceNumber,
      );
      const next = SAMPLES[(current_ + 1) % SAMPLES.length] ?? SAMPLES[0];
      return next ? { ...next } : current;
    });
  }, []);

  return {
    phase,
    steps,
    fields,
    setField: (key: keyof RunFields, value: string) =>
      setFields((current) => ({ ...current, [key]: value })),
    setFields,
    scenario,
    setScenario,
    transactionId,
    openForm,
    closeForm,
    startRun,
    approve,
    beginEdit,
    cancelEdit,
    saveEdit,
    retryFromFailed,
    checkNow,
    skipWait,
    reject,
    abort,
    resetRun,
    shuffleSample,
  };
}

export { SAMPLES as RUN_SAMPLES, DUPLICATE_INVOICE_NUMBER };
