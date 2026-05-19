import type { Metadata } from "next";
import "./globals.css";
import NavLinks from "./NavLinks";

export const metadata: Metadata = {
  title: "RMDS HL7 Results Manager",
  description: "Manage HL7 lab results, physician-facility mappings, and EMR integrations for Reliance Mobile Diagnostic Services",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="app-layout">
          <aside className="sidebar">
            <div className="sidebar-brand">
              <div className="sidebar-brand-icon">RM</div>
              <div className="sidebar-brand-text">
                <h1>RMDS Manager</h1>
                <span>HL7 Results Platform</span>
              </div>
            </div>
            <nav className="sidebar-nav">
              <NavLinks />
            </nav>
          </aside>
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
