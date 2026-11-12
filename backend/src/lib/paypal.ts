type PayPalResponse = Record<string, unknown>;

export function invoiceHref(invoice: PayPalResponse): string | null {
  if (typeof invoice.href === "string" && invoice.href) return invoice.href;
  const links = Array.isArray(invoice.links) ? invoice.links : [];
  for (const link of links) {
    if (link && typeof link === "object" && link.rel === "self" && typeof link.href === "string") return link.href;
  }
  for (const link of links) {
    if (link && typeof link === "object" && typeof link.href === "string") return link.href;
  }
  return null;
}

const baseUrl =
  process.env.PAYPAL_ENVIRONMENT === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

function credentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PayPal integration is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.");
  }
  return { clientId, clientSecret };
}

async function paypalRequest(path: string, init: RequestInit, token?: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const body = (await response.json().catch(() => ({}))) as PayPalResponse;
  if (!response.ok) {
    throw new Error(`PayPal request failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

export function payerInvoiceUrl(invoiceId: string) {
  const host = process.env.PAYPAL_ENVIRONMENT === "production" ? "https://www.paypal.com" : "https://www.sandbox.paypal.com";
  return `${host}/invoice/payer/#/details/${encodeURIComponent(invoiceId)}`;
}

export async function getAccessToken() {
  const { clientId, clientSecret } = credentials();
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Basic ${encoded}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const body = (await response.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!response.ok || !body.access_token) throw new Error(`PayPal OAuth failed: ${body.error_description ?? "No access token returned"}`);
  return body.access_token;
}

export async function createInvoice(token: string, input: { invoiceNumber: string; description: string; supplierEmail: string; amount: string; currency: string; dueDate: Date; lineItems: Array<{ description: string; quantity: string; unitPrice: string }> }) {
  const items = input.lineItems.length > 0
    ? input.lineItems
    : [{ description: input.description, quantity: "1", unitPrice: input.amount }];
  return paypalRequest("/v2/invoicing/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      detail: { invoice_number: input.invoiceNumber, reference: input.invoiceNumber, invoice_date: new Date().toISOString().slice(0, 10), currency_code: input.currency, note: input.description, payment_term: { term_type: "DUE_ON_DATE_SPECIFIED", due_date: input.dueDate.toISOString().slice(0, 10) } },
      primary_recipients: [{ billing_info: { email_address: input.supplierEmail } }],
      items: items.map((item) => ({ name: item.description, quantity: item.quantity, unit_amount: { currency_code: input.currency, value: item.unitPrice } })),
      configuration: { tax_calculated_after_discount: false, tax_inclusive: false },
    }),
  }, token);
}

export async function sendInvoice(token: string, invoiceId: string) {
  return paypalRequest(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ send_to_recipient: true, additional_recipients: [] }) }, token);
}

export async function getInvoice(token: string, invoiceId: string) {
  return paypalRequest(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`, { method: "GET" }, token);
}

export async function verifyWebhook(token: string, headers: Record<string, string>, webhookEvent: PayPalResponse) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PAYPAL_WEBHOOK_ID is not configured.");
  return paypalRequest("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth_algo: headers["paypal-auth-algo"], cert_url: headers["paypal-cert-url"], transmission_id: headers["paypal-transmission-id"], transmission_sig: headers["paypal-transmission-sig"], transmission_time: headers["paypal-transmission-time"], webhook_id: webhookId, webhook_event: webhookEvent }),
  }, token);
}
