# RaisinPay API contract

All JSON responses use `{ "data": ... }` on success and `{ "error": "...", "issues": [...] }` on failure.

AI uses the provider selected by `AI_PROVIDER`. For OpenRouter, configure `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, and `AI_MODEL` (for example `google/gemma-4-26b-a4b-it:free`). AI requests run only on the server. Invoice arithmetic and duplicate checks are deterministic application checks.

## Create a transaction

`POST /api/transactions`

```json
{
  "supplierName": "Acme Supplies",
  "supplierEmail": "billing@example.com",
  "invoiceNumber": "INV-1001",
  "description": "Office supplies",
  "amount": 1250,
  "currency": "USD",
  "issueDate": "2026-11-01",
  "dueDate": "2026-12-01",
  "paymentTerms": "Net 30",
  "tax": 100,
  "discount": 0,
  "lineItems": [
    { "description": "Paper", "quantity": 10, "unitPrice": 115, "total": 1150 }
  ]
}
```

Amounts are returned as strings to preserve decimal precision. A transaction starts in `DRAFT`.

## Review and approval

- `POST /api/transactions/:id/analyze` with optional `{ "invoiceText": "..." }`
- `PATCH /api/transactions/:id` with the complete transaction shape to edit details
- `POST /api/transactions/:id/approve` with `{ "approvedBy": "workspace-user" }`
- `POST /api/transactions/upload` as multipart form data with a `file` PDF to extract, analyse, and create a transaction
- `POST /api/transactions/:id/upload` as multipart form data with a `file` PDF to analyse an existing transaction

Analysis changes the internal status to `ANALYZED`. Approval changes it to `APPROVED`. Editing details invalidates prior approval.

## PayPal

- `POST /api/transactions/:id/paypal/send`
- `POST /api/transactions/:id/paypal/refresh`

The send route requires a current server-validated approval hash. It returns the actual PayPal invoice ID, URL when supplied, and PayPal status. Missing credentials return an explicit error.

## Read routes

- `GET /api/transactions`
- `GET /api/transactions/:id`
- `GET /api/transactions/:id/audit`
- `POST /api/ai/chat` with `{ "question": "Which invoices are overdue?" }`
- `POST /api/webhooks/paypal` for verified PayPal webhook events
