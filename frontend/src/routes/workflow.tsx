import { createFileRoute } from "@tanstack/react-router";
import { WorkflowPage } from "@/components/raisinpay/workflow";

export const Route = createFileRoute("/workflow")({
  component: WorkflowPage,
  head: () => ({
    meta: [
      { title: "Lifecycle canvas · RaisinPay" },
      {
        name: "description",
        content:
          "Interactive visualisation of the full RaisinPay payment lifecycle, rendered from real workspace events.",
      },
      { property: "og:title", content: "Lifecycle canvas · RaisinPay" },
      {
        property: "og:description",
        content:
          "Interactive visualisation of the full RaisinPay payment lifecycle, rendered from real workspace events.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
