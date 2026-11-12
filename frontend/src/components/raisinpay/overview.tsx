import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, CircleHelp, Clock3, FilePlus2, ShieldCheck, Wallet, WandSparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, EmptyChart, EmptyState, LoadingLine, MetricCard, RaisinPayLayout, SectionLabel, StatusPill } from "@/components/raisinpay/shared";
import { getTransactions, RaisinApiError, type RaisinTransaction } from "@/lib/raisinpay-api";

const money = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency || ""} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`.trim();
  }
};

const dateLabel = (value: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
};

const displayName = (value: string) => value.split(/[\s@._-]/)[0] || "there";


export function OverviewPage() {
  const [transactions, setTransactions] = useState<RaisinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTransactions(await getTransactions());
    } catch (cause) {
      setTransactions([]);
      setError(cause instanceof RaisinApiError ? cause.message : "Something unexpected happened while loading transactions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => {
    const paid = transactions.filter((item) => /paid|complete|received/.test(`${item.paymentStatus} ${item.status}`.toLowerCase()));
    const outstanding = transactions.filter((item) => !/paid|complete|received|cancelled|void/.test(`${item.paymentStatus} ${item.status}`.toLowerCase()));
    const awaiting = transactions.filter((item) => /pending|await|review/.test(item.approvalStatus.toLowerCase()));
    const sum = (items: RaisinTransaction[]) => items.reduce((total, item) => total + (item.amount ?? 0), 0);
    const currency = transactions.find((item) => item.currency)?.currency || "USD";
    const homogeneous = transactions.every((item) => !item.currency || item.currency === currency);
    return { invoiced: sum(transactions), paid: sum(paid), outstanding: sum(outstanding), awaiting: awaiting.length, count: transactions.length, currency, homogeneous };
  }, [transactions]);

  const today = new Date();
  const dueSoon = transactions.filter((item) => {
    if (!item.dueDate || /paid|complete|received/.test(`${item.paymentStatus} ${item.status}`.toLowerCase())) return false;
    const due = new Date(item.dueDate);
    return !Number.isNaN(due.getTime()) && due >= today && due.getTime() - today.getTime() <= 14 * 24 * 60 * 60 * 1000;
  }).slice(0, 4);

  return (
    <RaisinPayLayout
      title="Overview"
      description="A clear view of your payment operations."
      action={<Button asChild className="rp-primary-button"><Link to="/payments/new"><FilePlus2 className="size-4" />New payment</Link></Button>}
    >
      {error && <ErrorState message={error} onRetry={() => void load()} />}

      <section className="rp-metrics-grid" aria-label="Payment metrics">
        <MetricCard label="Total invoiced" value={loading ? "—" : metrics.homogeneous ? money(metrics.invoiced, metrics.currency) : `${transactions.length} invoices`} note={loading ? "Fetching workspace data" : `${metrics.count} ${metrics.count === 1 ? "invoice" : "invoices"} recorded`} icon={<FilePlus2 className="size-4" />} tone="indigo" />
        <MetricCard label="Total paid" value={loading ? "—" : metrics.homogeneous ? money(metrics.paid, metrics.currency) : `${transactions.filter((item) => /paid|complete|received/.test(`${item.paymentStatus} ${item.status}`.toLowerCase())).length} paid`} note={loading ? "Fetching workspace data" : "Payments confirmed"} icon={<Wallet className="size-4" />} tone="green" />
        <MetricCard label="Outstanding" value={loading ? "—" : metrics.homogeneous ? money(metrics.outstanding, metrics.currency) : `${transactions.length - transactions.filter((item) => /paid|complete|received/.test(`${item.paymentStatus} ${item.status}`.toLowerCase())).length} open`} note={loading ? "Fetching workspace data" : "Awaiting payment"} icon={<Clock3 className="size-4" />} tone="amber" />
        <MetricCard label="Awaiting approval" value={loading ? "—" : String(metrics.awaiting)} note={loading ? "Fetching workspace data" : metrics.awaiting === 1 ? "Needs your review" : "Need your review"} icon={<ShieldCheck className="size-4" />} tone="slate" />
      </section>

      <section className="rp-dashboard-primary">
        <div className="rp-panel rp-activity-panel">
          <SectionLabel trailing={<Link to="/transactions" className="rp-text-link">All transactions<ArrowRight className="size-3.5" /></Link>}>Recent transactions</SectionLabel>
          {loading ? <LoadingLine label="Loading recent transactions" /> : transactions.length === 0 && !error ? <EmptyState icon={FilePlus2} title="Your transactions will appear here" description="Create your first payment to start organizing invoices, approvals, and payment status in one place." action={<Button asChild className="rp-primary-button"><Link to="/payments/new"><FilePlus2 className="size-4" />Create a payment</Link></Button>} /> : !error && <div className="rp-recent-table-wrap">
            <table className="rp-recent-table"><thead><tr><th>INVOICE</th><th>SUPPLIER</th><th>AMOUNT</th><th>STATUS</th><th>DUE DATE</th><th /></tr></thead><tbody>
              {transactions.slice(0, 5).map((item) => <tr key={item.id}><td><Link to="/transactions/$transactionId" params={{ transactionId: item.id }} className="rp-invoice-link">{item.invoiceNumber || "Invoice"}</Link></td><td><span className="rp-table-supplier">{item.supplierName || "Supplier not named"}</span></td><td className="rp-table-amount">{item.amount === null ? "—" : money(item.amount, item.currency || "USD")}</td><td><StatusPill value={item.paymentStatus || item.approvalStatus || item.status} /></td><td className="rp-table-date">{dateLabel(item.dueDate)}</td><td><Link to="/transactions/$transactionId" params={{ transactionId: item.id }} aria-label={`Open ${item.invoiceNumber || "transaction"}`} className="rp-row-arrow"><ArrowRight className="size-4" /></Link></td></tr>)}
            </tbody></table>
          </div>}
          {error && <div className="rp-panel-error-note">Recent activity isn’t available until the connection is restored.</div>}
        </div>

        <div className="rp-panel rp-distribution-panel">
          <SectionLabel trailing={<button type="button" className="rp-help-icon" aria-label="Status distribution reflects transactions returned by your workspace"><CircleHelp className="size-4" /></button>}>Payment status</SectionLabel>
          {loading ? <LoadingLine label="Loading payment status" /> : error ? <div className="rp-compact-note">Status distribution is unavailable while transaction data can’t be reached.</div> : transactions.length === 0 ? <EmptyChart label="No payments to summarize" /> : <div className="rp-status-distribution"><div className="rp-distribution-ring" style={{ "--paid-share": `${Math.round((transactions.filter((item) => /paid|complete|received/.test(`${item.paymentStatus} ${item.status}`.toLowerCase())).length / transactions.length) * 100)}%` } as React.CSSProperties}><div className="rp-ring-center"><strong>{transactions.length}</strong><span>invoices</span></div></div><div className="rp-legend-list"><div><span className="rp-legend-dot rp-legend-paid" />Paid<span>{transactions.filter((item) => /paid|complete|received/.test(`${item.paymentStatus} ${item.status}`.toLowerCase())).length}</span></div><div><span className="rp-legend-dot rp-legend-outstanding" />Open<span>{transactions.filter((item) => !/paid|complete|received|cancelled|void/.test(`${item.paymentStatus} ${item.status}`.toLowerCase())).length}</span></div><div><span className="rp-legend-dot rp-legend-other" />Other<span>{transactions.filter((item) => /cancelled|void|failed|reject/.test(`${item.paymentStatus} ${item.status}`.toLowerCase())).length}</span></div></div></div>}
          {!loading && !error && transactions.length > 0 && <div className="rp-distribution-footer"><span>Calculated from your transactions</span><ArrowUpRight className="size-3.5" /></div>}
        </div>
      </section>

      <section className="rp-dashboard-secondary">
        <div className="rp-panel rp-due-panel">
          <SectionLabel trailing={<span className="rp-section-hint">NEXT 14 DAYS</span>}>Upcoming due dates</SectionLabel>
          {loading ? <LoadingLine label="Checking upcoming due dates" /> : error ? <div className="rp-compact-note">Due dates will show here when transaction data is available.</div> : dueSoon.length === 0 ? <div className="rp-inline-empty"><span className="rp-inline-empty-icon"><Clock3 className="size-4" /></span><div><strong>Nothing due in the next two weeks</strong><p>Upcoming invoices will appear here.</p></div></div> : <div className="rp-due-list">{dueSoon.map((item) => <Link key={item.id} to="/transactions/$transactionId" params={{ transactionId: item.id }} className="rp-due-row"><span className="rp-due-calendar"><span>{new Date(item.dueDate).toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</span><strong>{new Date(item.dueDate).getDate()}</strong></span><span className="min-w-0 flex-1"><strong>{item.supplierName || "Supplier not named"}</strong><small>{item.invoiceNumber || "Invoice"}</small></span><span className="rp-due-amount">{item.amount === null ? "—" : money(item.amount, item.currency || "USD")}</span><ArrowRight className="size-3.5 text-muted-foreground" /></Link>)}</div>}
        </div>

        <div className="rp-insight-panel">
          <div className="rp-insight-topline"><span className="rp-insight-icon"><WandSparkles className="size-4" /></span><span>RAISIN AI</span><span className="rp-insight-spark" /></div>
          <h2>Insights that keep you one step ahead.</h2>
          <p>Ask about overdue invoices, approval needs, and your current payment exposure.</p>
          <Button asChild variant="outline" className="rp-insight-button"><Link to="/assistant">Talk to Raisin AI<ArrowRight className="size-4" /></Link></Button>
          <span className="rp-insight-footnote">Answers are based on your workspace data.</span>
        </div>
      </section>
    </RaisinPayLayout>
  );
}