import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeAll } from "vitest";

import { WorkflowPage } from "@/components/raisinpay/workflow";

// React Flow needs browser APIs jsdom does not implement.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
class DOMMatrixReadOnlyStub {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([1-9.]+)\)/);
    this.m22 = scale ? Number(scale[1]) : 1;
  }
}

const detail = {
  id: "tx1",
  invoiceNumber: "INV-2026-0142",
  supplierName: "Northstar Design Co.",
  supplierEmail: "design@northstardesign.example",
  description: "Q4 brand refresh",
  amount: 4800,
  currency: "USD",
  createdAt: "2026-11-12T10:00:00.000Z",
  dueDate: "2026-11-19",
  issueDate: "2026-10-20",
  paymentTerms: "Net 30",
  aiRisk: "low",
  approvalStatus: "APPROVED",
  paymentStatus: "SENT",
  status: "SENT",
  paypalInvoiceId: "INV2-TEST-TEST-TEST-TEST",
  paypalInvoiceUrl: "https://api.sandbox.paypal.com/v2/invoicing/invoices/INV2-TEST-TEST-TEST-TEST",
  paypalPayerUrl: "https://www.sandbox.paypal.com/invoice/payer/#/details/INV2-TEST-TEST-TEST-TEST",
  paypalStatus: "SENT",
  analysis: {
    riskLevel: "low",
    findings: [],
    missingInformation: [],
    explanation: "All fields present.",
    recommendedNextAction: "Approve",
  },
  raw: {
    approvals: [
      {
        approvedBy: "workspace-user",
        approvedAt: "2026-11-12T11:00:00.000Z",
        approvedAmount: "4800",
        approvedCurrency: "USD",
        approvedSupplier: "Northstar Design Co.",
        detailsHash: "abc123",
      },
    ],
  },
};

const audit = [
  {
    id: "e1",
    transactionId: "tx1",
    eventType: "TRANSACTION_CREATED",
    source: "user",
    details: {},
    createdAt: "2026-11-12T10:00:00.000Z",
  },
  {
    id: "e2",
    transactionId: "tx1",
    eventType: "AI_ANALYSIS_COMPLETED",
    source: "ai",
    details: { riskLevel: "low" },
    createdAt: "2026-11-12T10:05:00.000Z",
  },
  {
    id: "e3",
    transactionId: "tx1",
    eventType: "APPROVAL_GRANTED",
    source: "user",
    details: {},
    createdAt: "2026-11-12T11:00:00.000Z",
  },
  {
    id: "e4",
    transactionId: "tx1",
    eventType: "PAYPAL_INVOICE_CREATED_AND_SENT",
    source: "paypal",
    details: {},
    createdAt: "2026-11-12T11:01:00.000Z",
  },
];

vi.mock("@/lib/raisinpay-api", () => ({
  RaisinApiError: class RaisinApiError extends Error {},
  getTransactions: vi.fn(async () => [detail]),
  getTransaction: vi.fn(async () => detail),
  getAuditTrail: vi.fn(async () => audit),
  refreshPaypalStatus: vi.fn(async () => ({})),
}));

describe("Lifecycle canvas", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "ResizeObserver", {
      writable: true,
      value: ResizeObserverStub,
    });
    Object.defineProperty(globalThis, "DOMMatrixReadOnly", {
      writable: true,
      value: DOMMatrixReadOnlyStub,
    });
  });

  const renderPage = () => {
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const workflowRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/workflow",
      component: WorkflowPage,
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([workflowRoute]),
      context: { queryClient: new QueryClient() },
      history: createMemoryHistory({ initialEntries: ["/workflow"] }),
    });
    return render(<RouterProvider router={router} />);
  };

  it("shows the picker placeholder before a transaction is selected", async () => {
    renderPage();
    expect(await screen.findByText(/pick a transaction to replay/i)).toBeInTheDocument();
  });

  it("renders the lifecycle graph and evidence for a selected transaction", async () => {
    renderPage();
    const select = await screen.findByLabelText(/replay a transaction/i);
    fireEvent.change(select, { target: { value: "tx1" } });

    await waitFor(() => {
      for (const title of [
        "Payment intake",
        "AI analysis",
        "Human approval",
        "PayPal create & send",
        "Settlement",
      ]) {
        expect(screen.getByText(title)).toBeInTheDocument();
      }
    });
    expect(await screen.findByText(/INV2-TEST-TEST-TEST-TEST/)).toBeInTheDocument();
    expect(screen.getByText(/transaction created/i)).toBeInTheDocument();
    expect(screen.getByText(/approval granted/i)).toBeInTheDocument();
  });
});
