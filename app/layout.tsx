import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ULTRON AI | Governed invoice operations",
  description: "An action-oriented invoice processing agent with human approval and an inspectable audit trail."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
