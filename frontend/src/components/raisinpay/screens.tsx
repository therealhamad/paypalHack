import { Link, useNavigate } from "@tanstack/react-router";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type RowClickedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileUp,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  EmptyState,
  ErrorState,
  LoadingLine,
  RaisinPayLayout,
  SearchInput,
  SectionLabel,
  StatusPill,
} from "@/components/raisinpay/shared";
import { useSession } from "@/lib/session";
import {
  analyzeTransaction,
  approveTransaction,
  askAssistant,
  rejectTransaction,
  createTransaction,
  getAuditTrail,
  getTransaction,
  getTransactions,
  RaisinApiError,
  refreshPaypalStatus,
  responseMessage,
  sendPaypalInvoice,
  updateTransaction,
  type JsonRecord,
  type RaisinTransaction,
} from "@/lib/raisinpay-api";

ModuleRegistry.registerModules([AllCommunityModule]);

const currencyOptions = ["USD", "EUR", "GBP", "CAD", "AUD"];
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
const formatDate = (value: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
};
const errorText = (cause: unknown) =>
  cause instanceof RaisinApiError
    ? cause.message
    : "Something unexpected happened. Please try again.";
const recordOf = (value: unknown): JsonRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
const rawText = (value: unknown) => (value == null ? "" : String(value));
const firstText = (record: JsonRecord | null, ...keys: string[]) => {
  if (!record) return "";
  for (const key of keys)
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  return "";
};

const transactionStatuses = ["all", "pending", "approved", "paid", "overdue", "rejected"];

export function TransactionsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RaisinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await getTransactions());
    } catch (cause) {
      setRows([]);
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    if (status === "all") return rows;
    return rows.filter((row) =>
      `${row.status} ${row.paymentStatus} ${row.approvalStatus}`.toLowerCase().includes(status),
    );
  }, [rows, status]);
  const columnDefs = useMemo<ColDef<RaisinTransaction>[]>(
    () => [
      {
        field: "invoiceNumber",
        headerName: "INVOICE",
        minWidth: 145,
        flex: 1,
        cellClass: "rp-grid-invoice",
        valueFormatter: (p) => p.value || "—",
      },
      {
        field: "supplierName",
        headerName: "SUPPLIER",
        minWidth: 160,
        flex: 1.2,
        valueFormatter: (p) => p.value || "—",
      },
      {
        field: "amount",
        headerName: "AMOUNT",
        minWidth: 130,
        flex: 0.9,
        valueFormatter: (p) => money(p.value, p.data?.currency || "USD"),
        comparator: (a, b) => (a ?? -Infinity) - (b ?? -Infinity),
      },
      {
        field: "currency",
        headerName: "CURRENCY",
        minWidth: 95,
        flex: 0.7,
        valueFormatter: (p) => p.value || "—",
      },
      {
        field: "createdAt",
        headerName: "CREATED",
        minWidth: 130,
        flex: 0.8,
        valueFormatter: (p) => formatDate(p.value),
      },
      {
        field: "dueDate",
        headerName: "DUE DATE",
        minWidth: 130,
        flex: 0.8,
        valueFormatter: (p) => formatDate(p.value),
      },
      {
        field: "aiRisk",
        headerName: "AI RISK",
        minWidth: 105,
        flex: 0.7,
        valueFormatter: (p) => p.value || "—",
      },
      {
        field: "approvalStatus",
        headerName: "APPROVAL",
        minWidth: 130,
        flex: 0.9,
        valueFormatter: (p) => p.value || "—",
      },
      {
        field: "paymentStatus",
        headerName: "PAYMENT",
        minWidth: 125,
        flex: 0.9,
        valueFormatter: (p) => p.value || p.data?.status || "—",
      },
    ],
    [],
  );
  const rowClicked = (event: RowClickedEvent<RaisinTransaction>) => {
    if (event.data?.id)
      void navigate({
        to: "/transactions/$transactionId",
        params: { transactionId: event.data.id },
      });
  };

  return (
    <RaisinPayLayout
      title="Transactions"
      description="Every invoice, approval, and payment in one place."
      action={
        <Button asChild className="rp-primary-button">
          <Link to="/payments/new">
            <FileUp className="size-4" />
            New payment
          </Link>
        </Button>
      }
    >
      <section className="rp-panel rp-transactions-panel">
        <div className="rp-table-toolbar">
          <div>
            <h2 className="text-sm font-semibold">All transactions</h2>
            <p>
              {loading
                ? "Loading workspace data"
                : `${rows.length} ${rows.length === 1 ? "transaction" : "transactions"} from your workspace`}
            </p>
          </div>
          <div className="rp-table-controls">
            <SearchInput value={search} onChange={setSearch} placeholder="Search invoices" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger
                className="rp-filter-select"
                aria-label="Filter transactions by status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {transactionStatuses.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item === "all" ? "All statuses" : item.charAt(0).toUpperCase() + item.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {error && <ErrorState message={error} onRetry={() => void load()} />}
        {loading ? (
          <LoadingLine label="Loading your transactions" />
        ) : !error && rows.length === 0 ? (
          <EmptyState
            icon={FileUp}
            title="No transactions yet"
            description="Upload an invoice or enter its details to create your first payment request."
            action={
              <Button asChild className="rp-primary-button">
                <Link to="/payments/new">
                  <FileUp className="size-4" />
                  Create a payment
                </Link>
              </Button>
            }
          />
        ) : (
          !error && (
            <div className="rp-ag-grid-shell">
              <AgGridReact<RaisinTransaction>
                rowData={filteredRows}
                columnDefs={columnDefs}
                theme={themeQuartz.withParams({
                  backgroundColor: "var(--color-card)",
                  foregroundColor: "var(--color-foreground)",
                  headerBackgroundColor: "var(--color-background)",
                  headerTextColor: "var(--color-muted-foreground)",
                  borderColor: "var(--color-border)",
                  rowHoverColor: "var(--color-accent)",
                  selectedRowBackgroundColor: "var(--color-accent)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  headerFontSize: 10,
                  rowHeight: 56,
                  headerHeight: 44,
                })}
                quickFilterText={search}
                pagination
                paginationPageSize={10}
                paginationPageSizeSelector={[10, 20, 50]}
                onRowClicked={rowClicked}
                rowSelection={{ mode: "singleRow", enableClickSelection: true }}
                suppressCellFocus={false}
                overlayNoRowsTemplate="<span class='rp-grid-empty'>No transactions match this filter.</span>"
              />
            </div>
          )
        )}
        {!loading && !error && rows.length > 0 && filteredRows.length === 0 && (
          <div className="rp-grid-no-results">No transactions match your search and filters.</div>
        )}
      </section>
    </RaisinPayLayout>
  );
}

export function ApprovalsPage() {
  const [rows, setRows] = useState<RaisinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await getTransactions());
    } catch (cause) {
      setRows([]);
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const pending = rows.filter((item) =>
    /pending|await|review/.test(item.approvalStatus.toLowerCase()),
  );
  return (
    <RaisinPayLayout
      title="Approvals"
      description="Review payment details before anything is sent."
      action={
        <span className="rp-manual-approval-note">
          <LockKeyhole className="size-3.5" /> Manual approval required
        </span>
      }
    >
      <div className="rp-approval-banner">
        <span className="rp-approval-banner-icon">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <strong>You’re in control of every payment.</strong>
          <p>
            Nothing is approved or sent to PayPal until an authorized teammate confirms the exact
            details.
          </p>
        </div>
      </div>
      <section className="rp-panel rp-approval-list-panel">
        <SectionLabel
          trailing={
            !loading && !error ? (
              <span className="rp-count-label">{pending.length} waiting</span>
            ) : null
          }
        >
          Needs your review
        </SectionLabel>
        {error && <ErrorState message={error} onRetry={() => void load()} />}
        {loading ? (
          <LoadingLine label="Checking for approvals" />
        ) : !error && pending.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="You’re all caught up"
            description="There are no payments awaiting approval. New requests will appear here after they’re submitted."
          />
        ) : (
          !error && (
            <div className="rp-approval-rows">
              {pending.map((item) => (
                <Link
                  key={item.id}
                  to="/transactions/$transactionId"
                  params={{ transactionId: item.id }}
                  className="rp-approval-row"
                >
                  <span className="rp-approval-file">
                    <FileCheck2 className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong>{item.supplierName || "Supplier not named"}</strong>
                    <small>
                      {item.invoiceNumber || "Invoice"} <span>·</span> Due{" "}
                      {formatDate(item.dueDate)}
                    </small>
                  </span>
                  <span className="rp-approval-amount">{money(item.amount, item.currency)}</span>
                  <StatusPill value={item.approvalStatus} />
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )
        )}
      </section>
      <p className="rp-trust-note">
        <ShieldAlert className="size-4" /> Raisin AI can highlight information for review; it does
        not verify fraud or approve payments.
      </p>
    </RaisinPayLayout>
  );
}

const paymentSchema = z
  .object({
    supplierName: z.string().trim().min(1, "Enter the supplier name."),
    supplierEmail: z.union([z.literal(""), z.string().email("Enter a valid email address.")]),
    invoiceNumber: z.string().trim().min(1, "Enter the invoice number."),
    description: z.string().trim().min(1, "Add a short description."),
    amount: z
      .string()
      .trim()
      .min(1, "Enter an amount.")
      .refine(
        (value) => Number.isFinite(Number(value)) && Number(value) > 0,
        "Enter an amount greater than zero.",
      ),
    currency: z.string().min(1, "Choose a currency."),
    issueDate: z.string().min(1, "Choose the issue date."),
    dueDate: z.string().min(1, "Choose the due date."),
    paymentTerms: z.string().trim().min(1, "Enter payment terms."),
  })
  .refine((fields) => !fields.issueDate || !fields.dueDate || fields.dueDate >= fields.issueDate, {
    message: "The due date can’t be earlier than the issue date.",
    path: ["dueDate"],
  });

type PaymentFields = z.infer<typeof paymentSchema>;
const initialPayment: PaymentFields = {
  supplierName: "",
  supplierEmail: "",
  invoiceNumber: "",
  description: "",
  amount: "",
  currency: "USD",
  issueDate: "",
  dueDate: "",
  paymentTerms: "Net 30",
};
const paymentFieldDetails: {
  key: keyof PaymentFields;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  wide?: boolean;
}[] = [
  {
    key: "supplierName",
    label: "Supplier name",
    placeholder: "e.g. Northstar Design Co.",
    required: true,
  },
  {
    key: "supplierEmail",
    label: "Supplier email",
    type: "email",
    placeholder: "billing@supplier.com",
  },
  { key: "invoiceNumber", label: "Invoice number", placeholder: "INV-2026-001", required: true },
  {
    key: "description",
    label: "Description",
    placeholder: "What is this payment for?",
    required: true,
    wide: true,
  },
];

export function NewPaymentPage() {
  const navigate = useNavigate();
  const [fields, setFields] = useState(initialPayment);
  const [errors, setErrors] = useState<Partial<Record<keyof PaymentFields, string>>>({});
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);

  const selectFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Choose a PDF invoice.");
      return;
    }
    if (candidate.size > 10 * 1024 * 1024) {
      toast.error("The invoice must be 10 MB or smaller.");
      return;
    }
    setFile(candidate);
  };
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) =>
    selectFile(event.target.files?.[0]);
  const setField = (key: keyof PaymentFields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = file ? { success: true as const } : paymentSchema.safeParse(fields);
    if (!validation.success) {
      const next: Partial<Record<keyof PaymentFields, string>> = {};
      for (const issue of validation.error.issues) {
        const key = issue.path[0] as keyof PaymentFields;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      document.getElementById(Object.keys(next)[0] || "supplierName")?.focus();
      return;
    }
    setErrors({});
    setSubmitting(true);
    setStep(1);
    try {
      let created: RaisinTransaction;
      if (file) {
        const body = new FormData();
        body.append("file", file);
        created = await createTransaction(body);
      } else {
        created = await createTransaction({
          supplierName: fields.supplierName,
          supplierEmail: fields.supplierEmail,
          invoiceNumber: fields.invoiceNumber,
          description: fields.description,
          amount: Number(fields.amount),
          currency: fields.currency,
          issueDate: fields.issueDate,
          dueDate: fields.dueDate,
          paymentTerms: fields.paymentTerms,
          lineItems: [],
        });
      }
      setStep(2);
      if (!file) {
        try {
          await analyzeTransaction(created.id);
        } catch (cause) {
          toast.error(
            `Payment request saved, but analysis couldn’t be started: ${errorText(cause)}`,
          );
        }
      }
      toast.success("Payment request created.");
      await navigate({ to: "/transactions/$transactionId", params: { transactionId: created.id } });
    } catch (cause) {
      toast.error(errorText(cause));
      setStep(0);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RaisinPayLayout
      title="New payment"
      description="Add the invoice details to prepare a payment request."
      action={
        <span className="rp-private-label">
          <LockKeyhole className="size-3.5" /> Private to your workspace
        </span>
      }
    >
      <Link to="/" className="rp-back-link">
        <ArrowLeft className="size-3.5" />
        Back to overview
      </Link>
      <form className="rp-payment-layout" onSubmit={submit} noValidate>
        <div className="rp-payment-main">
          <section className="rp-panel rp-upload-panel">
            <SectionLabel trailing={<span className="rp-optional-tag">OPTIONAL</span>}>
              Start with an invoice
            </SectionLabel>
            <label
              className={`rp-upload-zone ${dragging ? "rp-upload-zone-dragging" : ""} ${file ? "rp-upload-zone-selected" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                selectFile(event.dataTransfer.files[0]);
              }}
            >
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={onFileChange}
                aria-label="Upload a PDF invoice"
              />
              <span className="rp-upload-icon">
                {file ? <FileCheck2 className="size-5" /> : <Upload className="size-5" />}
              </span>
              <span className="rp-upload-copy">
                <strong>{file ? file.name : "Drop your invoice here"}</strong>
                <span>
                  {file ? (
                    `${(file.size / 1024 / 1024).toFixed(2)} MB · PDF`
                  ) : (
                    <>
                      or <span className="rp-inline-link">browse files</span> to upload
                    </>
                  )}
                </span>
              </span>
              {file && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rp-file-remove"
                  aria-label="Remove invoice file"
                  onClick={(event) => {
                    event.preventDefault();
                    setFile(null);
                  }}
                >
                  <X className="size-4" />
                </Button>
              )}
              {!file && <span className="rp-file-format">PDF · MAX 10 MB</span>}
            </label>
            {file && (
              <p className="rp-file-note">
                <Paperclip className="size-3.5" />
                Invoice is attached to this request. Extraction only appears if the service returns
                it.
              </p>
            )}
          </section>

          <section className="rp-panel rp-payment-form-panel">
            <SectionLabel
              trailing={
                <span className="rp-required-label">
                  {file ? "OPTIONAL WITH PDF" : "* REQUIRED"}
                </span>
              }
            >
              Payment details
            </SectionLabel>
            <p className="rp-form-intro">
              {file
                ? "Invoice details are optional while the uploaded PDF is being extracted. You can review and edit the result before approval."
                : "Enter the details as they appear on the invoice. You can review everything before approval."}
            </p>
            <div className="rp-form-grid">
              {paymentFieldDetails.map(
                ({ key, label, type = "text", placeholder, required, wide }) => (
                  <div key={key} className={`rp-field ${wide ? "rp-field-wide" : ""}`}>
                    <Label htmlFor={key} className="rp-field-label">
                      {label}
                      {required && !file && <span className="rp-required-star">*</span>}
                    </Label>
                    {key === "description" ? (
                      <Textarea
                        id={key}
                        value={fields[key]}
                        placeholder={placeholder}
                        aria-invalid={Boolean(errors[key])}
                        aria-describedby={errors[key] ? `${key}-error` : undefined}
                        onChange={(event) => setField(key, event.target.value)}
                        className="rp-textarea"
                      />
                    ) : (
                      <Input
                        id={key}
                        type={type}
                        value={fields[key]}
                        placeholder={placeholder}
                        aria-invalid={Boolean(errors[key])}
                        aria-describedby={errors[key] ? `${key}-error` : undefined}
                        onChange={(event) => setField(key, event.target.value)}
                        className="rp-form-input"
                      />
                    )}
                    {errors[key] && (
                      <span id={`${key}-error`} className="rp-field-error">
                        <AlertCircle className="size-3" />
                        {errors[key]}
                      </span>
                    )}
                  </div>
                ),
              )}
              <div className="rp-field">
                <Label htmlFor="amount" className="rp-field-label">
                  Amount{!file && <span className="rp-required-star">*</span>}
                </Label>
                <div className="rp-money-field">
                  <Select
                    value={fields.currency}
                    onValueChange={(value) => setField("currency", value)}
                  >
                    <SelectTrigger className="rp-currency-select" aria-label="Invoice currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="amount"
                    inputMode="decimal"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={fields.amount}
                    placeholder="0.00"
                    aria-invalid={Boolean(errors.amount)}
                    aria-describedby={errors.amount ? "amount-error" : undefined}
                    onChange={(event) => setField("amount", event.target.value)}
                    className="rp-form-input rp-amount-input"
                  />
                </div>
                {errors.amount && (
                  <span id="amount-error" className="rp-field-error">
                    <AlertCircle className="size-3" />
                    {errors.amount}
                  </span>
                )}
              </div>
              <div className="rp-field">
                <Label htmlFor="paymentTerms" className="rp-field-label">
                  Payment terms{!file && <span className="rp-required-star">*</span>}
                </Label>
                <Input
                  id="paymentTerms"
                  value={fields.paymentTerms}
                  aria-invalid={Boolean(errors.paymentTerms)}
                  onChange={(event) => setField("paymentTerms", event.target.value)}
                  className="rp-form-input"
                />
                {errors.paymentTerms && (
                  <span className="rp-field-error">
                    <AlertCircle className="size-3" />
                    {errors.paymentTerms}
                  </span>
                )}
              </div>
              <div className="rp-field">
                <Label htmlFor="issueDate" className="rp-field-label">
                  Issue date{!file && <span className="rp-required-star">*</span>}
                </Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={fields.issueDate}
                  aria-invalid={Boolean(errors.issueDate)}
                  onChange={(event) => setField("issueDate", event.target.value)}
                  className="rp-form-input"
                />
                {errors.issueDate && (
                  <span className="rp-field-error">
                    <AlertCircle className="size-3" />
                    {errors.issueDate}
                  </span>
                )}
              </div>
              <div className="rp-field">
                <Label htmlFor="dueDate" className="rp-field-label">
                  Due date{!file && <span className="rp-required-star">*</span>}
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={fields.dueDate}
                  aria-invalid={Boolean(errors.dueDate)}
                  onChange={(event) => setField("dueDate", event.target.value)}
                  className="rp-form-input"
                />
                {errors.dueDate && (
                  <span id="dueDate-error" className="rp-field-error">
                    <AlertCircle className="size-3" />
                    {errors.dueDate}
                  </span>
                )}
              </div>
            </div>
            <div className="rp-form-divider" />
            <div className="rp-form-footnote">
              <Sparkles className="size-3.5" />
              <span>
                Analysis uses only information returned by the service. Review invoice details
                before approving.
              </span>
            </div>
          </section>
        </div>

        <aside className="rp-payment-aside">
          <div className="rp-payment-summary">
            <span className="rp-summary-icon">
              <FileCheck2 className="size-4" />
            </span>
            <h2>Request summary</h2>
            <p>Check the essentials before you continue.</p>
            <div className="rp-summary-divider" />
            <dl>
              <div>
                <dt>SUPPLIER</dt>
                <dd>{fields.supplierName || "Not added"}</dd>
              </div>
              <div>
                <dt>INVOICE</dt>
                <dd>{fields.invoiceNumber || "Not added"}</dd>
              </div>
              <div>
                <dt>AMOUNT</dt>
                <dd className="rp-summary-total">
                  {fields.amount ? money(Number(fields.amount), fields.currency) : "—"}
                </dd>
              </div>
              <div>
                <dt>DUE DATE</dt>
                <dd>{formatDate(fields.dueDate)}</dd>
              </div>
            </dl>
            <Button
              type="submit"
              className="rp-primary-button rp-submit-payment"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  {step === 1 ? "Creating request…" : "Starting analysis…"}
                </>
              ) : (
                <>
                  Continue to review
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
            <div className="rp-summary-trust">
              <ShieldCheck className="size-3.5" />
              No payment is sent until you approve it.
            </div>
          </div>
          <div className="rp-aside-note">
            <span className="rp-aside-note-icon">
              <Clock3 className="size-4" />
            </span>
            <div>
              <strong>Approval always stays with you.</strong>
              <p>Review the details and confirm before a PayPal invoice is created.</p>
            </div>
          </div>
        </aside>
      </form>
    </RaisinPayLayout>
  );
}

type ChatMessage = { role: "user" | "assistant"; text: string };
const suggestedQuestions = [
  "Which invoices are overdue?",
  "How much do we currently have outstanding?",
  "Which transactions need approval?",
];

export function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event?: FormEvent<HTMLFormElement>, suggested?: string) => {
    event?.preventDefault();
    const message = (suggested ?? question).trim();
    if (!message || sending) return;
    setError("");
    setQuestion("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    setSending(true);
    try {
      const result = await askAssistant(message);
      const record = recordOf(result);
      const answer =
        responseMessage(result) ||
        firstText(recordOf(record?.["data"]), "message", "answer", "response", "text");
      if (!answer) {
        setError("The service didn’t return an answer. Please try again.");
        return;
      }
      setMessages((current) => [...current, { role: "assistant", text: answer }]);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSending(false);
    }
  };

  return (
    <RaisinPayLayout
      title="AI assistant"
      description="Ask about your payment operations, using your workspace data."
    >
      <div className="rp-assistant-workspace">
        <div className="rp-assistant-chat-panel">
          <div className="rp-assistant-chat-header">
            <span className="rp-assistant-avatar">
              <Sparkles className="size-4" />
            </span>
            <div>
              <strong>Raisin AI</strong>
              <span>
                <span className="rp-assistant-online-dot" />
                Connected to workspace data
              </span>
            </div>
            <span className="rp-ai-label">AI ASSISTANT</span>
          </div>
          <div className="rp-chat-messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="rp-chat-welcome">
                <span className="rp-chat-welcome-icon">
                  <WandSparkles className="size-5" />
                </span>
                <h2>What would you like to know?</h2>
                <p>
                  Ask a question and Raisin AI will look at the information available to your
                  workspace.
                </p>
                <div className="rp-suggestion-list">
                  {suggestedQuestions.map((item) => (
                    <button key={item} type="button" onClick={() => void submit(undefined, item)}>
                      {item}
                      <ArrowRight className="size-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((item, index) => (
              <div
                key={`${item.role}-${index}`}
                className={`rp-chat-message rp-chat-message-${item.role}`}
              >
                <span
                  className={
                    item.role === "assistant" ? "rp-chat-avatar-small" : "rp-chat-user-avatar"
                  }
                >
                  {item.role === "assistant" ? <Sparkles className="size-3.5" /> : "HH"}
                </span>
                <div className="rp-chat-message-body">
                  <span>{item.role === "assistant" ? "RAISIN AI" : "YOU"}</span>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="rp-chat-message rp-chat-message-assistant">
                <span className="rp-chat-avatar-small">
                  <Sparkles className="size-3.5" />
                </span>
                <div className="rp-chat-message-body">
                  <span>RAISIN AI</span>
                  <p className="rp-chat-typing">
                    <span />
                    <span />
                    <span />
                  </p>
                </div>
              </div>
            )}
            {error && (
              <div className="rp-chat-error" role="alert">
                <AlertCircle className="size-4" />
                <span>{error}</span>
              </div>
            )}
          </div>
          <form className="rp-chat-composer" onSubmit={(event) => void submit(event)}>
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about your transactions…"
              aria-label="Ask Raisin AI about your transactions"
              className="rp-chat-input"
              rows={2}
            />
            <div>
              <span>Answers come from your actual workspace data.</span>
              <Button
                type="submit"
                className="rp-chat-send"
                size="icon"
                disabled={!question.trim() || sending}
                aria-label="Send question"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </form>
        </div>
        <aside className="rp-assistant-context">
          <SectionLabel>Workspace context</SectionLabel>
          <div className="rp-context-empty">
            <span className="rp-context-icon">
              <MessageSquareText className="size-4" />
            </span>
            <strong>Context loads when you ask</strong>
            <p>Raisin AI responds to your question using only data returned by your workspace.</p>
          </div>
          <div className="rp-context-security">
            <ShieldCheck className="size-4" />
            <span>
              Your answers are generated from available workspace data. Verify payment details
              before acting.
            </span>
          </div>
        </aside>
      </div>
    </RaisinPayLayout>
  );
}

type AuditEvent = { label: string; createdAt: string; status?: string; raw: JsonRecord };

function eventLabel(event: JsonRecord) {
  return firstText(event, "eventType", "event", "action", "type", "name", "title", "description");
}

function eventTimestamp(event: JsonRecord) {
  return firstText(event, "created_at", "createdAt", "timestamp", "occurred_at", "date");
}

const lifecycleTerms = [
  "created",
  "analysis",
  "review",
  "approv",
  "paypal",
  "sent",
  "paid",
  "received",
];

function Timeline({ events }: { events: AuditEvent[] }) {
  if (events.length === 0)
    return (
      <div className="rp-timeline-empty">
        <Clock3 className="size-4" />
        <span>Lifecycle events will appear when the service records them.</span>
      </div>
    );
  return (
    <div className="rp-timeline">
      {events.map((event, index) => (
        <div key={`${event.label}-${event.createdAt}-${index}`} className="rp-timeline-row">
          <span className="rp-timeline-marker">
            <Check className="size-3" />
          </span>
          <span className="rp-timeline-copy">
            <strong>{event.label.replaceAll("_", " ")}</strong>
            <small>{formatDate(event.createdAt)}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

const asStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

function AnalysisPanel({ analysis }: { analysis: unknown }) {
  const record = recordOf(analysis);
  if (!record)
    return (
      <div className="rp-analysis-empty">
        <Sparkles className="size-4" />
        <span>Analysis details haven’t been returned by the service.</span>
      </div>
    );
  const findings = Array.isArray(record["findings"]) ? record["findings"] : [];
  const explanation = firstText(record, "explanation");
  const recommended = firstText(record, "recommendedNextAction", "recommended_next_action");
  const missing = asStringList(record["missingInformation"]);
  const inconsistencies = asStringList(record["inconsistencies"]);
  const duplicates = asStringList(record["duplicateWarnings"]);
  const riskLevel = firstText(record, "riskLevel", "risk_level") || "unknown";
  const completeness = missing.length === 0 ? "complete" : `${missing.length} missing`;
  const consistency =
    inconsistencies.length === 0
      ? "consistent"
      : `${inconsistencies.length} issue${inconsistencies.length === 1 ? "" : "s"}`;
  const duplicateStatus = duplicates.length === 0 ? "none found" : `${duplicates.length} possible`;
  return (
    <div className="rp-analysis-content">
      <div className="rp-analysis-disclaimer">
        <ShieldAlert className="size-4" />
        <span>AI-generated review only. This is not verified fraud detection.</span>
      </div>
      <div className="rp-analysis-checks">
        <div className="rp-analysis-check">
          <span>Risk level</span>
          <StatusPill value={riskLevel} />
        </div>
        <div className="rp-analysis-check">
          <span>Invoice completeness</span>
          <StatusPill value={completeness} />
        </div>
        <div className="rp-analysis-check">
          <span>Arithmetic consistency</span>
          <StatusPill value={consistency} />
        </div>
        <div className="rp-analysis-check">
          <span>Duplicate checks</span>
          <StatusPill value={duplicateStatus} />
        </div>
      </div>
      {explanation && <p className="rp-analysis-overview">{explanation}</p>}
      {missing.length > 0 && (
        <div className="rp-findings-list">
          <div className="rp-finding-row">
            <span className="rp-finding-mark rp-finding-warning">
              <CircleAlert className="size-4" />
            </span>
            <div>
              <div className="rp-finding-heading">
                <strong>Missing information</strong>
                <StatusPill value="needs review" />
              </div>
              <ul className="rp-finding-evidence-list">
                {missing.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      {findings.length > 0 ? (
        <div className="rp-findings-list">
          {findings.map((finding, index) => {
            const item = recordOf(finding);
            const message = firstText(item, "message", "title", "description") || "Finding";
            const detail = firstText(item, "evidence", "explanation");
            const severity = firstText(item, "severity", "level") || "information";
            return (
              <div key={`${message}-${index}`} className="rp-finding-row">
                <span className={`rp-finding-mark rp-finding-${severity.toLowerCase()}`}>
                  <CircleAlert className="size-4" />
                </span>
                <div>
                  <div className="rp-finding-heading">
                    <strong>{message}</strong>
                    <StatusPill value={severity.replaceAll("_", " ")} />
                  </div>
                  {detail && <p>{detail}</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        missing.length === 0 && (
          <div className="rp-analysis-empty">
            <Sparkles className="size-4" />
            <span>No findings were returned by the service.</span>
          </div>
        )
      )}
      {inconsistencies.length > 0 && (
        <ul className="rp-finding-evidence-list">
          {inconsistencies.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
      {duplicates.length > 0 && (
        <ul className="rp-finding-evidence-list">
          {duplicates.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
      {recommended && (
        <div className="rp-analysis-next-action">
          <strong>Suggested next step</strong>
          <p>{recommended}</p>
        </div>
      )}
    </div>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rp-detail-value">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

type EditFields = {
  supplierName: string;
  supplierEmail: string;
  invoiceNumber: string;
  description: string;
  amount: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
};

const editFieldDetails: { key: keyof EditFields; label: string; type?: string; wide?: boolean }[] =
  [
    { key: "supplierName", label: "Supplier name" },
    { key: "supplierEmail", label: "Supplier email", type: "email" },
    { key: "invoiceNumber", label: "Invoice number" },
    { key: "amount", label: "Amount", type: "number" },
    { key: "currency", label: "Currency" },
    { key: "issueDate", label: "Issue date", type: "date" },
    { key: "dueDate", label: "Due date", type: "date" },
    { key: "paymentTerms", label: "Payment terms" },
    { key: "description", label: "Description", wide: true },
  ];

const dayValue = (value: string) => (value ? value.slice(0, 10) : "");

function editFieldsFrom(transaction: RaisinTransaction): EditFields {
  return {
    supplierName: transaction.supplierName,
    supplierEmail: transaction.supplierEmail,
    invoiceNumber: transaction.invoiceNumber,
    description: transaction.description,
    amount: transaction.amount === null ? "" : String(transaction.amount),
    currency: transaction.currency || "USD",
    issueDate: dayValue(transaction.issueDate),
    dueDate: dayValue(transaction.dueDate),
    paymentTerms: transaction.paymentTerms,
  };
}

function validateEditFields(fields: EditFields): Partial<Record<keyof EditFields, string>> {
  const errors: Partial<Record<keyof EditFields, string>> = {};
  if (!fields.supplierName.trim()) errors.supplierName = "Enter the supplier name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.supplierEmail.trim()))
    errors.supplierEmail = "Enter a valid email address.";
  if (!fields.invoiceNumber.trim()) errors.invoiceNumber = "Enter the invoice number.";
  if (!fields.description.trim()) errors.description = "Add a short description.";
  if (!(Number(fields.amount) > 0)) errors.amount = "Enter an amount greater than zero.";
  if (!/^[A-Za-z]{3}$/.test(fields.currency.trim()))
    errors.currency = "Use a 3-letter currency code.";
  if (!fields.issueDate) errors.issueDate = "Choose the issue date.";
  if (!fields.dueDate) errors.dueDate = "Choose the due date.";
  if (fields.issueDate && fields.dueDate && fields.dueDate < fields.issueDate)
    errors.dueDate = "The due date can’t be earlier than the issue date.";
  return errors;
}

export function TransactionDetailPage({ transactionId }: { transactionId: string }) {
  const [transaction, setTransaction] = useState<RaisinTransaction | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFields, setEditFields] = useState<EditFields | null>(null);
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof EditFields, string>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [detail, audit] = await Promise.all([
        getTransaction(transactionId),
        getAuditTrail(transactionId).catch(() => []),
      ]);
      setTransaction(detail);
      const normalizedEvents = audit.flatMap((value) => {
        const raw = recordOf(value);
        const label = raw ? eventLabel(raw) : "";
        if (!raw || !label) return [];
        return [{ label, createdAt: eventTimestamp(raw), status: firstText(raw, "status"), raw }];
      });
      setEvents(
        normalizedEvents.sort((a, b) => {
          const ai = lifecycleTerms.findIndex((term) => a.label.toLowerCase().includes(term));
          const bi = lifecycleTerms.findIndex((term) => b.label.toLowerCase().includes(term));
          if (ai >= 0 && bi >= 0 && ai !== bi) return ai - bi;
          return a.createdAt.localeCompare(b.createdAt);
        }),
      );
    } catch (cause) {
      setTransaction(null);
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [transactionId]);
  useEffect(() => {
    void load();
  }, [load]);

  const paypal =
    recordOf(transaction?.raw["paypal_invoice"]) ?? recordOf(transaction?.raw["payment"]);
  const paypalUrl =
    transaction?.paypalPayerUrl ||
    transaction?.paypalInvoiceUrl ||
    firstText(paypal, "invoice_url", "url", "href");
  const isApproved = /approved|complete|confirmed/.test(
    transaction?.approvalStatus.toLowerCase() || "",
  );
  const isRejected = /rejected/.test(transaction?.approvalStatus.toLowerCase() || "");
  const { user } = useSession();
  const isApprover = !user || user.role === "APPROVER";
  const isPaid = /paid|received|complete/.test(
    `${transaction?.paymentStatus} ${transaction?.status}`.toLowerCase(),
  );
  const timelineItems = useMemo(() => events.filter((event) => event.label), [events]);

  const startEdit = () => {
    if (!transaction) return;
    setEditFields(editFieldsFrom(transaction));
    setEditErrors({});
    setEditing(true);
  };
  const saveEdit = async () => {
    if (!transaction || !editFields) return;
    const errors = validateEditFields(editFields);
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setSavingEdit(true);
    try {
      const rawItems = Array.isArray(transaction.raw["lineItems"])
        ? (transaction.raw["lineItems"] as JsonRecord[])
        : [];
      const lineItems = rawItems
        .map((item) => ({
          description: rawText(item["description"]),
          quantity: Number(item["quantity"]),
          unitPrice: Number(item["unitPrice"]),
          total: Number(item["total"]),
        }))
        .filter(
          (item) =>
            item.description && [item.quantity, item.unitPrice, item.total].every(Number.isFinite),
        );
      await updateTransaction(transaction.id, {
        supplierName: editFields.supplierName.trim(),
        supplierEmail: editFields.supplierEmail.trim(),
        invoiceNumber: editFields.invoiceNumber.trim(),
        description: editFields.description.trim(),
        amount: Number(editFields.amount),
        currency: editFields.currency.trim().toUpperCase(),
        issueDate: editFields.issueDate,
        dueDate: editFields.dueDate,
        paymentTerms: editFields.paymentTerms.trim() || null,
        lineItems,
      });
      setEditing(false);
      toast.success("Details updated. Any previous approval was invalidated.");
      try {
        await analyzeTransaction(transaction.id);
      } catch (cause) {
        toast.error(`Re-analysis couldn’t start: ${errorText(cause)}`);
      }
      await load();
    } catch (cause) {
      toast.error(errorText(cause));
    } finally {
      setSavingEdit(false);
    }
  };

  const refreshStatus = async () => {
    setRefreshing(true);
    try {
      await refreshPaypalStatus(transactionId);
      toast.success("Payment status refreshed.");
      await load();
    } catch (cause) {
      toast.error(errorText(cause));
    } finally {
      setRefreshing(false);
    }
  };
  const confirmApproval = async () => {
    setActing(true);
    try {
      await approveTransaction(transactionId);
      setApproveOpen(false);
      toast.success("Approval recorded by the service.");
      await load();
    } catch (cause) {
      toast.error(errorText(cause));
    } finally {
      setActing(false);
    }
  };
  const confirmRejection = async () => {
    setActing(true);
    try {
      await rejectTransaction(transactionId, rejectReason);
      setRejectOpen(false);
      setRejectReason("");
      toast.success("Rejection recorded on the audit trail.");
      await load();
    } catch (cause) {
      toast.error(errorText(cause));
    } finally {
      setActing(false);
    }
  };
  const sendInvoice = async () => {
    setActing(true);
    try {
      const response = await sendPaypalInvoice(transactionId);
      const body = recordOf(response);
      const payment = recordOf(body?.["paypal_invoice"]) ?? recordOf(body?.["payment"]) ?? body;
      const url = firstText(payment, "invoice_url", "url", "href");
      if (url && !/^https:\/\//i.test(url))
        throw new Error("The service returned a non-secure invoice link; it wasn’t opened.");
      toast.success("Invoice request accepted by the service.");
      await load();
    } catch (cause) {
      toast.error(errorText(cause));
    } finally {
      setActing(false);
    }
  };

  const routeAction =
    transaction && !isApproved && !isRejected ? (
      <div className="rp-action-pair">
        <Button
          className="rp-primary-button"
          onClick={() => setApproveOpen(true)}
          disabled={!isApprover}
        >
          <ShieldCheck className="size-4" />
          Review &amp; approve
        </Button>
        {isApprover && (
          <Button variant="destructive" onClick={() => setRejectOpen(true)}>
            <ThumbsDown className="size-4" />
            Reject
          </Button>
        )}
      </div>
    ) : transaction && isApproved && !isPaid && !paypalUrl ? (
      <Button className="rp-primary-button" onClick={() => void sendInvoice()} disabled={acting}>
        {acting ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <ArrowUpRight className="size-4" />
        )}
        Create PayPal invoice
      </Button>
    ) : null;

  return (
    <RaisinPayLayout
      title="Transaction details"
      description="Review the request, analysis, and recorded payment history."
      action={routeAction}
    >
      <Link to="/transactions" className="rp-back-link">
        <ArrowLeft className="size-3.5" />
        All transactions
      </Link>
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {loading ? (
        <div className="rp-panel rp-detail-loading">
          <LoadingLine label="Loading transaction details" />
        </div>
      ) : (
        transaction && (
          <>
            <section className="rp-detail-hero">
              <div className="rp-detail-hero-main">
                <span className="rp-detail-file-icon">
                  <FileCheck2 className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="rp-detail-invoice-id">
                    {transaction.invoiceNumber || "Invoice reference unavailable"}
                  </p>
                  <h2>{transaction.supplierName || "Supplier not named"}</h2>
                  <p>{transaction.supplierEmail || "Supplier email not provided"}</p>
                </div>
              </div>
              <div className="rp-detail-hero-amount">
                <span>PAYMENT AMOUNT</span>
                <strong>{money(transaction.amount, transaction.currency)}</strong>
                <div>
                  <StatusPill value={transaction.paymentStatus || transaction.status} />
                  <StatusPill value={transaction.approvalStatus} />
                </div>
              </div>
            </section>

            <div className="rp-detail-grid">
              <div className="rp-detail-main-column">
                <section className="rp-panel rp-detail-panel">
                  <SectionLabel
                    trailing={
                      !editing ? (
                        <Button variant="outline" size="sm" onClick={startEdit}>
                          Edit details
                        </Button>
                      ) : (
                        <span className="rp-optional-tag">EDITING</span>
                      )
                    }
                  >
                    Invoice information
                  </SectionLabel>
                  {editing && editFields ? (
                    <form
                      className="rp-edit-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveEdit();
                      }}
                      noValidate
                    >
                      <div className="rp-form-grid">
                        {editFieldDetails.map(({ key, label, type = "text", wide }) => (
                          <div key={key} className={`rp-field ${wide ? "rp-field-wide" : ""}`}>
                            <Label htmlFor={`edit-${key}`} className="rp-field-label">
                              {label}
                            </Label>
                            {key === "description" ? (
                              <Textarea
                                id={`edit-${key}`}
                                value={editFields[key]}
                                aria-invalid={Boolean(editErrors[key])}
                                onChange={(event) => {
                                  setEditFields((current) =>
                                    current ? { ...current, [key]: event.target.value } : current,
                                  );
                                  setEditErrors((current) => {
                                    const next: Partial<Record<keyof EditFields, string>> = {
                                      ...current,
                                    };
                                    delete next[key];
                                    return next;
                                  });
                                }}
                                className="rp-textarea"
                              />
                            ) : (
                              <Input
                                id={`edit-${key}`}
                                type={type}
                                value={editFields[key]}
                                step={key === "amount" ? "0.01" : undefined}
                                aria-invalid={Boolean(editErrors[key])}
                                onChange={(event) => {
                                  setEditFields((current) =>
                                    current ? { ...current, [key]: event.target.value } : current,
                                  );
                                  setEditErrors((current) => {
                                    const next: Partial<Record<keyof EditFields, string>> = {
                                      ...current,
                                    };
                                    delete next[key];
                                    return next;
                                  });
                                }}
                                className="rp-form-input"
                              />
                            )}
                            {editErrors[key] && (
                              <span className="rp-field-error">
                                <AlertCircle className="size-3" />
                                {editErrors[key]}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="rp-edit-actions">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditing(false)}
                          disabled={savingEdit}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" className="rp-primary-button" disabled={savingEdit}>
                          {savingEdit ? (
                            <>
                              <LoaderCircle className="size-4 animate-spin" />
                              Saving…
                            </>
                          ) : (
                            <>
                              <Check className="size-4" />
                              Save changes
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="rp-edit-note">
                        <AlertCircle className="size-3.5" />
                        <span>
                          Saving new details invalidates any previous approval and clears the
                          previous AI analysis. The request must be analysed and approved again
                          before a PayPal invoice is created.
                        </span>
                      </p>
                    </form>
                  ) : (
                    <dl className="rp-detail-information-grid">
                      <SummaryValue label="Invoice number" value={transaction.invoiceNumber} />
                      <SummaryValue label="Supplier" value={transaction.supplierName} />
                      <SummaryValue label="Email" value={transaction.supplierEmail} />
                      <SummaryValue label="Description" value={transaction.description} />
                      <SummaryValue
                        label="Amount"
                        value={money(transaction.amount, transaction.currency)}
                      />
                      <SummaryValue label="Currency" value={transaction.currency} />
                      <SummaryValue label="Issue date" value={formatDate(transaction.issueDate)} />
                      <SummaryValue label="Due date" value={formatDate(transaction.dueDate)} />
                      <SummaryValue label="Payment terms" value={transaction.paymentTerms} />
                    </dl>
                  )}
                </section>

                <section className="rp-panel rp-detail-panel">
                  <SectionLabel
                    trailing={
                      <span className="rp-ai-label rp-ai-label-solid">
                        <Sparkles className="size-3" /> RAISIN AI
                      </span>
                    }
                  >
                    AI analysis
                  </SectionLabel>
                  <AnalysisPanel analysis={transaction.analysis} />
                </section>

                <section className="rp-panel rp-detail-panel">
                  <SectionLabel
                    trailing={
                      paypalUrl && /^https:\/\//i.test(paypalUrl) ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="rp-open-paypal-button"
                        >
                          <a href={paypalUrl} target="_blank" rel="noreferrer">
                            Open PayPal invoice
                            <ArrowUpRight className="size-3.5" />
                          </a>
                        </Button>
                      ) : null
                    }
                  >
                    PayPal invoice
                  </SectionLabel>
                  <div className="rp-paypal-details">
                    <span className="rp-paypal-mark">P</span>
                    <div className="min-w-0 flex-1">
                      <strong>PayPal invoice</strong>
                      <p>
                        {transaction.paypalInvoiceId
                          ? `Reference ${transaction.paypalInvoiceId}`
                          : "No PayPal invoice reference returned"}
                      </p>
                    </div>
                    <StatusPill
                      value={transaction.paymentStatus || (paypalUrl ? "created" : "not created")}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Refresh payment status"
                      title="Refresh payment status"
                      onClick={() => void refreshStatus()}
                      disabled={refreshing}
                    >
                      <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  <p className="rp-paypal-footnote">
                    <LockKeyhole className="size-3.5" />
                    PayPal details and links only appear when returned by the service.
                  </p>
                </section>

                <section className="rp-panel rp-detail-panel">
                  <SectionLabel>Approval record</SectionLabel>
                  <div className="rp-approval-record">
                    <span className="rp-approval-record-icon">
                      <ShieldCheck className="size-4" />
                    </span>
                    <div>
                      <strong>{transaction.approvalStatus || "No approval status returned"}</strong>
                      <p>
                        {isApproved
                          ? firstText(
                              recordOf(transaction.raw["approval"]),
                              "approved_by",
                              "approver",
                              "created_at",
                              "approved_at",
                            ) || "Approval status was recorded by the service."
                          : "This payment has not been approved."}
                      </p>
                    </div>
                    {!isApproved && (
                      <Button
                        className="rp-primary-button"
                        size="sm"
                        onClick={() => setApproveOpen(true)}
                      >
                        Review &amp; approve
                      </Button>
                    )}
                  </div>
                </section>
              </div>

              <aside className="rp-panel rp-lifecycle-panel">
                <SectionLabel>Payment timeline</SectionLabel>
                <p className="rp-lifecycle-intro">
                  Only events recorded by the service appear here.
                </p>
                <Timeline events={timelineItems} />
              </aside>
            </div>
          </>
        )
      )}

      {transaction && (
        <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
          <AlertDialogContent className="rp-approve-dialog">
            <AlertDialogHeader>
              <span className="rp-dialog-icon">
                <ShieldCheck className="size-5" />
              </span>
              <AlertDialogTitle>Approve this payment?</AlertDialogTitle>
              <AlertDialogDescription>
                Approving authorizes the next PayPal invoice operation. Nothing is sent until you
                confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rp-confirm-summary">
              <div>
                <span>SUPPLIER</span>
                <strong>{transaction.supplierName || "Supplier not named"}</strong>
              </div>
              <div>
                <span>INVOICE</span>
                <strong>{transaction.invoiceNumber || "—"}</strong>
              </div>
              <div>
                <span>AMOUNT</span>
                <strong>{money(transaction.amount, transaction.currency)}</strong>
              </div>
              <div>
                <span>DUE DATE</span>
                <strong>{formatDate(transaction.dueDate)}</strong>
              </div>
            </div>
            <div className="rp-confirm-warning">
              <AlertCircle className="size-4" />
              <span>
                This approval may allow the service to create a PayPal invoice for these exact
                details.
              </span>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={acting}>Go back</AlertDialogCancel>
              <AlertDialogAction
                disabled={acting}
                onClick={(event) => {
                  event.preventDefault();
                  void confirmApproval();
                }}
              >
                {acting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Recording…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" />
                    Confirm approval
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {transaction && (
        <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <AlertDialogContent className="rp-approve-dialog">
            <AlertDialogHeader>
              <span className="rp-dialog-icon rp-dialog-icon-danger">
                <ThumbsDown className="size-5" />
              </span>
              <AlertDialogTitle>Reject this payment?</AlertDialogTitle>
              <AlertDialogDescription>
                Rejection is recorded on the audit trail with your name. The preparer can edit the
                details and re-request approval.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rp-confirm-summary">
              <div>
                <span>SUPPLIER</span>
                <strong>{transaction.supplierName || "Supplier not named"}</strong>
              </div>
              <div>
                <span>INVOICE</span>
                <strong>{transaction.invoiceNumber || "—"}</strong>
              </div>
              <div>
                <span>AMOUNT</span>
                <strong>{money(transaction.amount, transaction.currency)}</strong>
              </div>
            </div>
            <div className="rp-reject-reason">
              <label htmlFor="reject-reason">Reason (optional)</label>
              <input
                id="reject-reason"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="e.g. amount doesn't match the purchase order"
                maxLength={500}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={acting}>Go back</AlertDialogCancel>
              <AlertDialogAction
                disabled={acting}
                className="rp-destructive-action"
                onClick={(event) => {
                  event.preventDefault();
                  void confirmRejection();
                }}
              >
                {acting ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Recording…
                  </>
                ) : (
                  <>
                    <ThumbsDown className="size-4" />
                    Confirm rejection
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </RaisinPayLayout>
  );
}

export function WorkspaceSettingsPage() {
  return (
    <RaisinPayLayout
      title="Workspace settings"
      description="Workspace details and payment operations preferences."
    >
      <div className="rp-panel rp-settings-panel">
        <div className="rp-settings-icon">
          <ShieldCheck className="size-5" />
        </div>
        <h2>Workspace preferences</h2>
        <p>
          RaisinPay hasn’t received workspace settings from the service yet. No preferences have
          been assumed.
        </p>
        <Button asChild variant="outline">
          <Link to="/">
            Return to overview
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </RaisinPayLayout>
  );
}

export function ServiceUnavailableAction({ label }: { label: string }) {
  return (
    <Button variant="outline" size="sm" disabled title="This action is not available yet">
      <X className="size-3.5" />
      {label} unavailable
    </Button>
  );
}
