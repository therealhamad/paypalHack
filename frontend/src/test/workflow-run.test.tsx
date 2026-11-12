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
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkflowPage } from "@/components/raisinpay/workflow";

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
  id: "tx-run",
  invoiceNumber: "INV-2026-0155",
  supplierName: "Juniper Analytics Ltd",
  supplierEmail: "accounts@juniperanalytics.example",
  description: "Retainer",
  amount: 2850,
  currency: "USD",
  createdAt: "2026-11-12T12:00:00.000Z",
  dueDate: "2026-12-10",
  issueDate: "2026-11-10",
  paymentTerms: "Net 30",
  aiRisk: "low",
  approvalStatus: "PENDING",
  paymentStatus: "DRAFT",
  status: "DRAFT",
  paypalInvoiceId: "",
  paypalInvoiceUrl: "",
  paypalPayerUrl: "",
  paypalStatus: "",
  analysis: null,
  raw: {},
};

const mocks = vi.hoisted(() => ({
  createTransaction: vi.fn(),
  analyzeTransaction: vi.fn(),
  approveTransaction: vi.fn(),
  sendPaypalInvoice: vi.fn(),
  refreshPaypalStatus: vi.fn(),
  updateTransaction: vi.fn(),
  getTransactions: vi.fn(async () => []),
  getTransaction: vi.fn(async () => detail),
  getAuditTrail: vi.fn(async () => []),
}));

let paid = false;

vi.mock("@/lib/raisinpay-api", () => ({
  RaisinApiError: class RaisinApiError extends Error {},
  createTransaction: mocks.createTransaction,
  analyzeTransaction: mocks.analyzeTransaction,
  approveTransaction: mocks.approveTransaction,
  sendPaypalInvoice: mocks.sendPaypalInvoice,
  refreshPaypalStatus: mocks.refreshPaypalStatus,
  updateTransaction: mocks.updateTransaction,
  getTransactions: mocks.getTransactions,
  getTransaction: mocks.getTransaction,
  getAuditTrail: mocks.getAuditTrail,
}));

describe("Workflow live run (guided canvas)", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "ResizeObserver", {
      writable: true,
      value: ResizeObserverStub,
    });
    Object.defineProperty(globalThis, "DOMMatrixReadOnly", {
      writable: true,
      value: DOMMatrixReadOnlyStub,
    });
    vi.clearAllMocks();
    paid = false;
    mocks.createTransaction.mockResolvedValue({ ...detail, id: "tx-run" });
    mocks.analyzeTransaction.mockResolvedValue({});
    mocks.approveTransaction.mockImplementation(async () => {
      paid = true;
      return {};
    });
    mocks.sendPaypalInvoice.mockResolvedValue({});
    mocks.refreshPaypalStatus.mockResolvedValue({});
    mocks.getTransaction.mockImplementation(async () =>
      paid ? { ...detail, paypalStatus: "PAID" } : detail,
    );
  });

  const renderLiveMode = async () => {
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
    render(<RouterProvider router={router} />);
    fireEvent.click(await screen.findByRole("button", { name: /new live run/i }));
    fireEvent.click(await screen.findByRole("button", { name: /new payment/i }));
  };

  it("runs intake + analysis, pauses at the review gate, then completes after approval", async () => {
    await renderLiveMode();
    fireEvent.click(await screen.findByRole("button", { name: /start live run/i }));

    expect(mocks.createTransaction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.analyzeTransaction).toHaveBeenCalledTimes(1));
    expect(mocks.approveTransaction).not.toHaveBeenCalled();

    // Human gate: the flow waits for explicit approval.
    fireEvent.click(
      await screen.findByRole("button", { name: /approve & continue/i }, { timeout: 5000 }),
    );

    await waitFor(() => expect(mocks.approveTransaction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.sendPaypalInvoice).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.refreshPaypalStatus).toHaveBeenCalledTimes(1));

    // Webhook polling sees the real PAID status and settles the run.
    await waitFor(() => expect(screen.getByText(/payment settled/i)).toBeInTheDocument(), {
      timeout: 8000,
    });
  }, 20000);

  it("stops at a real PayPal failure and retries only from the failed step", async () => {
    mocks.sendPaypalInvoice.mockRejectedValueOnce(
      new Error("PayPal request failed (422): DUPLICATE_INVOICE_NUMBER"),
    );
    await renderLiveMode();
    fireEvent.click(await screen.findByRole("button", { name: /start live run/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /approve & continue/i }, { timeout: 5000 }),
    );

    await waitFor(() => expect(screen.getByText(/DUPLICATE_INVOICE_NUMBER/i)).toBeInTheDocument());
    expect(mocks.refreshPaypalStatus).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: /retry from this step/i }));
    await waitFor(() => expect(screen.getByText(/payment settled/i)).toBeInTheDocument(), {
      timeout: 8000,
    });
    expect(mocks.sendPaypalInvoice).toHaveBeenCalledTimes(2);
    expect(mocks.createTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.analyzeTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.approveTransaction).toHaveBeenCalledTimes(1);
  }, 25000);
});
