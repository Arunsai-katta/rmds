"use client";

import { useState, useEffect, useCallback } from "react";
import { providers } from "@/data/providers";
import { facilities } from "@/data/facilities";
import { emrClients } from "@/data/emr-clients";
import { cptMappings } from "@/data/cpt-codes";
import { ParsedPDFResult, HL7Result } from "@/lib/types";

function HL7Highlight({ content }: { content: string }) {
  if (!content) return null;
  const lines = content.split(/\r?\n/).filter(Boolean);
  return (
    <div className="hl7-preview">
      {lines.map((line, i) => {
        let cls = "";
        if (line.startsWith("MSH")) cls = "seg-msh";
        else if (line.startsWith("PID")) cls = "seg-pid";
        else if (line.startsWith("PV1")) cls = "seg-pv1";
        else if (line.startsWith("OBR")) cls = "seg-obr";
        else if (line.startsWith("OBX")) cls = "seg-obx";
        const display = line.startsWith("OBX|2|ED") && line.length > 80
          ? line.substring(0, 70) + "... [base64 data]"
          : line;
        return <div key={i} className={cls}>{display}</div>;
      })}
    </div>
  );
}

export default function ResultsPage() {
  const [results, setResults] = useState<HL7Result[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [emrType, setEmrType] = useState("practice-fusion");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Editable fields
  const [editPhysNPI, setEditPhysNPI] = useState("");
  const [editPhysFirst, setEditPhysFirst] = useState("");
  const [editPhysLast, setEditPhysLast] = useState("");
  const [editPhysCred, setEditPhysCred] = useState("");
  const [editFacility, setEditFacility] = useState("");
  const [editTestName, setEditTestName] = useState("");
  const [editCPT, setEditCPT] = useState("");

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  const loadFromSession = useCallback(async () => {
    const stored = sessionStorage.getItem("parsedResults");
    if (!stored) return;
    const parsed: ParsedPDFResult[] = JSON.parse(stored);
    const generated: HL7Result[] = [];
    for (const p of parsed) {
      try {
        const res = await fetch("/api/generate-hl7", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parsedData: p }),
        });
        const data = await res.json();
        generated.push({
          id: data.messageId || `hl7-${Date.now()}-${Math.random()}`,
          parsedData: p,
          hl7Content: data.hl7Content || "",
          emrType: "practice-fusion",
          status: "pending",
          createdAt: new Date().toISOString(),
        });
      } catch {
        generated.push({
          id: `hl7-err-${Date.now()}`,
          parsedData: p,
          hl7Content: "",
          emrType: "",
          status: "failed",
          createdAt: new Date().toISOString(),
        });
      }
    }
    setResults(generated);
    if (generated.length > 0) setSelectedIdx(0);
  }, []);

  useEffect(() => { loadFromSession(); }, [loadFromSession]);

  const selected = selectedIdx !== null ? results[selectedIdx] : null;

  const startEdit = () => {
    if (!selected) return;
    setEditPhysNPI(selected.parsedData.referringPhysicianNPI);
    setEditPhysFirst(selected.parsedData.referringPhysicianFirstName);
    setEditPhysLast(selected.parsedData.referringPhysicianLastName);
    setEditPhysCred(selected.parsedData.referringPhysicianCredential);
    setEditFacility(selected.parsedData.facilityName);
    setEditTestName(selected.parsedData.testName);
    setEditCPT(selected.parsedData.cptCode);
    setEditMode(true);
  };

  const applyProviderSelect = (npi: string) => {
    const prov = providers.find((p) => p.npi === npi);
    if (prov) {
      setEditPhysNPI(prov.npi);
      setEditPhysFirst(prov.firstName);
      setEditPhysLast(prov.lastName);
      setEditPhysCred(prov.credential);
    }
  };

  const regenerateHL7 = async () => {
    if (selectedIdx === null || !selected) return;
    const updatedParsed = { ...selected.parsedData };
    if (editMode) {
      updatedParsed.referringPhysicianNPI = editPhysNPI;
      updatedParsed.referringPhysicianFirstName = editPhysFirst;
      updatedParsed.referringPhysicianLastName = editPhysLast;
      updatedParsed.referringPhysicianCredential = editPhysCred;
      updatedParsed.facilityName = editFacility;
      updatedParsed.testName = editTestName;
      updatedParsed.testDescription = editTestName;
      updatedParsed.cptCode = editCPT;
    }
    const fac = facilities.find((f) => f.name === updatedParsed.facilityName);
    try {
      const res = await fetch("/api/generate-hl7", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parsedData: updatedParsed,
          overrides: fac ? { facilityCompanyId: fac.companyId, facilityName: fac.name, facilityAddress: fac.address, facilityCity: fac.city, facilityState: fac.state, facilityZip: fac.zip } : undefined,
        }),
      });
      const data = await res.json();
      const updated = [...results];
      updated[selectedIdx] = { ...updated[selectedIdx], parsedData: updatedParsed, hl7Content: data.hl7Content, emrType };
      setResults(updated);
      setEditMode(false);
      showToast("HL7 regenerated with updates");
    } catch {
      showToast("Failed to regenerate", "error");
    }
  };

  const handleSend = async () => {
    if (selectedIdx === null || !selected) return;
    setSending(true);
    try {
      const res = await fetch("/api/send-hl7", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hl7Content: selected.hl7Content,
          emrType,
          fileName: `${selected.parsedData.patientLastName}_${selected.parsedData.patientFirstName}_${selected.parsedData.testName.replace(/\s+/g, "_")}_HL7.txt`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const updated = [...results];
        updated[selectedIdx] = { ...updated[selectedIdx], status: "sent", emrType, sentAt: new Date().toISOString() };
        setResults(updated);
        showToast(`Sent to ${emrClients.find((e) => e.id === emrType)?.name || emrType}`);
      }
    } catch {
      showToast("Send failed", "error");
    }
    setSending(false);
  };

  const statusBadge = (s: string) => s === "sent" ? "badge-success" : s === "failed" ? "badge-danger" : "badge-warning";

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div><h2>Results & Send</h2><p>Review generated HL7 messages and send to EMR</p></div>
          <div className="flex gap-3 items-center">
            <label className="form-label" style={{ margin: 0 }}>EMR:</label>
            <select className="form-select" style={{ width: 200 }} value={emrType} onChange={(e) => setEmrType(e.target.value)} id="emr-select">
              {emrClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="page-body">
        {results.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No Results Yet</h3>
            <p>Upload and parse PDFs first, then come here to review and send</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
            {/* Result list */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Results ({results.length})</h3>
              {results.map((r, i) => (
                <div
                  key={r.id}
                  className="card"
                  style={{ marginBottom: 8, cursor: "pointer", borderColor: i === selectedIdx ? "var(--accent)" : undefined, padding: 14 }}
                  onClick={() => { setSelectedIdx(i); setEditMode(false); }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.parsedData.patientLastName}, {r.parsedData.patientFirstName}</span>
                    <span className={`badge ${statusBadge(r.status)}`}>{r.status}</span>
                  </div>
                  <div className="text-muted text-xs mt-2">{r.parsedData.testName}</div>
                </div>
              ))}
            </div>

            {/* Detail pane */}
            {selected ? (
              <div>
                <div className="card mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>
                      {selected.parsedData.patientLastName}, {selected.parsedData.patientFirstName}
                    </h3>
                    <div className="flex gap-2">
                      {!editMode && <button className="btn btn-secondary btn-sm" onClick={startEdit}>✏️ Edit</button>}
                      {selected.status !== "sent" && (
                        <button className="btn btn-success" onClick={handleSend} disabled={sending} id="send-btn">
                          {sending ? <><span className="loading-spinner" /> Sending...</> : `🚀 Send to ${emrClients.find((e) => e.id === emrType)?.name}`}
                        </button>
                      )}
                    </div>
                  </div>

                  {editMode ? (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div className="form-group">
                          <label className="form-label">Physician (select)</label>
                          <select className="form-select" value={editPhysNPI} onChange={(e) => applyProviderSelect(e.target.value)} id="edit-provider">
                            <option value="">Custom...</option>
                            {providers.map((p) => <option key={p.npi} value={p.npi}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">NPI</label>
                          <input className="form-input" value={editPhysNPI} onChange={(e) => setEditPhysNPI(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">First Name</label>
                          <input className="form-input" value={editPhysFirst} onChange={(e) => setEditPhysFirst(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Last Name</label>
                          <input className="form-input" value={editPhysLast} onChange={(e) => setEditPhysLast(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Facility</label>
                          <select className="form-select" value={editFacility} onChange={(e) => setEditFacility(e.target.value)} id="edit-facility">
                            {facilities.map((f) => <option key={f.id} value={f.name}>{f.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Credential</label>
                          <select className="form-select" value={editPhysCred} onChange={(e) => setEditPhysCred(e.target.value)}>
                            <option value="NP">NP</option><option value="MD">MD</option><option value="DO">DO</option><option value="PA">PA</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Test Name</label>
                          <input className="form-input" value={editTestName} onChange={(e) => setEditTestName(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">CPT Code</label>
                          <select className="form-select" value={editCPT} onChange={(e) => setEditCPT(e.target.value)}>
                            <option value="">Select...</option>
                            {cptMappings.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.description}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button className="btn btn-secondary" onClick={() => setEditMode(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={regenerateHL7} id="regenerate-btn">🔄 Regenerate HL7</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 16px", fontSize: 13 }}>
                      <div><span className="text-muted text-xs">Physician</span><br /><strong>{selected.parsedData.referringPhysicianFirstName} {selected.parsedData.referringPhysicianLastName}</strong></div>
                      <div><span className="text-muted text-xs">NPI</span><br /><code style={{ fontSize: 11 }}>{selected.parsedData.referringPhysicianNPI || "—"}</code></div>
                      <div><span className="text-muted text-xs">Credential</span><br />{selected.parsedData.referringPhysicianCredential}</div>
                      <div><span className="text-muted text-xs">Facility</span><br />{selected.parsedData.facilityName}</div>
                      <div><span className="text-muted text-xs">Test</span><br />{selected.parsedData.testName}</div>
                      <div><span className="text-muted text-xs">CPT</span><br />{selected.parsedData.cptCode || "—"}</div>
                      <div><span className="text-muted text-xs">DOB</span><br />{selected.parsedData.patientDOB}</div>
                      <div><span className="text-muted text-xs">Exam Date</span><br />{selected.parsedData.examDate}</div>
                      <div><span className="text-muted text-xs">Status</span><br /><span className={`badge ${statusBadge(selected.status)}`}>{selected.status}</span></div>
                    </div>
                  )}
                </div>

                <div className="card">
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>HL7 Preview</h3>
                  {selected.hl7Content ? (
                    <HL7Highlight content={selected.hl7Content} />
                  ) : (
                    <div className="text-muted text-sm">No HL7 content generated</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-state"><p>Select a result to view details</p></div>
            )}
          </div>
        )}
      </div>

      {toast && <div className="toast-container"><div className={`toast toast-${toast.type}`}>{toast.msg}</div></div>}
    </>
  );
}
