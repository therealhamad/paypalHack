import { createFileRoute } from "@tanstack/react-router";
import { TransactionsPage } from "@/components/raisinpay/screens";

export const Route = createFileRoute("/transactions")({
  component: TransactionsPage,
  head: () => ({ meta: [
    { title: "Transactions · RaisinPay" },
    { name: "description", content: "Search, sort, and review invoice and payment transactions in RaisinPay." },
    { property: "og:title", content: "Transactions · RaisinPay" },
    { property: "og:description", content: "Search, sort, and review invoice and payment transactions in RaisinPay." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});