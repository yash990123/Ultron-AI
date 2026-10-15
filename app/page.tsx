"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";

type RiskLevel = "low" | "high";
type Status = "idle" | "processing" | "awaiting_approval" | "paid" | "rejected" | "error";

type Invoice = {
  invoiceNumber: string;
  vendor: string;
  amount: number;
  currency: string;
  dueDate: string;
  purchaseOrder: string | null;
  lineItems: { description: string; quantity: number; unitPrice: number }[];
  trustedVendor: boolean;
  riskLevel: RiskLevel;
  riskReasons: string[];
  confidence: number;
};

type AuditEvent = {
  id: string;
  label: string;
  detail: string;
  time: string;
  tone: "done" | "active" | "warn";
};

const EASY_INVOICE = `INVOICE
Vendor: Acme Cloud Services
Invoice #: ACS-2024-1048
Invoice date: October 08, 2024
Due date: November 07, 2024
Purchase Order: PO-8842
Cloud infrastructure monitoring and support — 1 × $4,800.00
Total due: USD $4,800.00`;

const RISKY_INVOICE = `INVOICE
Vendor: Umbra Data Systems
Invoice #: UDS-7781
Invoice date: October 12, 2024
Due date: October 19, 2024
Emergency data migration and recovery services — 1 × $18,450.00
Total due: USD $18,450.00
Payment terms: wire transfer`;

const initialAudit: AuditEvent[] = [
  { id: "start", label: "Workflow ready", detail: "Waiting for an invoice signal", time: "now", tone: "done" }
];

function money(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

function timeNow() {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date());
}

function Icon({ name }: { name: "arrow" | "check" | "clock" | "shield" | "spark" | "upload" | "x" | "y" }) {
  const paths = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    y: <><path d="M5 5 12 12 19 5" /><path d="M12 12v8" /><path d="M8 20h8" /></>,
    shield: <><path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    spark: <><path d="m12 3-1.3 5.7L5 10l5.7 1.3L12 17l1.3-5.7L19 10l-5.7-1.3L12 3Z" /><path d="m19 17-.6 2.4L16 20l2.4.6L19 23l.6-2.4L22 20l-2.4-.6L19 17Z" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
    x: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function Home() {
  const [invoiceText, setInvoiceText] = useState(EASY_INVOICE);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<AuditEvent[]>(initialAudit);
  const [activeTab, setActiveTab] = useState<"input" | "normalized">("input");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const statusCopy = useMemo(() => ({
    idle: { label: "Ready to process", detail: "Paste a signal or choose a demo invoice", className: "neutral" },
    processing: { label: "Agent is working", detail: "Extracting fields and applying policy", className: "blue" },
    awaiting_approval: { label: "Approval required", detail: "Impact boundary is holding the payment", className: "amber" },
    paid: { label: "Payment simulated", detail: "Result recorded in the audit trail", className: "green" },
    rejected: { label: "Workflow rejected", detail: "The proposed action was not executed", className: "red" },
    error: { label: "Workflow error", detail: "Review the audit trail for the blocked step", className: "red" }
  }[status]), [status]);
  const agentState = useMemo(() => {
    if (status === "processing") return { label: "Reasoning", detail: "Extracting entities and evaluating guardrails", tone: "active" };
    if (status === "awaiting_approval") return { label: "Handoff ready", detail: "Decision packet prepared for the operator", tone: "attention" };
    if (status === "paid") return { label: "Task complete", detail: "Action verified and written to the ledger", tone: "complete" };
    if (status === "error") return { label: "Needs attention", detail: "The agent stopped before execution", tone: "attention" };
    return { label: "Listening", detail: "Ready for an invoice signal", tone: "idle" };
  }, [status]);

  function addAudit(label: string, detail: string, tone: AuditEvent["tone"] = "done") {
    setAudit((events) => [...events, { id: `${Date.now()}-${label}`, label, detail, time: timeNow(), tone }]);
  }

  async function executePayment(invoiceToPay: Invoice, humanApproval: boolean) {
    setStatus("processing");
    if (humanApproval) addAudit("Human approval received", "Operator authorized the proposed payment", "active");
    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", invoice: invoiceToPay, approved: true })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Payment simulation failed.");
      setStatus("paid");
      addAudit("Payment executed", `Simulated ${money(invoiceToPay.amount, invoiceToPay.currency)} transfer to ${invoiceToPay.vendor}`);
      addAudit("Result verified", `Transaction ${data.transactionId} recorded in the audit ledger`);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Payment simulation failed.");
      addAudit("Payment blocked", "The execution boundary returned an error", "warn");
    }
  }

  async function processInvoice() {
    setError("");
    setStatus("processing");
    setInvoice(null);
    setAudit([{ id: "ingest", label: "Invoice ingested", detail: "Signal received from operator input", time: timeNow(), tone: "done" }]);
    setActiveTab("input");
    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: invoiceText })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The agent could not process this invoice.");
      setInvoice(data.invoice);
      addAudit("Fields extracted", `${data.invoice.vendor} · ${money(data.invoice.amount, data.invoice.currency)}`);
      addAudit("Policy assessed", data.invoice.riskLevel === "low" ? "Trusted vendor and low-value threshold passed" : `${data.invoice.riskReasons.length} risk signal${data.invoice.riskReasons.length === 1 ? "" : "s"} found`, data.invoice.riskLevel === "low" ? "done" : "warn");
      if (data.invoice.riskLevel === "low") {
        setStatus("awaiting_approval");
        addAudit("Auto-approval granted", "Trusted vendor and policy threshold passed", "active");
        await executePayment(data.invoice, false);
      } else {
        setStatus("awaiting_approval");
        addAudit("Approval boundary", "High-impact payment paused before execution", "warn");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      const rejected = message.startsWith("Invoice rejected:");
      setStatus(rejected ? "rejected" : "error");
      setError(message);
      addAudit(rejected ? "Invoice rejected" : "Workflow stopped", rejected ? message : "Unable to produce a normalized invoice", "warn");
    }
  }

  async function approvePayment() {
    if (!invoice) return;
    await executePayment(invoice, true);
  }

  function loadSample(sample: "easy" | "risky") {
    setInvoiceText(sample === "easy" ? EASY_INVOICE : RISKY_INVOICE);
    setUploadedFile(null);
    setInvoice(null);
    setStatus("idle");
    setError("");
    setAudit(initialAudit);
    setActiveTab("input");
  }

  async function ingestFile(file: File) {
    setError("");
    setUploadedFile({ name: file.name, size: file.size });
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const supported = isPdf || file.type === "text/plain" || file.type === "text/csv" || file.type === "application/json" || /\.(txt|csv|json)$/i.test(file.name);
    if (!supported) {
      setError("Upload a .pdf, .txt, .csv, or .json invoice.");
      return;
    }
    try {
      let text = "";
      if (isPdf) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/extract", { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "The PDF could not be extracted.");
        text = data.text;
      } else {
        text = await file.text();
      }
      if (!text.trim()) throw new Error("That file is empty.");
      setInvoiceText(text);
      setUploadedFile({ name: file.name, size: file.size });
      setInvoice(null);
      setStatus("idle");
      setAudit(initialAudit);
      setActiveTab("input");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The invoice file could not be read.");
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void ingestFile(file);
    event.target.value = "";
  }

  function clearUpload() {
    setUploadedFile(null);
    setError("");
  }

  const canApprove = status === "awaiting_approval" && invoice;

  return (
    <main className="shell">
      <nav className="topbar">
        <div className="brand"><span className="brand-mark"><Icon name="y" /></span><span>ULTRON<span className="brand-ai">/AI</span></span></div>
        <div className="nav-context"><span className="pulse" /> Invoice operations <span className="slash">/</span> Demo workspace</div>
        <div className="nav-right"><span className="live-dot" /> Systems nominal <span className="avatar">OP</span></div>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span>●</span> AUTONOMOUS WORKFLOW ENGINE</div>
        <h1>From messy invoice<br /><em>to verified action.</em></h1>
        <p className="hero-copy">ULTRON extracts the signal, checks the policy, and moves work forward — pausing only when an operator should decide.</p>
        <div className="hero-stats"><span><strong>01</strong> Ingest</span><span><strong>02</strong> Normalize</span><span><strong>03</strong> Govern</span><span><strong>04</strong> Execute</span></div>
        <div className="hero-orbit" aria-hidden="true"><span className="orbit-core">Y</span><span className="orbit-ring ring-one" /><span className="orbit-ring ring-two" /><span className="orbit-signal signal-one" /><span className="orbit-signal signal-two" /></div>
      </section>

      <section className="workspace">
        <div className="workspace-header"><div><span className="section-kicker">LIVE WORKFLOW <span className="section-code">/ 00A7</span></span><h2>Invoice command center</h2><p className="workspace-subtitle">{statusCopy.detail}</p></div><div className="status-wrap"><span className={`status-pill ${statusCopy.className}`}><span className="status-dot" />{statusCopy.label}</span><span className="workspace-meta">MOCK CONNECTORS · SAFE MODE</span></div></div>
        <div className="workflow-rail">
          {["Ingest", "Extract", "Assess", "Approve", "Execute"].map((step, index) => {
            const done = (index === 0 && status !== "idle") || (index === 1 && invoice) || (index === 2 && invoice) || (index === 3 && status === "paid") || (index === 4 && status === "paid");
            const active = (index === 0 && status === "idle") || (index === 1 && status === "processing") || (index === 2 && invoice && status !== "paid") || (index === 3 && status === "awaiting_approval") || (index === 4 && status === "paid");
            return <div className={`rail-step ${done ? "done" : ""} ${active ? "active" : ""}`} key={step}><span className="rail-number">{done ? <Icon name="check" /> : `0${index + 1}`}</span><span>{step}</span>{index < 4 && <span className="rail-line" />}</div>;
          })}
        </div>
        <div className="operator-strip" aria-label="Operator console metrics">
          <div className="operator-metric"><span className="metric-icon cyan"><Icon name="spark" /></span><div><span>AGENT MODE</span><strong>Governed autonomy</strong></div><i className="metric-live">LIVE</i></div>
          <div className="operator-metric"><span className="metric-icon violet"><Icon name="shield" /></span><div><span>POLICY ENGINE</span><strong>3 guardrails active</strong></div><i>LOCKED</i></div>
          <div className="operator-metric"><span className="metric-icon green"><Icon name="check" /></span><div><span>CONNECTORS</span><strong>Mock / Gemini ready</strong></div><i>ONLINE</i></div>
          <div className="operator-metric"><span className="metric-icon amber"><Icon name="clock" /></span><div><span>HUMAN GATE</span><strong>Impact-aware pause</strong></div><i>ARMED</i></div>
        </div>
        <div className={`agent-command-bar ${agentState.tone}`} aria-live="polite">
          <div className="agent-orb"><span /><span /><span /></div>
          <div className="agent-command-copy"><span className="section-kicker">ULTRON AGENT · LIVE LOOP</span><strong>{agentState.label}</strong><span>{agentState.detail}</span></div>
          <div className="agent-command-steps"><span className="agent-step-complete">observe</span><span className="agent-step-line" /><span className={status !== "idle" ? "agent-step-complete" : ""}>reason</span><span className="agent-step-line" /><span className={invoice ? "agent-step-complete" : ""}>act</span></div>
          <span className="agent-presence"><i /> autonomous core</span>
        </div>

        <div className="console-caption"><span>OPERATIONS DECK</span><span>SESSION / INVOICE-LOCAL-01</span><span className="caption-line" /></div>
        <div className="grid">
          <section className="card input-card">
            <div className="card-head"><div><span className="section-kicker">01 · INGEST</span><h3>Bring in an invoice</h3></div><span className="input-badge"><Icon name="upload" /> text signal</span></div>
            <div className="sample-row"><span>Start with a signal</span><div className="sample-controls"><button className={`sample-button ${invoiceText === EASY_INVOICE ? "selected" : ""}`} onClick={() => loadSample("easy")} aria-pressed={invoiceText === EASY_INVOICE}><span className="sample-indicator safe" />Trusted vendor <span className="sample-arrow">↗</span></button><button className={`sample-button risky-sample ${invoiceText === RISKY_INVOICE ? "selected" : ""}`} onClick={() => loadSample("risky")} aria-pressed={invoiceText === RISKY_INVOICE}><span className="sample-indicator risky" />Risky vendor <span className="sample-arrow">↗</span></button></div></div>
            <input ref={fileInputRef} className="visually-hidden" type="file" accept=".pdf,.txt,.csv,.json,application/pdf,text/plain,text/csv,application/json" onChange={handleFileChange} />
            <div className={`upload-zone ${isDragging ? "dragging" : ""} ${uploadedFile ? "has-file" : ""}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); const file = event.dataTransfer.files[0]; if (file) void ingestFile(file); }} role="region" aria-label="Invoice file upload">
              <div className="upload-zone-icon"><Icon name="upload" /></div>
              <div className="upload-zone-copy">{uploadedFile ? <><strong>{uploadedFile.name}</strong><span>{Math.max(1, Math.round(uploadedFile.size / 1024))} KB · text extracted into the signal editor</span></> : <><strong>Drop an invoice file here</strong><span>PDF, TXT, CSV, or JSON · text is extracted automatically</span></>}</div>
              <button className="browse-button" type="button" onClick={() => fileInputRef.current?.click()}>{uploadedFile ? "Replace file" : "Browse files"}</button>
              {uploadedFile && <button className="clear-file" type="button" onClick={clearUpload} aria-label="Remove uploaded file"><Icon name="x" /></button>}
            </div>
            <textarea id="invoice-input" aria-label="Invoice input" aria-describedby="invoice-help" value={invoiceText} onChange={(event) => setInvoiceText(event.target.value)} placeholder="Paste an invoice, email, or extracted document text..." />
            <div className="input-foot"><span id="invoice-help" className="char-count">{invoiceText.length} characters · plaintext signal</span><button className="primary-button" onClick={processInvoice} disabled={!invoiceText.trim() || status === "processing"}>{status === "processing" ? "Processing..." : "Process invoice"} <Icon name="arrow" /></button></div>
            {error && <div className="error-banner"><Icon name="x" />{error}</div>}
          </section>

          <section className="card result-card">
            <div className="card-head"><div><span className="section-kicker">02 · NORMALIZE</span><h3>Execution contract</h3></div>{invoice && <span className="confidence"><span className="confidence-ring">{invoice.confidence}%</span> confidence</span>}</div>
            <div className="tabs"><button className={activeTab === "input" ? "selected" : ""} onClick={() => setActiveTab("input")}>Overview</button><button className={activeTab === "normalized" ? "selected" : ""} onClick={() => setActiveTab("normalized")} disabled={!invoice}>Normalized JSON</button></div>
            {!invoice ? <div className="empty-state"><div className="empty-icon"><Icon name="spark" /></div><strong>Your contract appears here</strong><span>Process an invoice to see extracted entities, policy checks, and the next safe action.</span><span className="empty-hint">Try the trusted sample for an instant pass.</span></div> : activeTab === "normalized" ? <pre className="json-view">{JSON.stringify(invoice, null, 2)}</pre> : <div className="details">
              <div className="vendor-row"><div className="vendor-logo">{invoice.vendor.slice(0, 1)}</div><div><span className="muted-label">VENDOR</span><strong>{invoice.vendor}</strong><span className="sub-value">{invoice.invoiceNumber}</span></div><span className={`trust-tag ${invoice.trustedVendor ? "trusted" : "unverified"}`}>{invoice.trustedVendor ? "Trusted" : "Unverified"}</span></div>
              <div className="metric-grid"><div><span className="muted-label">TOTAL DUE</span><strong className="amount">{money(invoice.amount, invoice.currency)}</strong></div><div><span className="muted-label">DUE DATE</span><strong>{invoice.dueDate || "Not specified"}</strong></div><div><span className="muted-label">PURCHASE ORDER</span><strong>{invoice.purchaseOrder || "Not found"}</strong></div></div>
              <div className="policy-box"><div className={`policy-icon ${invoice.riskLevel}`}><Icon name={invoice.riskLevel === "low" ? "shield" : "clock"} /></div><div><strong>{invoice.riskLevel === "low" ? "Policy checks passed" : "Human review required"}</strong><span>{invoice.riskLevel === "low" ? "Trusted vendor · amount within auto-approve threshold" : invoice.riskReasons.join(" · ")}</span></div></div>
            </div>}
          </section>
        </div>

        <div className="lower-grid">
          <section className="card approval-card"><div className="card-head"><div><span className="section-kicker">03 · CONTROL</span><h3>Approval boundary</h3></div><span className="boundary-badge"><Icon name="shield" /> impact gate</span></div>{!invoice ? <div className="approval-empty">The agent will pause here when policy requires a human decision.</div> : <div className={`approval-body ${status === "paid" ? "complete" : ""} ${invoice.riskLevel === "high" ? "high-risk" : "safe-risk"}`}><div className="approval-message"><div className="approval-symbol">{status === "paid" ? <Icon name="check" /> : invoice.riskLevel === "low" ? <Icon name="shield" /> : <Icon name="clock" />}</div><div><strong>{status === "paid" ? "Approved and executed" : status === "processing" && invoice.riskLevel === "low" ? "Auto-approval in progress" : invoice.riskLevel === "low" ? "Safe to auto-approve" : "This payment needs your approval"}</strong><span>{status === "paid" ? "The simulated transfer completed successfully." : invoice.riskLevel === "low" ? "Trusted vendor and amount threshold passed. No manual action is needed." : "No external system is changed until you confirm the action below."}</span></div></div>{status !== "paid" && invoice.riskLevel === "high" && <button className="approve-button" onClick={approvePayment} disabled={!canApprove}>Approve & simulate payment <Icon name="arrow" /></button>}</div>}</section>
          <section className="card audit-card"><div className="card-head"><div><span className="section-kicker">04 · EVIDENCE</span><h3>Audit trail</h3></div><span className="audit-count">{audit.length} events</span></div><div className="timeline">{audit.map((event) => <div className="timeline-item" key={event.id}><span className={`timeline-dot ${event.tone}`} /> <div><strong>{event.label}</strong><span>{event.detail}</span></div><time>{event.time}</time></div>)}</div></section>
        </div>
      </section>

      <footer><a className="footer-brand-link" href="/about"><span><span className="footer-mark"><Icon name="y" /></span> ULTRON AI</span></a><span>Governed autonomy for the work between systems</span><span className="footer-right"><Icon name="shield" /> Human-in-the-loop by design</span><a className="about-link" href="/about">About ULTRON ↗</a></footer>
    </main>
  );
}
