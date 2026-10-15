import { NextResponse } from "next/server";

type Invoice = {
  invoiceNumber: string;
  vendor: string;
  amount: number;
  currency: string;
  dueDate: string;
  purchaseOrder: string | null;
  lineItems: { description: string; quantity: number; unitPrice: number }[];
  trustedVendor: boolean;
  riskLevel: "low" | "high";
  riskReasons: string[];
  confidence: number;
};

const trustedVendors = ["acme cloud services", "orbit office supplies", "vertex logistics"];
const invoiceRejectedMessage = "Invoice rejected: the invoice is fake, incomplete, or from an unverified vendor.";

function isValidatedInvoice(invoice: Invoice) {
  return invoice.vendor !== "Unknown vendor"
    && invoice.invoiceNumber !== "Not specified"
    && invoice.amount > 0
    && invoice.trustedVendor;
}

function parseMoney(text: string) {
  const match = text.match(/(?:total due|amount due|total)[^$0-9]*\$?\s*([\d,]+(?:\.\d{2})?)/i) || text.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

function parseInvoice(text: string): Invoice {
  const vendor = text.match(/vendor\s*:\s*(.+)/i)?.[1]?.trim() || "Unknown vendor";
  const invoiceNumber = text.match(/invoice\s*#?\s*:\s*([^\s]+)/i)?.[1]?.trim() || "Not specified";
  const dueDate = text.match(/due date\s*:\s*(.+)/i)?.[1]?.trim() || "";
  const purchaseOrder = text.match(/purchase order\s*:\s*([^\s]+)/i)?.[1]?.trim() || null;
  const amount = parseMoney(text);
  const trustedVendor = trustedVendors.includes(vendor.toLowerCase());
  const riskReasons: string[] = [];
  if (!trustedVendor) riskReasons.push("vendor is not on the trusted list");
  if (amount > 10000) riskReasons.push("amount exceeds $10,000");
  if (!purchaseOrder) riskReasons.push("purchase order is missing");
  return {
    invoiceNumber,
    vendor,
    amount,
    currency: "USD",
    dueDate,
    purchaseOrder,
    lineItems: [{ description: text.split("\n").find((line) => line.includes("—"))?.split("—")[0]?.trim() || "Invoice services", quantity: 1, unitPrice: amount }],
    trustedVendor,
    riskLevel: riskReasons.length ? "high" : "low",
    riskReasons,
    confidence: amount && vendor !== "Unknown vendor" ? 98 : 72
  };
}

async function extractWithGemini(text: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Extract invoice fields from the input below. Return only valid JSON with keys invoiceNumber, vendor, amount, currency, dueDate, purchaseOrder, lineItems. lineItems must be an array of description, quantity, unitPrice. Input:\n${text}` }] }]
    }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Gemini extraction failed.");
  const payload = await response.json();
  const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text?.replace(/^```json\s*|\s*```$/g, "");
  if (!raw) throw new Error("Gemini returned no extraction.");
  return JSON.parse(raw);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "pay") {
      const invoice = body.invoice as Invoice | undefined;
      if (!invoice || body.approved !== true) {
        return NextResponse.json({ error: "Payment requires an explicit approved workflow." }, { status: 403 });
      }
      if (!isValidatedInvoice(invoice)) {
        return NextResponse.json({ error: invoiceRejectedMessage }, { status: 422 });
      }
      return NextResponse.json({ transactionId: `SIM-${Date.now().toString(36).toUpperCase()}`, mode: "simulated" });
    }
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "Invoice text is required." }, { status: 400 });
    const gemini = await extractWithGemini(text).catch(() => null);
    const invoice = parseInvoice(text);
    if (gemini) {
      const extracted = { ...invoice, ...gemini, amount: Number(gemini.amount) || invoice.amount };
      extracted.trustedVendor = trustedVendors.includes(String(extracted.vendor).toLowerCase());
      extracted.riskReasons = [
        ...(!extracted.trustedVendor ? ["vendor is not on the trusted list"] : []),
        ...(extracted.amount > 10000 ? ["amount exceeds $10,000"] : []),
        ...(!extracted.purchaseOrder ? ["purchase order is missing"] : [])
      ];
      extracted.riskLevel = extracted.riskReasons.length ? "high" : "low";
      if (!isValidatedInvoice(extracted)) {
        return NextResponse.json({ error: invoiceRejectedMessage }, { status: 422 });
      }
      return NextResponse.json({ invoice: extracted, extraction: "gemini" });
    }
    if (!isValidatedInvoice(invoice)) {
      return NextResponse.json({ error: invoiceRejectedMessage }, { status: 422 });
    }
    return NextResponse.json({ invoice, extraction: "mock" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request." }, { status: 500 });
  }
}
