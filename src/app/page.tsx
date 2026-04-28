import { providers } from "@/data/providers";
import { facilities } from "@/data/facilities";
import { emrClients } from "@/data/emr-clients";
import mappingsData from "@/data/mappings.json";
import Link from "next/link";

export default function Dashboard() {
  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>RMDS HL7 Results Management Overview</p>
      </div>
      <div className="page-body">
        <div className="card-grid card-grid-4 mb-6">
          <div className="card stat-card">
            <div className="stat-icon">👨‍⚕️</div>
            <div className="stat-value">{providers.length}</div>
            <div className="stat-label">Physicians</div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon">🏥</div>
            <div className="stat-value">{facilities.length}</div>
            <div className="stat-label">Facilities</div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon">🔗</div>
            <div className="stat-value">{mappingsData.length}</div>
            <div className="stat-label">Mappings</div>
          </div>
          <div className="card stat-card">
            <div className="stat-icon">💻</div>
            <div className="stat-value">{emrClients.length}</div>
            <div className="stat-label">EMR Clients</div>
          </div>
        </div>

        <div className="card-grid card-grid-2">
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              <Link href="/upload" className="btn btn-primary" id="action-upload">📤 Upload PDFs</Link>
              <Link href="/mappings" className="btn btn-secondary" id="action-mappings">🔗 Manage Mappings</Link>
              <Link href="/results" className="btn btn-secondary" id="action-results">📋 View Results</Link>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>EMR Clients</h3>
            <div className="flex flex-wrap gap-2">
              {emrClients.map((c) => (
                <span key={c.id} className="badge badge-accent" style={{ borderLeft: `3px solid ${c.color}` }}>
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="card mt-6">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Recent Physicians</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>NPI</th>
                  <th>Credential</th>
                  <th>Practice Group</th>
                </tr>
              </thead>
              <tbody>
                {providers.slice(0, 8).map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td><code style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.npi}</code></td>
                    <td><span className="badge badge-info">{p.credential}</span></td>
                    <td className="text-muted">{p.practiceGroup}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
