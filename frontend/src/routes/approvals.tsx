import { createFileRoute } from "@tanstack/react-router";
import { ApprovalsPage } from "@/components/raisinpay/screens";

export const Route = createFileRoute("/approvals")({
  component: ApprovalsPage,
  head: () => ({ meta: [
    { title: "Approvals · RaisinPay" },
    { name: "description", content: "Review payment details and approve requests before invoice creation in RaisinPay." },
    { property: "og:title", content: "Approvals · RaisinPay" },
    { property: "og:description", content: "Review payment details and approve requests before invoice creation in RaisinPay." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});