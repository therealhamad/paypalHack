# RaisinPay — Product Requirements & Agent Instructions

**Product:** RaisinPay  
**Category:** AI-powered B2B invoice and payment coordination  
**Hackathon:** PayPal AI Hackathon 2026  
**Primary integration:** PayPal Developer Platform  
**AI integration:** OpenAI or Gemini through a structured-output AI SDK  
**Frontend:** Next.js, TypeScript, Tailwind CSS  
**Database:** SQLite + Prisma  
**Dashboard:** AG Grid Community

---

# PART 1 — PRODUCT REQUIREMENTS DOCUMENT

## 1. Product vision

RaisinPay is an AI-powered B2B payment coordination platform that turns business payment requests and supplier invoices into verified, approval-driven PayPal transactions.

Businesses frequently manage invoices, payment terms, internal approvals, payment execution and reconciliation across disconnected systems.

RaisinPay brings these activities into one transaction lifecycle.

A business user can submit an invoice or describe a payment request in natural language. AI extracts and analyses the payment details, highlights inconsistencies, and prepares a structured payment workflow. After human approval, RaisinPay uses PayPal to create and send the invoice. The platform then tracks the actual payment status and maintains an audit trail.

**Core positioning:**

"From business agreement to verified payment, RaisinPay coordinates the entire payment lifecycle with AI and PayPal."

## 2. Target users

Primary:
- Small and medium-sized businesses.
- Procurement and finance teams.
- Companies managing supplier invoices.
- Businesses with recurring vendor payments.

Secondary:
- Freelancers and service providers.
- Small agencies managing client payments.
- Marketplace operators.

## 3. Core problem

A typical B2B payment involves:

1. Receiving a supplier invoice.
2. Understanding the payment terms.
3. Checking the supplier and invoice details.
4. Identifying discrepancies or duplicate invoices.
5. Obtaining internal approval.
6. Creating or sending the payment request.
7. Tracking payment completion.
8. Reconciling the transaction.

These activities often happen across email, spreadsheets, accounting software and payment platforms.

RaisinPay creates a unified workflow with AI-assisted verification and actual PayPal payment execution.

## 4. Core product workflow

### Stage 1: Payment request intake

Provide two ways to create a transaction:

**A. Manual entry**

Fields:
- Supplier/business name.
- Supplier email.
- Invoice number.
- Invoice description.
- Amount.
- Currency.
- Invoice date.
- Due date.
- Line items (optional).
- Payment terms (optional).

**B. Invoice upload**

Allow PDF invoice uploads.

The backend extracts available text and sends it to the AI model for structured extraction.

The extracted fields must be editable before proceeding.

All transaction details must be entered by the user or extracted from an uploaded document. No predefined transaction records should be required.

### Stage 2: AI invoice analysis

AI receives the extracted invoice details and produces structured JSON.

Expected output:

- Supplier name.
- Supplier email.
- Invoice number.
- Amount.
- Currency.
- Issue date.
- Due date.
- Payment terms.
- Line items.
- Missing information.
- Inconsistencies.
- Risk flags.
- Explanation of findings.
- Recommended next action.

The AI should check:

- Missing mandatory invoice information.
- Arithmetic inconsistencies between line items and totals.
- Duplicate invoice numbers within the available workspace.
- Unusual amounts compared with the workspace's available historical records.
- Inconsistent supplier details.
- Suspicious changes in payment-related information, when comparison evidence exists.

Important: AI findings are advisory. Do not represent them as verified fraud detection, legal verification or financial advice.

If historical data is unavailable, the AI must explicitly say so rather than inventing a comparison.

### Stage 3: Transaction review

Display a complete review screen containing:

- Extracted invoice information.
- Editable payment details.
- AI analysis.
- Missing information.
- Risk flags.
- Recommended action.

The user must be able to edit the extracted details.

Do not allow progression if mandatory payment details are invalid.

### Stage 4: Human approval

Before interacting with PayPal, require an explicit user approval action.

The approval must apply to the exact supplier, amount, currency and invoice details being submitted.

Record:
- Approval timestamp.
- Approved amount.
- Approved currency.
- Approved supplier.
- Invoice identifier.
- Approval status.

Any material change to approved payment details must invalidate the previous approval and require another one.

AI must never independently approve or execute a payment.

### Stage 5: PayPal invoice creation and sending

Use PayPal Sandbox.

Preferred integration:
- PayPal Invoicing API for creating and sending business invoices.
- PayPal Agent Toolkit where its available tools support the required operations.
- Server-side PayPal REST API calls as the reliable fallback.

The backend must:

1. Obtain an OAuth access token using server-side credentials.
2. Create a PayPal invoice using the approved runtime details.
3. Store the returned PayPal invoice ID.
4. Send the invoice using the supported PayPal API.
5. Store the actual response and timestamps.
6. Display the real PayPal invoice URL when available.

The recipient should be able to pay through PayPal's hosted invoice experience.

Do not simulate a successful payment.

Do not describe an invoice being sent as a payment being completed.

### Stage 6: Payment tracking

Retrieve the actual PayPal invoice/payment status.

Support appropriate states, such as:

- DRAFT
- PENDING_APPROVAL
- APPROVED
- SENDING
- SENT
- PARTIALLY_PAID
- PAID
- OVERDUE
- CANCELLED
- FAILED

Map these states to the actual statuses supported by PayPal. Do not invent a successful state based on a local action.

Use PayPal webhooks where feasible. At minimum, implement server-side status retrieval and a manual refresh action.

Webhook handling must verify authenticity using PayPal's supported verification process.

### Stage 7: Transaction audit trail

Every transaction must have a persistent event history.

Record:
- Transaction created.
- Invoice uploaded.
- AI analysis completed.
- Details edited.
- Approval granted.
- PayPal invoice created.
- PayPal invoice sent.
- Payment status updated.
- Webhook received.
- Errors and retry attempts.

Each event should contain:
- Event type.
- Timestamp.
- Relevant details.
- Source (user, AI, PayPal or system).

The audit trail must be based on actual events, not fabricated milestones.

## 5. Main application screens

### A. Overview dashboard

Show:
- Total invoiced amount.
- Total actually paid.
- Outstanding amount.
- Pending approvals.
- Overdue invoices.
- Recent transactions.

All metrics must be calculated from actual database records and, where appropriate, reconciled PayPal states.

Empty states must be attractive and informative.

### B. Transactions

AG Grid table with:

- Invoice number.
- Supplier.
- Amount.
- Currency.
- Created date.
- Due date.
- AI risk indicator.
- Approval status.
- PayPal status.
- Actions.

Features:
- Search.
- Filtering.
- Sorting.
- Status filtering.
- Transaction detail navigation.

### C. Create payment

Two options:
- Upload invoice.
- Enter payment details manually.

### D. Transaction details

Display:
- Invoice details.
- AI analysis.
- Approval history.
- PayPal invoice reference.
- Actual payment status.
- Event timeline.
- Retry/refresh actions where appropriate.

### E. AI assistant

An assistant that understands the actual workspace data.

Example questions:
- "Which invoices are overdue?"
- "Show me payments awaiting approval."
- "Why was this invoice flagged?"
- "How much is currently outstanding?"
- "Summarise the payment activity this week."

It must use actual database records and never fabricate transaction information.

## 6. AI architecture

Use an AI model with structured output and Zod validation.

AI responsibilities:
- Invoice extraction.
- Invoice consistency checks.
- Risk explanation.
- Payment workflow recommendations.
- Natural-language queries against authorised workspace data.

The AI must not:
- Approve payments.
- Create or send PayPal invoices without explicit approval.
- Claim payments succeeded without PayPal evidence.
- Modify PayPal transaction states directly.
- Invent supplier or invoice details.

Use separate server-side functions for AI analysis and PayPal execution.

## 7. PayPal integration architecture

Create a dedicated PayPal service module.

Suggested responsibilities:

- `getAccessToken()`
- `createInvoice()`
- `sendInvoice()`
- `getInvoice()`
- `cancelInvoice()` where supported
- `verifyWebhook()`

Inspect the actual PayPal API documentation and installed SDK before implementing. Do not assume method names or tool availability.

Use:
- PayPal Sandbox API base URL.
- Server-side OAuth.
- Idempotency where supported.
- Proper error handling.
- Request and response logging with secrets and sensitive data redacted.

Never expose the Client Secret in frontend code.

## 8. Database schema

Use Prisma with SQLite.

### Transaction

- id
- invoiceNumber
- supplierName
- supplierEmail
- description
- amount
- currency
- issueDate
- dueDate
- status
- approvalStatus
- aiRiskLevel
- aiAnalysis (JSON)
- paypalInvoiceId
- paypalInvoiceUrl
- paypalStatus
- createdAt
- updatedAt

### InvoiceLineItem

- id
- transactionId
- description
- quantity
- unitPrice
- total

### Approval

- id
- transactionId
- approvedBy
- approvedAt
- approvedAmount
- approvedCurrency
- approvedSupplier
- detailsHash

### AuditEvent

- id
- transactionId
- eventType
- source
- details (JSON)
- createdAt

### WebhookEvent

- id
- paypalEventId
- eventType
- processingStatus
- receivedAt
- processedAt

Avoid unnecessary database complexity. A single-user hackathon workspace is sufficient unless authentication is already available.

## 9. Non-functional requirements

- TypeScript throughout.
- Input validation using Zod.
- Server-side secrets only.
- Clear loading, success and failure states.
- Responsive UI.
- Persistent transactions.
- No hardcoded business records.
- No fake payment statuses.
- No fake AI analysis.
- No placeholder buttons.
- Useful logs for debugging.
- Proper error messages.
- No payment execution without human approval.

## 10. Out of scope

Do not build:
- Real institutional treasury infrastructure.
- Escrow or custodial functionality.
- Blockchain settlement.
- Multi-bank payment rails.
- Automatic payment execution without approval.
- Complex multi-tenant enterprise RBAC.
- Arbitrary conditional release of PayPal funds.
- Fake payment simulations presented as real transactions.

## 11. Definition of done

The project is considered functional when a judge can:

1. Open the application.
2. Enter a completely new supplier invoice.
3. Submit it for actual AI analysis.
4. Inspect and edit extracted details.
5. Approve the exact payment information.
6. Create and send a real PayPal Sandbox invoice.
7. Open the PayPal invoice page.
8. Complete payment using a Sandbox buyer account.
9. Return to RaisinPay.
10. See the actual updated payment status.
11. Inspect the transaction's audit history.

This end-to-end flow is the primary acceptance test.

---

# PART 2 — CODING AGENT PROMPT

## Role

You are the lead full-stack engineer responsible for building RaisinPay, an AI-powered B2B invoice and payment coordination platform.

Your priority is a working, demonstrable product, not an impressive-looking mockup.

You own:
- Application architecture.
- Backend implementation.
- Database.
- AI integration.
- PayPal integration.
- API endpoints.
- Validation.
- Business logic.
- Testing.
- Integration with the frontend.

## Instructions

Read the complete PRD above before coding.

Work directly in the repository.

Do not just produce an implementation plan. Build the application.

### 1. Inspect the environment

First inspect:
- Existing files.
- Installed dependencies.
- Package manager.
- Existing application structure.
- Available environment variables.
- Existing PayPal and AI integrations, if any.

Do not overwrite useful existing work.

If this is a fresh repository, establish the Next.js TypeScript App Router structure.

### 2. Establish the architecture

Keep the architecture straightforward.

Suggested structure:

```text
src/
  app/
    api/
      transactions/
      ai/
      paypal/
      webhooks/
    dashboard/
    transactions/
    create/
  components/
  lib/
    ai/
    paypal/
    database/
    validation/
    audit/
    services/
  types/
prisma/
```

Keep PayPal calls, AI logic and database operations separate.

Use server-side service modules.

### 3. Implement the database first

Create the Prisma schema described in the PRD.

Run migrations and confirm database persistence.

Do not create hardcoded transaction records or depend on seeded data.

### 4. Implement payment request intake

Build:
- Manual invoice entry.
- PDF upload.
- Text extraction.
- Structured invoice extraction through AI.
- Editable extraction results.

Validate all extracted fields.

The system must work with previously unseen invoices and user-entered business details.

If a PDF cannot be processed, show a useful error and retain the ability to enter the details manually.

### 5. Implement AI

Use the available AI API key.

Use structured output and Zod schemas.

AI must return:
- Extracted invoice information.
- Missing fields.
- Arithmetic discrepancies.
- Potential duplicate warnings based on actual database comparisons.
- Risk indicators.
- Explanation.
- Suggested next action.

Never fabricate historical data or claim that a supplier has been independently verified.

If AI is unavailable, show a clear error. Do not silently substitute a canned response.

### 6. Implement PayPal

Use PayPal Sandbox.

Before writing the integration:
- Read the official PayPal API documentation.
- Inspect the PayPal Agent Toolkit documentation and actual package exports.
- Confirm the exact API operations available.
- Select the simplest supported implementation.

Prioritise PayPal Invoicing API for this product.

Implement:
- OAuth access token retrieval.
- Invoice creation.
- Invoice sending.
- Invoice retrieval.
- Status reconciliation.
- Webhook verification if time permits.

If the Agent Toolkit supports the required operations, use it meaningfully. If it does not, implement the official REST API directly and document the choice.

Do not pretend a REST API integration is an Agent Toolkit integration.

Use the actual runtime amount, currency, supplier and invoice details.

Never hardcode PayPal order IDs, invoice IDs, API responses or successful transaction states.

### 7. Implement approval enforcement

Create a server-side approval record.

The approved supplier, amount, currency and invoice details must match the data submitted to PayPal.

If these details change after approval, invalidate the approval.

The frontend must never be trusted as the only enforcement layer.

Do not allow AI tools to approve or execute payments.

### 8. Implement reconciliation

The database is the application's operational record, but PayPal is authoritative for actual PayPal payment status.

Implement:
- Server-side invoice retrieval.
- Status synchronisation.
- Webhook event deduplication.
- Error handling.
- Retry-safe operations.

A locally created transaction must not be labelled PAID without verified PayPal evidence.

### 9. Implement API routes

Provide clean API routes for:
- Creating transactions.
- Uploading and analysing invoices.
- Editing invoice details.
- Approving transactions.
- Creating and sending PayPal invoices.
- Retrieving transaction details.
- Refreshing PayPal status.
- Retrieving audit events.
- Processing webhooks.
- Asking the AI assistant questions about workspace records.

Validate every request server-side.

### 10. Coordinate with the frontend agent

The Lovable agent is responsible for frontend design.

Provide:
- API route definitions.
- TypeScript types.
- Request and response examples.
- Error response structures.
- Expected loading and status states.

Do not create a separate backend that the frontend cannot use.

If the Lovable frontend is built separately, ensure it can connect to the actual backend using a configurable API base URL and appropriate CORS settings. Prefer keeping both in the same Next.js application.

### 11. Testing

At minimum, test:

- Creating a new invoice.
- Invalid invoice data.
- AI extraction.
- AI failure handling.
- Duplicate invoice detection.
- Editing extracted data.
- Approval invalidation after edits.
- PayPal OAuth.
- PayPal invoice creation.
- PayPal invoice sending.
- PayPal status retrieval.
- Duplicate webhook events.
- Payment status reconciliation.

Use PayPal Sandbox for integration testing.

If credentials are unavailable, clearly report the untested integration. Do not fake success.

### 12. Execution strategy

Work in this order:

1. Database and application structure.
2. Manual invoice intake.
3. AI invoice extraction and analysis.
4. Approval logic.
5. PayPal Sandbox integration.
6. Status reconciliation.
7. API integration with frontend.
8. Dashboard data integration.
9. Testing and production build.

After each milestone:
- Run TypeScript checks.
- Run relevant tests.
- Fix errors.
- Report completed functionality.
- Report remaining blockers.

### 13. Strict constraints

- No hardcoded transaction data.
- No hardcoded AI responses.
- No simulated successful PayPal transactions.
- No fake audit events.
- No client-side PayPal secrets.
- No autonomous payment approval.
- No arbitrary payment capture without explicit user authorisation.
- No unnecessary architecture.
- No excessive abstractions.
- No incomplete buttons or fake interactions.

**Final objective:** A judge must be able to create a new invoice, analyse it with AI, approve it, send it through PayPal Sandbox and see its actual payment status.

Prioritise this path over every secondary feature.

---

# PART 3 — LOVABLE AGENT PROMPT

## Role

You are a senior product designer and frontend engineer building RaisinPay, a premium AI-powered B2B payment coordination platform.

Design a beautiful, production-quality enterprise SaaS application.

The visual direction must be light mode, refined, modern, trustworthy and financial-operations focused.

This should look like a real fintech product used by finance teams, not a hackathon template.

You own the frontend experience and visual design. The backend coding agent owns the actual business logic, AI integration, database and PayPal integration.

Do not create a disconnected static prototype. Build functional frontend components that integrate with the real backend API.

## 1. Visual direction

Use a refined light-mode enterprise design.

Design references:
- Linear's information hierarchy.
- Stripe's clarity and financial interface design.
- Ramp's business finance dashboard.
- Mercury's clean banking experience.

Do not copy any reference directly.

### Colour palette

- Main background: warm off-white `#F8F9FB`.
- Surface: pure white `#FFFFFF`.
- Primary text: deep navy `#172033`.
- Secondary text: muted slate `#697586`.
- Primary accent: refined indigo `#4F46E5`.
- Success: restrained green `#16845B`.
- Warning: amber `#C58A26`.
- Error: muted red `#D9534F`.
- Borders: subtle cool grey `#E7EAF0`.

Avoid dark mode.

Avoid excessive gradients, neon colours, glassmorphism and unnecessary shadows.

### Typography

Use Inter or a similarly clean modern sans-serif.

Strong typographic hierarchy:
- Clear page titles.
- Compact section labels.
- Highly readable numerical values.
- Consistent font weights.

### Layout

- Desktop-first but fully responsive.
- Fixed left navigation sidebar.
- Main content area with generous spacing.
- Consistent card radii.
- Thin borders.
- Subtle hover states.
- Clean tables.
- Small, restrained icons.

## 2. Navigation

Create a left sidebar with:

**RaisinPay**
- Overview
- Transactions
- Approvals
- AI Assistant

Bottom section:
- Workspace settings
- Profile

Use a subtle selected navigation state.

The sidebar should collapse on smaller screens.

## 3. Overview dashboard

Create a polished finance operations overview.

Top section:
- "Good morning" greeting.
- Workspace name.
- Current date.
- Primary "New payment" action.

Metric cards:
- Total invoiced.
- Total paid.
- Outstanding.
- Awaiting approval.

Metrics must come from actual backend data.

Do not hardcode example amounts or pretend the dashboard has activity.

When the database is empty, show a beautiful empty state with an explanation and a prominent create-payment action.

Below the metrics:
- Recent transactions table.
- Payment status distribution.
- Upcoming due dates.
- AI insights panel.

Every element must use real API data.

## 4. Transactions page

Use AG Grid Community.

Columns:
- Invoice number.
- Supplier.
- Amount.
- Currency.
- Created date.
- Due date.
- AI risk.
- Approval status.
- Payment status.

Include:
- Search.
- Status filters.
- Sorting.
- Pagination.
- Row click navigation.
- Responsive table layout.

Use restrained status chips.

Avoid excessive colour.

## 5. Create payment workflow

This is one of the most important screens.

Create a polished two-option intake interface:

**Option A: Upload invoice**

- Drag-and-drop PDF upload.
- File type and size validation.
- Upload progress.
- Clear extraction status.

**Option B: Enter manually**

Form fields:
- Supplier name.
- Supplier email.
- Invoice number.
- Description.
- Amount.
- Currency.
- Issue date.
- Due date.
- Payment terms.
- Optional line items.

The form should have excellent spacing and validation.

After submission, show an AI processing state with meaningful stages:
- Reading invoice.
- Extracting payment details.
- Checking consistency.
- Preparing analysis.

These must reflect actual backend progress where available. Do not fake completion.

## 6. AI analysis interface

Create an elegant AI analysis panel.

Sections:
- Invoice extraction.
- Completeness.
- Arithmetic consistency.
- Duplicate checks.
- Risk indicators.
- Suggested next steps.

Use clear severity indicators.

For example:
- Information.
- Needs review.
- Warning.
- Critical.

Each finding must show an explanation and supporting evidence.

Do not present AI-generated assessments as verified fraud detection.

Show missing information prominently.

Allow users to edit extracted fields before approval.

## 7. Approval interface

Build a clear payment review screen.

Show:
- Supplier.
- Amount.
- Currency.
- Invoice reference.
- Due date.
- AI findings.
- Payment terms.

Include a clear approval button.

Before approval, display a confirmation modal summarising the exact payment details.

Make it obvious that approval authorises the next PayPal invoice operation.

No automatic approval.

## 8. PayPal integration interface

Once approved:

Show:
- PayPal invoice creation progress.
- Actual PayPal invoice reference.
- PayPal invoice URL.
- Invoice sent status.
- Payment status.

Provide an "Open PayPal invoice" action.

The action must use the actual URL returned by the backend.

Display errors clearly and provide retry options only when safe.

Do not create fake PayPal success states.

## 9. Transaction details page

This should be one of the strongest screens.

Create a transaction detail layout with:

Header:
- Invoice number.
- Supplier name.
- Amount.
- Status.
- Refresh status action.

Main content:
- Invoice information.
- AI analysis.
- Approval record.
- PayPal invoice details.
- Payment information.

Right or lower panel:
- Vertical transaction lifecycle timeline.

Timeline events:
- Request created.
- AI analysis completed.
- Details reviewed.
- Approval granted.
- PayPal invoice created.
- Invoice sent.
- Payment received.

Only render events that actually exist in the backend.

Pending stages should be visibly distinct from completed ones.

## 10. AI assistant

Create a contextual AI assistant accessible from the navigation.

Use a clean conversational interface.

Example queries:
- "Which invoices are overdue?"
- "How much do we currently have outstanding?"
- "Explain the risk flags on this invoice."
- "Which transactions need approval?"

The assistant must call the real backend and use actual workspace data.

Do not pre-populate canned conversations or hardcoded answers.

## 11. Micro-interactions

Implement:
- Smooth page transitions.
- Subtle card hover states.
- Clear button loading states.
- Toast notifications.
- Skeleton loaders.
- Inline form validation.
- Empty states.
- Confirmation modals.
- Error recovery.

Keep animations subtle and professional.

## 12. Component quality

Create reusable components:
- Sidebar.
- Header.
- Metric card.
- Status badge.
- Transaction table.
- Invoice upload.
- Invoice form.
- AI analysis panel.
- Approval summary.
- Timeline.
- Confirmation modal.
- Empty state.
- Loading state.

Maintain consistent spacing, typography and colours.

## 13. Backend integration contract

The frontend must connect to the actual backend.

Expected endpoints:

- `GET /api/transactions`
- `POST /api/transactions`
- `GET /api/transactions/:id`
- `PATCH /api/transactions/:id`
- `POST /api/transactions/:id/analyze`
- `POST /api/transactions/:id/approve`
- `POST /api/transactions/:id/paypal/send`
- `POST /api/transactions/:id/paypal/refresh`
- `GET /api/transactions/:id/audit`
- `POST /api/ai/chat`

Coordinate exact request and response formats with the coding agent.

Use real API responses.

Never introduce hardcoded transaction records just to make the dashboard look populated.

If the backend is unavailable, show a clear connection error rather than fake data.

## 14. Final quality requirements

The finished product should feel like a premium enterprise fintech application.

Prioritise:
1. A beautiful dashboard.
2. A clear transaction creation workflow.
3. An excellent AI analysis experience.
4. A trustworthy payment approval experience.
5. An informative transaction lifecycle.
6. A clean and usable transaction table.

The application must work on desktop and mobile.

**Do not sacrifice functionality for appearance. Every visible action should perform a real operation or be clearly disabled until its backend capability is available.**

