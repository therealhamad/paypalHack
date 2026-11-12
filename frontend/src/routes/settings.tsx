import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceSettingsPage } from "@/components/raisinpay/screens";

export const Route = createFileRoute("/settings")({
  component: WorkspaceSettingsPage,
  head: () => ({ meta: [
    { title: "Workspace settings · RaisinPay" },
    { name: "description", content: "Review RaisinPay workspace preferences and available payment operations settings." },
    { property: "og:title", content: "Workspace settings · RaisinPay" },
    { property: "og:description", content: "Review RaisinPay workspace preferences and available payment operations settings." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});