import { createFileRoute } from "@tanstack/react-router";
import { AssistantPage } from "@/components/raisinpay/screens";

export const Route = createFileRoute("/assistant")({
  component: AssistantPage,
  head: () => ({ meta: [
    { title: "AI assistant · RaisinPay" },
    { name: "description", content: "Ask questions about actual invoice and payment information in your RaisinPay workspace." },
    { property: "og:title", content: "AI assistant · RaisinPay" },
    { property: "og:description", content: "Ask questions about actual invoice and payment information in your RaisinPay workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});