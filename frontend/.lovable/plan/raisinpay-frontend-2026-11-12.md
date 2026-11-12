# RaisinPay frontend

## Build
- Replace the placeholder home screen with a light-only finance workspace: responsive navigation, workspace header, overview metrics, recent activity, and an honest empty/error state.
- Add dedicated transactions, approvals, payment intake, AI assistant, and transaction-detail screens following the attached product specification.
- Connect user-visible data and actions to the documented `/api` endpoints. Derive dashboard metrics only from returned transactions; never display fabricated amounts, records, analysis, approval, or PayPal success.
- Build reusable payment/status/analysis/timeline UI, accessible loading and error recovery, and a confirmation step before approval. Show PayPal actions only with returned invoice details.
- Include app-specific title, description, and social metadata on each content screen; preserve the existing TanStack shell and light-only design tokens.

## Technical details
- Keep API calls in browser-side frontend utilities because this request assigns business logic and backend ownership elsewhere; do not invent server endpoints or database schema.
- Use AG Grid Community for the transactions listing as specified, and use the endpoint contract names from the brief with defensive handling for unavailable or unexpected responses.
- The backend's exact request/response schemas are not provided, so keep the UI explicit about unavailable capabilities and avoid claiming end-to-end backend validation.
