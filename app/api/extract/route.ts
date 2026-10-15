import { pathToFileURL } from "node:url";
import { NextResponse } from "next/server";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export const runtime = "nodejs";

pdfjs.GlobalWorkerOptions.workerSrc =
  pathToFileURL(
    `${process.cwd()}/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs`,
  ).toString();

function looksLikeInvoice(text: string) {
  const normalized = text.toLowerCase();
  const signals = [
    { pattern: /\b(invoice|tax invoice|commercial invoice|proforma invoice)\b/, weight: 3 },
    { pattern: /\b(bill|billing|statement of account|receipt)\b/, weight: 2 },
    { pattern: /\b(total due|amount due|balance due|invoice total|subtotal)\b/, weight: 2 },
    { pattern: /\b(due date|payment due|payment terms|net \d+)\b/, weight: 1 },
    { pattern: /\b(vendor|supplier|seller|bill to|billed to|ship to|remit to)\b/, weight: 1 },
    { pattern: /\b(invoice\s*(number|no|#)|reference number|purchase order|po\s*#)\b/, weight: 1 },
    { pattern: /\b(description|quantity|qty|unit price|line item|services rendered)\b/, weight: 1 },
    { pattern: /\b(tax|vat|gst|sales tax|shipping|discount)\b/, weight: 1 }
  ];
  const score = signals.reduce((total, signal) => total + (signal.pattern.test(normalized) ? signal.weight : 0), 0);
  const hasFinancialAmount = /(?:[$€£]\s*)\d[\d,.\s]*|\b(?:usd|eur|gbp|inr|cad|aud)\s*\d[\d,.\s]*/i.test(text)
    || /\b(?:total|amount due|balance due|subtotal|tax|invoice total)[^\n]{0,50}\d[\d,.\s]*/i.test(normalized);
  const hasDocumentIdentity = /\b(invoice|bill|billing|tax invoice|commercial invoice|proforma|amount due|total due|balance due)\b/.test(normalized);
  const hasStrongNonInvoiceSignal = /\b(resume|curriculum vitae|cover letter|meeting agenda|certificate|transcript|terms and conditions|privacy policy)\b/.test(normalized);
  return hasDocumentIdentity && hasFinancialAmount && score >= 4 && !(hasStrongNonInvoiceSignal && score < 6);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const isPdf = file instanceof File && (file.type === "application/pdf" || !file.type && /\.pdf$/i.test(file.name));
    if (!(file instanceof File) || !isPdf) {
      return NextResponse.json({ error: "A PDF invoice file is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const totalPages = document.numPages;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    await document.destroy();
    const text = pages.join("\n").trim();
    if (!text) {
      return NextResponse.json({ error: "This PDF does not contain selectable text. Paste its extracted text instead." }, { status: 422 });
    }
    if (!looksLikeInvoice(text)) {
      return NextResponse.json({ error: "Invoice or bill not found. Upload an invoice or bill document to continue." }, { status: 422 });
    }
    return NextResponse.json({ text, pages: totalPages });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The PDF could not be read." }, { status: 500 });
  }
}
