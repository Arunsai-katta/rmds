"use client";

import { usePathname } from "next/navigation";

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="sidebar-nav">
      <a href="/mappings" className={pathname === "/mappings" ? "active" : ""}>
        <span className="nav-icon">🔗</span> Mapping Data
      </a>
      <a href="/upload" className={pathname === "/upload" ? "active" : ""}>
        <span className="nav-icon">📤</span> Upload Results
      </a>
      <a href="/results" className={pathname === "/results" ? "active" : ""}>
        <span className="nav-icon">🚀</span> Send Results
      </a>
      <a href="/uploaded" className={pathname === "/uploaded" ? "active" : ""}>
        <span className="nav-icon">✅</span> Uploaded Results
      </a>
    </nav>
  );
}
