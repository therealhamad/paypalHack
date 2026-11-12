import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/components/raisinpay/overview";

export const Route = createFileRoute("/")({
  component: OverviewPage,
  head: () => ({
    meta: [
      { title: "Overview · RaisinPay" },
      { name: "description", content: "A clear view of RaisinPay invoice, approval, and payment operations." },
      { property: "og:title", content: "Overview · RaisinPay" },
      { property: "og:description", content: "A clear view of RaisinPay invoice, approval, and payment operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
