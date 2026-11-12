export type JsonRecord = Record<string, unknown>;

export type RaisinTransaction = {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  supplierEmail: string;
  description: string;
  amount: number | null;
  currency: string;
  createdAt: string;
  dueDate: string;
  issueDate: string;
  paymentTerms: string;
  aiRisk: string;
  approvalStatus: string;
  paymentStatus: string;
  status: string;
  paypalInvoiceId: string;
  paypalInvoiceUrl: string;
  paypalPayerUrl: string;
  paypalStatus: string;
  analysis: unknown;
  raw: JsonRecord;
};

export class RaisinApiError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "RaisinApiError";
    this.status = status;
  }
}

const objectRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
};

const apiBaseUrl = (
  import.meta.env["VITE_API_BASE_URL"] ??
  "http://localhost:3001"
).replace(/\/$/, "");

const pick = (record: JsonRecord, ...keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
};

const text = (value: unknown) => (value == null ? "" : String(value));

const amountValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export function normalizeTransaction(input: unknown): RaisinTransaction {
  const raw = objectRecord(input) ?? {};
  const approval = objectRecord(pick(raw, "approval", "approval_record"));
  const payment = objectRecord(pick(raw, "payment", "paypal_invoice"));
  const amount = amountValue(pick(raw, "amount", "total_amount", "invoice_amount"));

  return {
    id: text(pick(raw, "id", "transaction_id", "uuid")),
    invoiceNumber: text(pick(raw, "invoice_number", "invoiceNumber", "invoice_ref", "reference")),
    supplierName: text(pick(raw, "supplier_name", "supplierName", "vendor_name", "supplier")),
    supplierEmail: text(pick(raw, "supplier_email", "supplierEmail", "vendor_email")),
    description: text(pick(raw, "description", "memo", "details")),
    amount,
    currency: text(pick(raw, "currency", "currency_code")).toUpperCase(),
    createdAt: text(pick(raw, "created_at", "createdAt", "created_date")),
    dueDate: text(pick(raw, "due_date", "dueDate")),
    issueDate: text(pick(raw, "issue_date", "issueDate")),
    paymentTerms: text(pick(raw, "payment_terms", "paymentTerms", "terms")),
    aiRisk: text(pick(raw, "ai_risk", "risk_level", "risk")),
    approvalStatus: text(
      pick(approval ?? raw, "status", "approval_status", "approvalStatus"),
    ),
    paymentStatus: text(pick(payment ?? raw, "status", "payment_status", "paymentStatus")),
    status: text(pick(raw, "status", "transaction_status", "payment_status")),
    paypalInvoiceId: text(
      pick(payment ?? raw, "paypal_invoice_id", "invoice_id", "paypalInvoiceId", "id"),
    ),
    paypalInvoiceUrl: text(
      pick(payment ?? raw, "paypal_invoice_url", "invoice_url", "paypalInvoiceUrl", "url"),
    ),
    paypalPayerUrl: text(pick(raw, "paypalPayerUrl", "paypal_payer_url")),
    paypalStatus: text(pick(raw, "paypalStatus", "paypal_status")),
    analysis: pick(raw, "ai_analysis", "analysis", "analysis_result"),
    raw,
  };
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: BodyInit | JsonRecord | FormData | null };

async function request(path: string, init: RequestOptions = {}): Promise<unknown> {
  const { body: initialBody, ...requestOptions } = init;
  const headers = new Headers(requestOptions.headers);
  headers.set("Accept", "application/json");
  let body = initialBody;
  if (body && typeof body === "object" && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  let response: Response;
  try {
    const requestInit: RequestInit = { ...requestOptions, headers, credentials: "include" };
    if (body !== undefined) requestInit.body = body;
    response = await fetch(`${apiBaseUrl}${path}`, requestInit);
  } catch {
    throw new RaisinApiError("RaisinPay couldn’t reach the service. Check your connection and try again.");
  }

  const responseText = await response.text();
  let payload: unknown = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = responseText;
    }
  }

  if (!response.ok) {
    const record = objectRecord(payload);
    const message = text(pick(record ?? {}, "message", "error", "detail"));
    throw new RaisinApiError(
      message || `The service returned an error (${response.status}). Your request was not confirmed.`,
      response.status,
    );
  }
  return payload;
}

function transactionRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = objectRecord(payload);
  const nested = objectRecord(record?.["data"]);
  const rows = pick(record ?? {}, "transactions", "items", "data");
  if (Array.isArray(rows)) return rows;
  const nestedRows = pick(nested ?? {}, "transactions", "items");
  if (Array.isArray(nestedRows)) return nestedRows;
  throw new RaisinApiError("The service response wasn’t in the expected format. No transaction data was shown.");
}

function transactionRecord(payload: unknown): JsonRecord | null {
  const record = objectRecord(payload);
  if (!record) return null;
  const data = objectRecord(record["data"]);
  const nested = objectRecord(record["transaction"]) ?? objectRecord(data?.["transaction"]) ?? data;
  return nested ?? record;
}

export async function getTransactions(): Promise<RaisinTransaction[]> {
  const rows = transactionRows(await request("/api/transactions"));
  return rows.map(normalizeTransaction);
}

export async function getTransaction(id: string): Promise<RaisinTransaction> {
  const record = transactionRecord(await request(`/api/transactions/${encodeURIComponent(id)}`));
  if (!record) throw new RaisinApiError("Transaction details weren’t available in the service response.");
  return normalizeTransaction(record);
}

export async function createTransaction(body: JsonRecord | FormData): Promise<RaisinTransaction> {
  const path = body instanceof FormData ? "/api/transactions/upload" : "/api/transactions";
  const record = transactionRecord(
    await request(path, { method: "POST", body: body as BodyInit }),
  );
  const transaction = record ? normalizeTransaction(record) : null;
  if (!transaction?.id) {
    throw new RaisinApiError(
      "The service didn’t return a transaction reference. Check Transactions before submitting again.",
    );
  }
  return transaction;
}

export async function updateTransaction(id: string, body: JsonRecord): Promise<RaisinTransaction> {
  const record = transactionRecord(
    await request(`/api/transactions/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  );
  const transaction = record ? normalizeTransaction(record) : null;
  if (!transaction?.id) {
    throw new RaisinApiError("The service didn’t confirm the update. Please review the transaction before retrying.");
  }
  return transaction;
}

export async function analyzeTransaction(id: string): Promise<unknown> {
  return request(`/api/transactions/${encodeURIComponent(id)}/analyze`, { method: "POST" });
}

export async function approveTransaction(id: string): Promise<unknown> {
  return request(`/api/transactions/${encodeURIComponent(id)}/approve`, { method: "POST" });
}

export async function sendPaypalInvoice(id: string): Promise<unknown> {
  return request(`/api/transactions/${encodeURIComponent(id)}/paypal/send`, { method: "POST" });
}

export async function refreshPaypalStatus(id: string): Promise<unknown> {
  return request(`/api/transactions/${encodeURIComponent(id)}/paypal/refresh`, { method: "POST" });
}

export async function getAuditTrail(id: string): Promise<unknown[]> {
  const payload = await request(`/api/transactions/${encodeURIComponent(id)}/audit`);
  if (Array.isArray(payload)) return payload;
  const record = objectRecord(payload);
  const rows = pick(record ?? {}, "audit", "events", "items", "data");
  return Array.isArray(rows) ? rows : [];
}

export type RaisinUser = {
  id: string;
  email: string;
  name: string;
  companyName: string | null;
  role: "PREPARER" | "APPROVER";
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  companyName: string;
  role: "PREPARER" | "APPROVER";
};

export async function registerAccount(input: RegisterInput): Promise<RaisinUser> {
  const envelope = objectRecord(
    await request("/api/auth/register", { method: "POST", body: input }),
  );
  const record = objectRecord(envelope?.["data"]) ?? envelope;
  const user = objectRecord(record?.["user"]);
  if (!user) throw new RaisinApiError("The service didn’t confirm the account. Please try again.");
  return user as unknown as RaisinUser;
}

export async function login(email: string, password: string): Promise<RaisinUser> {
  const envelope = objectRecord(
    await request("/api/auth/login", { method: "POST", body: { email, password } }),
  );
  const record = objectRecord(envelope?.["data"]) ?? envelope;
  const user = objectRecord(record?.["user"]);
  if (!user) throw new RaisinApiError("The service didn’t confirm the sign-in. Please try again.");
  return user as unknown as RaisinUser;
}

export async function logout(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<RaisinUser | null> {
  const envelope = objectRecord(await request("/api/auth/me"));
  const record = objectRecord(envelope?.["data"]) ?? envelope;
  const user = objectRecord(record?.["user"]);
  return user ? (user as unknown as RaisinUser) : null;
}

export async function rejectTransaction(id: string, reason = ""): Promise<unknown> {
  return request(`/api/transactions/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: { reason },
  });
}

export async function askAssistant(message: string): Promise<unknown> {
  return request("/api/ai/chat", { method: "POST", body: { question: message } });
}

export function responseMessage(payload: unknown): string {
  const record = objectRecord(payload);
  return text(pick(record ?? {}, "message", "answer", "response", "text"));
}