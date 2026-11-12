import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  Check,
  CircleDashed,
  FileUp,
  Info,
  LoaderCircle,
  MailCheck,
  Radar,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import type { JsonRecord, RaisinTransaction } from "@/lib/raisinpay-api";

export type NodeRunState = "pending" | "running" | "success" | "failed" | "invalidated" | "info";

export type FlowNodeState = {
  state: NodeRunState;
  timestamp?: string | undefined;
  hint?: string | undefined;
  badge?: string | undefined;
};

export type FlowNodeOverrides = Partial<Record<string, FlowNodeState>>;

export const NODE_IDS = [
  "intake",
  "analysis",
  "review",
  "approval",
  "paypal",
  "tracking",
  "webhook",
  "terminal",
] as const;
export type NodeId = (typeof NODE_IDS)[number];

export type PulseKind = "success" | "failed" | "running";

export type EdgePulse = { edgeId: string; kind: PulseKind } | null;

// Snake layout: two rows so the graph fits a wide canvas at ~100% zoom (recording-friendly).
const NODE_LAYOUT: Record<NodeId, { x: number; y: number; title: string; sub: string }> = {
  intake: { x: 0, y: 0, title: "Payment intake", sub: "Manual entry or PDF upload" },
  analysis: { x: 310, y: 0, title: "AI analysis", sub: "Extraction · arithmetic · duplicates" },
  review: { x: 620, y: 0, title: "Review & edit", sub: "Human verification of details" },
  approval: { x: 930, y: 0, title: "Human approval", sub: "Signed details hash required" },
  paypal: { x: 930, y: 240, title: "PayPal create & send", sub: "Sandbox invoicing API" },
  tracking: { x: 620, y: 240, title: "Payment tracking", sub: "Server-side status retrieval" },
  webhook: { x: 310, y: 240, title: "Webhook & reconcile", sub: "Verified PayPal events" },
  terminal: { x: 0, y: 240, title: "Settlement", sub: "Final payment state" },
};

const NODE_ICONS: Record<NodeId, typeof FileUp> = {
  intake: FileUp,
  analysis: Sparkles,
  review: BadgeCheck,
  approval: ShieldCheck,
  paypal: Wallet,
  tracking: Radar,
  webhook: MailCheck,
  terminal: ArrowUpRight,
};

// Which handles each node exposes, matching the snake flow direction.
type HandleSpec = { id: string; type: "source" | "target"; position: Position };

const HANDLES: Record<NodeId, HandleSpec[]> = {
  intake: [{ id: "r-s", type: "source", position: Position.Right }],
  analysis: [
    { id: "l-t", type: "target", position: Position.Left },
    { id: "r-s", type: "source", position: Position.Right },
    { id: "t-t", type: "target", position: Position.Top },
  ],
  review: [
    { id: "l-t", type: "target", position: Position.Left },
    { id: "r-s", type: "source", position: Position.Right },
    { id: "t-s", type: "source", position: Position.Top },
  ],
  approval: [
    { id: "l-t", type: "target", position: Position.Left },
    { id: "b-s", type: "source", position: Position.Bottom },
  ],
  paypal: [
    { id: "t-t", type: "target", position: Position.Top },
    { id: "l-s", type: "source", position: Position.Left },
  ],
  tracking: [
    { id: "r-t", type: "target", position: Position.Right },
    { id: "l-s", type: "source", position: Position.Left },
  ],
  webhook: [
    { id: "r-t", type: "target", position: Position.Right },
    { id: "l-s", type: "source", position: Position.Left },
  ],
  terminal: [{ id: "r-t", type: "target", position: Position.Right }],
};

export type WorkflowAuditEvent = {
  eventType: string;
  source: string;
  createdAt: string;
  details?: JsonRecord | null;
};

const PAID_PATTERN = /paid|partially_paid|marked_as_paid/i;

export function deriveNodeStates(
  transaction: RaisinTransaction | null,
  audit: WorkflowAuditEvent[],
  overrides: FlowNodeOverrides = {},
): Record<NodeId, FlowNodeState> {
  const eventTime = (type: string) => audit.find((event) => event.eventType === type)?.createdAt;
  const firstTextOfEvent = (type: string, key: string) => {
    const event = audit.find((item) => item.eventType === type);
    const details = event?.details;
    const value = details && typeof details === "object" ? (details as JsonRecord)[key] : undefined;
    return typeof value === "string" ? value : "";
  };
  const hasEvent = (type: string) => audit.some((event) => event.eventType === type);
  const analysis = transaction?.analysis ? (transaction.analysis as JsonRecord) : null;
  const approvalStatus = (transaction?.approvalStatus || "PENDING").toUpperCase();
  const paypalStatus = (transaction?.paypalStatus || "").toUpperCase();
  const approvals = Array.isArray(transaction?.raw["approvals"])
    ? (transaction!.raw["approvals"] as JsonRecord[])
    : [];
  const latestApproval = approvals[0];

  const states: Record<NodeId, FlowNodeState> = {
    intake: transaction
      ? {
          state: "success",
          timestamp: transaction.createdAt || eventTime("TRANSACTION_CREATED"),
          badge: transaction.invoiceNumber,
        }
      : { state: "pending", hint: "No transaction loaded" },
    analysis:
      analysis || hasEvent("AI_ANALYSIS_COMPLETED")
        ? {
            state: "success",
            timestamp: eventTime("AI_ANALYSIS_COMPLETED"),
            badge: String(analysis?.["riskLevel"] ?? "analysed").toLowerCase(),
          }
        : { state: "pending", hint: "Waiting for AI analysis" },
    review: hasEvent("DETAILS_EDITED")
      ? {
          state: "success",
          timestamp: eventTime("DETAILS_EDITED"),
          badge: `${audit.filter((e) => e.eventType === "DETAILS_EDITED").length} edits`,
        }
      : { state: "info", hint: "Optional — details can be edited before approval" },
    approval:
      approvalStatus === "APPROVED"
        ? {
            state: "success",
            timestamp:
              typeof latestApproval?.["approvedAt"] === "string"
                ? latestApproval["approvedAt"]
                : eventTime("APPROVAL_GRANTED"),
            badge: "approved",
          }
        : approvalStatus === "REJECTED"
          ? {
              state: "failed",
              timestamp: eventTime("APPROVAL_REJECTED"),
              badge: "rejected",
              hint: firstTextOfEvent("APPROVAL_REJECTED", "rejectedBy")
                ? `Rejected by ${firstTextOfEvent("APPROVAL_REJECTED", "rejectedBy")}`
                : "Payment rejected by an approver",
            }
          : approvalStatus === "INVALIDATED"
            ? {
                state: "invalidated",
                hint: "Details changed after approval — re-approval required",
              }
            : { state: "pending", hint: "Awaiting explicit human approval" },
    paypal: transaction?.paypalInvoiceId
      ? {
          state: "success",
          timestamp: eventTime("PAYPAL_INVOICE_CREATED_AND_SENT"),
          badge: transaction.paypalInvoiceId,
        }
      : { state: "pending", hint: "Blocked until approval is current" },
    tracking: paypalStatus
      ? {
          state: "success",
          timestamp: eventTime("PAYPAL_STATUS_UPDATED"),
          badge: paypalStatus.toLowerCase().replaceAll("_", " "),
        }
      : { state: "pending", hint: "No PayPal status retrieved yet" },
    webhook:
      hasEvent("PAYPAL_WEBHOOK_RECEIVED") || hasEvent("PAYPAL_STATUS_UPDATED")
        ? {
            state: "success",
            timestamp: eventTime("PAYPAL_WEBHOOK_RECEIVED") ?? eventTime("PAYPAL_STATUS_UPDATED"),
            badge: "verified events",
          }
        : { state: "pending", hint: "Listening for verified PayPal events" },
    terminal: PAID_PATTERN.test(paypalStatus)
      ? { state: "success", badge: paypalStatus.toLowerCase().replaceAll("_", " ") }
      : /cancel|refund|void/i.test(paypalStatus)
        ? { state: "info", badge: paypalStatus.toLowerCase().replaceAll("_", " ") }
        : { state: "pending", hint: "Awaiting verified payment evidence" },
  };

  for (const id of NODE_IDS) {
    const override = overrides[id];
    if (override) states[id] = { ...states[id], ...override };
  }
  return states;
}

export const CHAIN: NodeId[] = [
  "intake",
  "analysis",
  "review",
  "approval",
  "paypal",
  "tracking",
  "webhook",
  "terminal",
];

const CHAIN_HANDLES: Array<{ source: string; target: string }> = [
  { source: "r-s", target: "l-t" },
  { source: "r-s", target: "l-t" },
  { source: "r-s", target: "l-t" },
  { source: "b-s", target: "t-t" },
  { source: "l-s", target: "r-t" },
  { source: "l-s", target: "r-t" },
  { source: "l-s", target: "r-t" },
];

export function edgeIdFor(source: NodeId, target: NodeId) {
  return `${source}->${target}`;
}

function buildEdges(states: Record<NodeId, FlowNodeState>, pulse: EdgePulse): Edge[] {
  const edges: Edge[] = [];
  for (let index = 0; index < CHAIN.length - 1; index += 1) {
    const source = CHAIN[index]!;
    const target = CHAIN[index + 1]!;
    const sourceState = states[source].state;
    const targetState = states[target].state;
    const failed =
      targetState === "failed" || (sourceState === "failed" && targetState === "pending");
    const active =
      states[target].state === "running" ||
      (sourceState === "success" && targetState !== "pending" && targetState !== "info");
    const id = edgeIdFor(source, target);
    edges.push({
      id,
      source,
      target,
      type: "lifecycle",
      sourceHandle: CHAIN_HANDLES[index]!.source,
      targetHandle: CHAIN_HANDLES[index]!.target,
      data: {
        pulse: pulse && pulse.edgeId === id ? pulse.kind : undefined,
      },
      className: failed
        ? "rp-flow-edge-failed"
        : active
          ? "rp-flow-edge-active"
          : "rp-flow-edge-idle",
    });
  }
  edges.push({
    id: "review->analysis-loop",
    source: "review",
    target: "analysis",
    type: "lifecycle",
    sourceHandle: "t-s",
    targetHandle: "t-t",
    data: {
      pulse: pulse && pulse.edgeId === "review->analysis-loop" ? pulse.kind : undefined,
      label: "edits invalidate approval",
    },
    className:
      states["approval"].state === "invalidated" ? "rp-flow-edge-loop-active" : "rp-flow-edge-loop",
  });
  return edges;
}

type LifecycleEdgeData = {
  pulse?: PulseKind | undefined;
  label?: string | undefined;
};

function LifecycleEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  className,
}: EdgeProps & { className?: string | undefined }) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });
  const edgeData = (data ?? {}) as LifecycleEdgeData;
  return (
    <>
      <BaseEdge id={id} path={path} className={className} />
      {edgeData.pulse ? (
        <circle
          r={6}
          className={`rp-flow-pulse rp-flow-pulse-${edgeData.pulse}`}
          style={{ offsetPath: `path('${path}')` }}
        >
          <animate attributeName="r" from="3" to="6" dur="0.18s" fill="freeze" />
        </circle>
      ) : null}
      {edgeData.label ? (
        <EdgeLabelRenderer>
          <div
            className="rp-flow-edge-label"
            style={{
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {edgeData.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const edgeTypes: EdgeTypes = { lifecycle: LifecycleEdge };

function StateIcon({ state }: { state: NodeRunState }) {
  if (state === "running")
    return <LoaderCircle className="rp-flow-node-state rp-flow-running-icon animate-spin" />;
  if (state === "info")
    return (
      <span className="rp-flow-node-state rp-flow-info-icon">
        <Info className="size-3" />
      </span>
    );
  if (state === "success")
    return (
      <span className="rp-flow-node-state rp-flow-success-icon">
        <Check className="size-3" />
      </span>
    );
  if (state === "failed")
    return (
      <span className="rp-flow-node-state rp-flow-failed-icon">
        <X className="size-3" />
      </span>
    );
  if (state === "invalidated")
    return (
      <span className="rp-flow-node-state rp-flow-invalidated-icon">
        <AlertCircle className="size-3" />
      </span>
    );
  return <CircleDashed className="rp-flow-node-state rp-flow-pending-icon" />;
}

type LifecycleNodeData = {
  id: NodeId;
  title: string;
  sub: string;
  state: NodeRunState;
  badge?: string | undefined;
  hint?: string | undefined;
  timestamp?: string | undefined;
  selected?: boolean;
};

function LifecycleNode({ data }: NodeProps<Node<LifecycleNodeData>>) {
  const node = data;
  const Icon = NODE_ICONS[node.id];
  const time = node.timestamp ? new Date(node.timestamp) : null;
  return (
    <div
      className={`rp-flow-node rp-flow-node-${node.state} ${node.selected ? "rp-flow-node-selected" : ""}`}
      data-nodeid={node.id}
    >
      {HANDLES[node.id]!.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type={handle.type}
          position={handle.position}
          className="rp-flow-handle"
        />
      ))}
      <div className="rp-flow-node-head">
        <span className="rp-flow-node-icon">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="rp-flow-node-title">{node.title}</p>
          <p className="rp-flow-node-sub">{node.sub}</p>
        </div>
        <StateIcon state={node.state} />
      </div>
      <div className="rp-flow-node-foot">
        {node.badge ? <span className="rp-flow-node-badge">{node.badge}</span> : null}
        {node.hint ? <span className="rp-flow-node-hint">{node.hint}</span> : null}
        {time && !Number.isNaN(time.getTime()) ? (
          <span className="rp-flow-node-time">
            {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        ) : null}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = { lifecycle: LifecycleNode };

export function WorkflowCanvas({
  states,
  pulse,
  selectedNode,
  onSelectNode,
}: {
  states: Record<NodeId, FlowNodeState>;
  pulse: EdgePulse;
  selectedNode: NodeId | null;
  onSelectNode: (node: NodeId) => void;
}) {
  const nodes = useMemo<Node<NodeLifecycleData>[]>(
    () =>
      NODE_IDS.map((id) => ({
        id,
        type: "lifecycle" as const,
        position: { x: NODE_LAYOUT[id].x, y: NODE_LAYOUT[id].y },
        data: {
          id,
          title: NODE_LAYOUT[id].title,
          sub: NODE_LAYOUT[id].sub,
          ...states[id],
          selected: selectedNode === id,
        },
        selectable: true,
        draggable: false,
      })),
    [states, selectedNode],
  );
  const edges = useMemo(() => buildEdges(states, pulse), [states, pulse]);

  return (
    <div className="rp-flow-shell">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => onSelectNode(node.id as NodeId)}
        fitView
        fitViewOptions={{ padding: 0.06, maxZoom: 1.05 }}
        minZoom={0.5}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="var(--color-border)"
        />
        <Controls showInteractive={false} className="rp-flow-controls" />
      </ReactFlow>
    </div>
  );
}

type NodeLifecycleData = LifecycleNodeData;
