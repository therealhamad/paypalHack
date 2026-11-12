import { createFileRoute } from "@tanstack/react-router";
import { NewPaymentPage } from "@/components/raisinpay/screens";

export const Route = createFileRoute("/payments/new")({
  component: NewPaymentPage,
  head: () => ({ meta: [
    { title: "New payment · RaisinPay" },
    { name: "description", content: "Create and review an invoice payment request in your RaisinPay workspace." },
    { property: "og:title", content: "New payment · RaisinPay" },
    { property: "og:description", content: "Create and review an invoice payment request in your RaisinPay workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});