import Link from "next/link";
import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "About ULTRON AI",
  description: "About ULTRON AI, a governed invoice operations agent."
};

function YMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5 12 12 19 5" /><path d="M12 12v8" /><path d="M8 20h8" /></svg>;
}

export default function AboutPage() {
  return (
    <main className="about-shell">
      <nav className="topbar about-topbar">
        <Link className="brand" href="/"><span className="brand-mark"><YMark /></span><span>ULTRON<span className="brand-ai">/AI</span></span></Link>
        <Link className="back-link" href="/">← Back to command center</Link>
      </nav>
      <section className="about-hero">
        <div className="about-face"><YMark /></div>
        <div className="eyebrow"><span>●</span> OPERATOR-FIRST AUTOMATION</div>
        <h1>Workflows that know<br /><em>when to pause.</em></h1>
        <p>ULTRON turns messy operational inputs into structured, governed actions. It extracts the signal, applies policy, and keeps a human in control when impact matters.</p>
      </section>
      <section className="about-grid">
        <article className="about-panel"><span className="section-kicker">THE LOOP</span><h2>Parse. Decide. Act. Verify.</h2><p>Every invoice moves through a visible workflow: ingestion, normalization, risk assessment, approval, and simulated execution. The audit trail makes each transition inspectable.</p></article>
        <article className="about-panel"><span className="section-kicker">THE PRINCIPLE</span><h2>Autonomy with a safety net.</h2><p>Safe, trusted invoices can move automatically. Higher-impact or unfamiliar actions stop at an explicit approval boundary before anything changes.</p></article>
      </section>
      <section className="made-by"><span className="made-by-label">BUILT FOR THE HACKATHON</span><strong>Made by Yash</strong><span>ULTRON AI · Governed autonomy for the work between systems</span></section>
      <footer><Link className="footer-brand-link" href="/"><span><span className="footer-mark"><YMark /></span> ULTRON AI</span></Link><span>Demo workspace · Safe mock connectors</span></footer>
    </main>
  );
}
