import { createFileRoute } from "@tanstack/react-router";
import { TransactionDetailPage } from "@/components/raisinpay/screens";

export const Route = createFileRoute("/transactions/$transactionId")({
  component: TransactionDetailRoute,
  head: ({ params }) => ({ meta: [
    { title: "Transaction details · RaisinPay" },
    { name: "description", content: `Review invoice, approval, AI analysis, and recorded payment details for transaction ${params.transactionId}.` },
    { property: "og:title", content: "Transaction details · RaisinPay" },
    { property: "og:description", content: "Review invoice, approval, AI analysis, and recorded payment details in RaisinPay." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});

function TransactionDetailRoute() {
  const { transactionId } = Route.useParams();
  return <TransactionDetailPage transactionId={transactionId} />;
}