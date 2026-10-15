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

When configured, `POST /api/process` asks Gemini for the extraction contract and still applies ULTRON's local trusted-vendor, amount, and purchase-order guardrails before any action is permitted.

## Workflow boundaries

- Trusted vendors are `Acme Cloud Services`, `Orbit Office Supplies`, and `Vertex Logistics`.
- Any untrusted vendor, invoice over `$10,000`, or missing purchase order requires approval.
- Payment is a simulated transaction and is only available through the approval action.
