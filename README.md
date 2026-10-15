# ULTRON AI invoice agent

A hackathon-ready Next.js demo of a governed invoice workflow: ingest messy invoice text, extract and normalize entities, assess vendor and amount risk, pause at a human approval boundary, simulate payment only after approval, and retain an inspectable audit trail.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The demo is safe to run without credentials: the server uses deterministic mock extraction for the included trusted and risky sample invoices.

## Optional Gemini extraction

Create `.env.local` with:

```bash
GEMINI_API_KEY=your_key
# Optional; defaults to gemini-1.5-flash
GEMINI_MODEL=gemini-1.5-flash
```

When configured, `POST /api/process` asks Gemini for the extraction contract and still applies ULTRON's local trusted-vendor, amount, and purchase-order guardrails before any action is permitted. Uploads accept selectable-text PDFs, which are extracted by `POST /api/extract` before entering the same normalization flow. PDF extraction validates invoice/bill language, commercial fields, and an amount before loading the document; non-invoice PDFs return `Invoice or bill not found`. Scanned/image-only PDFs should be OCR'd first or pasted as text.

## Workflow boundaries

- Trusted vendors are `Acme Cloud Services`, `Orbit Office Supplies`, and `Vertex Logistics`.
- Business verification classifies processed invoices as **Real**, **Needs review**, or **Fake**. A Real invoice matches a trusted vendor record and has consistent identity/amount fields; an unknown vendor becomes Needs review and pauses at HITL; Fake or incomplete invoices are blocked with a visible reason. This is an operational business check, not cryptographic authenticity.
- The console mirrors the agent loop: ingest -> extract -> normalize -> plan -> tool calls -> guardrails/HITL -> execute -> audit. Real low-risk invoices auto-approve, while high-value, incomplete-policy, or Needs review invoices require approval.
- Payment is a simulated transaction and is only available through the approval action.
