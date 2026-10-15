import { createRequire } from "node:module";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse/lib/pdf-parse.js") as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

function looksLikeInvoice(text: string) {
  const normalized = text.toLowerCase();
  const hasInvoiceLanguage = /\b(invoice|bill|statement of account|amount due|total due)\b/.test(normalized);
  const hasCommercialDetails = /\b(vendor|supplier|bill to|invoice\s*(number|no|#)|amount due|total due|payment terms)\b/.test(normalized);
  const hasAmount = /(?:[$€£]\s?[\d,.]+|\b(?:usd|eur|gbp)\s?[\d,.]+)/i.test(text);
  return hasInvoiceLanguage && hasCommercialDetails && hasAmount;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.type !== "application/pdf") {
      return NextResponse.json({ error: "A PDF invoice file is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdf(buffer);
    const text = result.text.trim();
    if (!text) {
      return NextResponse.json({ error: "This PDF does not contain selectable text. Paste its extracted text instead." }, { status: 422 });
    }
    if (!looksLikeInvoice(text)) {
      return NextResponse.json({ error: "Invoice or bill not found. Upload an invoice or bill document to continue." }, { status: 422 });
    }
    return NextResponse.json({ text, pages: result.numpages });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The PDF could not be read." }, { status: 500 });
  }
}
