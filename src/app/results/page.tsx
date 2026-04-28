"use client";

import { useState, useEffect, useCallback } from "react";
import { Provider, Facility, EMRClient, ParsedPDFResult, HL7Result } from "@/lib/types";

function HL7Highlight({ content }: { content: string }) {
  if (!content) return null;
  const lines = content.split(/\r?\n/).filter(Boolean);
  return (
    <div className="hl7-preview" style={{ height: "400px", overflowY: "auto" }}>
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
  
  // Dynamic Data
  const [providers, setProviders] = useState<Provider[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [emrClients, setEmrClients] = useState<EMRClient[]>([]);
  
  const [emrType, setEmrType] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [viewPdf, setViewPdf] = useState(false);

  // Editable fields
  const [editPhysNPI, setEditPhysNPI] = useState("");
  const [editPhysFirst, setEditPhysFirst] = useState("");
  const [editPhysLast, setEditPhysLast] = useState("");
  const [editPhysCred, setEditPhysCred] = useState("");
  const [editFacility, setEditFacility] = useState("");
  const [editTestName, setEditTestName] = useState("");
  const [editPatientFirst, setEditPatientFirst] = useState("");
  const [editPatientLast, setEditPatientLast] = useState("");

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    try {
      const [pRes, fRes, eRes] = await Promise.all([
        fetch("/api/providers"), fetch("/api/facilities"), fetch("/api/emr-clients")
      ]);
      setProviders(await pRes.json());
      setFacilities(await fRes.json());
      const emrs = await eRes.json();
      setEmrClients(emrs);
      if (emrs.length > 0) setEmrType(emrs[0].id);
    } catch {}

    const stored = sessionStorage.getItem("parsedResults");
    if (!stored) return;
    
    const parsed: ParsedPDFResult[] = JSON.parse(stored);
    const generated: HL7Result[] = [];
    
    for (const p of parsed) {
      try {
        const res = await fetch("/api/generate-hl7", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parsedData: p }),
        });
        const data = await res.json();
        generated.push({
          id: data.messageId || `hl7-${Date.now()}-${Math.random()}`,
          parsedData: p,
          hl7Content: data.hl7Content || "",
          emrType: "",
          status: "pending",
          createdAt: new Date().toISOString(),
        });
      } catch {
        generated.push({ id: `hl7-err-${Date.now()}`, parsedData: p, hl7Content: "", emrType: "", status: "failed", createdAt: new Date().toISOString() });
      }
    }
    setResults(generated);
    if (generated.length > 0) setSelectedIdx(0);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const selected = selectedIdx !== null ? results[selectedIdx] : null;

  const startEdit = () => {
    if (!selected) return;
    setEditPhysNPI(selected.parsedData.referringPhysicianNPI);
    setEditPhysFirst(selected.parsedData.referringPhysicianFirstName);
    setEditPhysLast(selected.parsedData.referringPhysicianLastName);
    setEditPhysCred(selected.parsedData.referringPhysicianCredential);
    setEditFacility(selected.parsedData.facilityName);
    setEditTestName(selected.parsedData.testName);
    setEditPatientFirst(selected.parsedData.patientFirstName);
    setEditPatientLast(selected.parsedData.patientLastName);
    setEditMode(true);
  };

  const applyProviderSelect = (npi: string) => {
    const prov = providers.find((p) => p.npi === npi);
    if (prov) {
      setEditPhysNPI(prov.npi); setEditPhysFirst(prov.firstName); setEditPhysLast(prov.lastName); setEditPhysCred(prov.credential);
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
      updatedParsed.patientFirstName = editPatientFirst;
      updatedParsed.patientLastName = editPatientLast;
    }
    
    try {
      const res = await fetch("/api/generate-hl7", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsedData: updatedParsed }),
      });
      const data = await res.json();
      const updated = [...results];
      updated[selectedIdx] = { ...updated[selectedIdx], parsedData: updatedParsed, hl7Content: data.hl7Content };
      setResults(updated);
      setEditMode(false);
      showToast("HL7 regenerated successfully");
    } catch {
      showToast("Failed to regenerate", "error");
    }
  };

  const handleSend = async () => {
    if (selectedIdx === null || !selected || !emrType) return;
    setSending(true);
    try {
      const res = await fetch("/api/send-hl7", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hl7Content: selected.hl7Content,
          emrType,
          fileName: `${selected.parsedData.patientLastName}_${selected.parsedData.patientFirstName}_HL7.txt`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const updated = [...results];
        updated[selectedIdx] = { ...updated[selectedIdx], status: "sent", emrType, sentAt: new Date().toISOString() };
        setResults(updated);
        showToast("Sent to EMR successfully");
      }
    } catch {
      showToast("Send failed", "error");
    }
    setSending(false);
  };

  const removeResult = (idx: number) => {
    const updated = results.filter((_, i) => i !== idx);
    setResults(updated);
    sessionStorage.setItem("parsedResults", JSON.stringify(updated.map(r => r.parsedData)));
    setSelectedIdx(updated.length > 0 ? 0 : null);
  };

  return (
    <>
      <div className="page-header flex items-center justify-between">
        <div><h2>Review & Send Results</h2><p>Validate HL7 data against original PDF and push to EMR</p></div>
        <div className="flex gap-3 items-center">
          <label className="form-label" style={{ margin: 0 }}>Target EMR:</label>
          <select className="form-select" style={{ width: 200 }} value={emrType} onChange={(e) => setEmrType(e.target.value)}>
            {emrClients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.connectionType?.toUpperCase()})</option>)}
          </select>
        </div>
      </div>

      <div className="page-body">
        {results.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No Results Ready</h3>
            <p>Upload and parse PDFs first.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
            {/* List */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Pending Results ({results.length})</h3>
              {results.map((r, i) => (
                <div
                  key={r.id} className="card"
                  style={{ marginBottom: 8, cursor: "pointer", borderColor: i === selectedIdx ? "var(--accent)" : undefined, padding: 12 }}
                  onClick={() => { setSelectedIdx(i); setEditMode(false); setViewPdf(false); }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {r.parsedData.patientLastName || "?"}, {r.parsedData.patientFirstName || "?"}
                    </span>
                    <span className={`badge ${r.status === "sent" ? "badge-success" : "badge-warning"}`}>{r.status}</span>
                  </div>
                  <div className="text-muted text-xs flex justify-between">
                    <span className="truncate" style={{maxWidth: 180}}>{r.parsedData.testName || "Unknown Test"}</span>
                    <button onClick={(e) => { e.stopPropagation(); removeResult(i); }} style={{background: "none", border: "none", color: "var(--danger)", cursor: "pointer"}}>✕</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Detail */}
            {selected && (
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="flex items-center justify-between">
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                    {selected.parsedData.patientLastName || "Unknown"}, {selected.parsedData.patientFirstName || "Unknown"}
                  </h3>
                  <div className="flex gap-2">
                    <button className={`btn ${viewPdf ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewPdf(!viewPdf)}>
                      📄 {viewPdf ? "Hide PDF" : "View Original PDF"}
                    </button>
                    {!editMode && <button className="btn btn-secondary" onClick={startEdit}>✏️ Edit Data</button>}
                    {selected.status !== "sent" && (
                      <button className="btn btn-success" onClick={handleSend} disabled={sending}>
                        {sending ? "Sending..." : "🚀 Send to EMR"}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: viewPdf ? "1fr 1fr" : "1fr", gap: 20 }}>
                  
                  {/* Editor / Info Pane */}
                  <div>
                    {editMode ? (
                      <div className="card" style={{background: "var(--bg-secondary)"}}>
                        <h4 className="mb-4" style={{fontSize: 14, fontWeight: 600}}>Edit Parsed Data</h4>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div className="form-group w-full">
                            <label className="form-label">Patient First Name</label>
                            <input className="form-input" value={editPatientFirst} onChange={(e) => setEditPatientFirst(e.target.value)} />
                          </div>
                          <div className="form-group w-full">
                            <label className="form-label">Patient Last Name</label>
                            <input className="form-input" value={editPatientLast} onChange={(e) => setEditPatientLast(e.target.value)} />
                          </div>
                          <div className="form-group" style={{gridColumn: "1/-1"}}>
                            <label className="form-label">Select Saved Physician</label>
                            <select className="form-select" onChange={(e) => applyProviderSelect(e.target.value)}>
                              <option value="">Custom Entry...</option>
                              {providers.map(p => <option key={p.npi} value={p.npi}>{p.firstName} {p.lastName} ({p.npi})</option>)}
                            </select>
                          </div>
                          <div className="form-group w-full">
                            <label className="form-label">Physician First Name</label>
                            <input className="form-input" value={editPhysFirst} onChange={(e) => setEditPhysFirst(e.target.value)} />
                          </div>
                          <div className="form-group w-full">
                            <label className="form-label">Physician Last Name</label>
                            <input className="form-input" value={editPhysLast} onChange={(e) => setEditPhysLast(e.target.value)} />
                          </div>
                          <div className="form-group w-full">
                            <label className="form-label">NPI</label>
                            <input className="form-input" value={editPhysNPI} onChange={(e) => setEditPhysNPI(e.target.value)} />
                          </div>
                          <div className="form-group w-full">
                            <label className="form-label">Facility</label>
                            <select className="form-select" value={editFacility} onChange={(e) => setEditFacility(e.target.value)}>
                              <option value="">Select Facility...</option>
                              {facilities.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                            </select>
                          </div>
                          <div className="form-group" style={{gridColumn: "1/-1"}}>
                            <label className="form-label">Test / Study Name</label>
                            <input className="form-input" value={editTestName} onChange={(e) => setEditTestName(e.target.value)} />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button className="btn btn-primary" onClick={regenerateHL7}>🔄 Save & Regenerate HL7</button>
                          <button className="btn btn-secondary" onClick={() => setEditMode(false)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="card" style={{background: "var(--bg-secondary)"}}>
                        <h4 className="mb-4" style={{fontSize: 14, fontWeight: 600}}>HL7 Message Preview</h4>
                        <HL7Highlight content={selected.hl7Content} />
                      </div>
                    )}
                  </div>

                  {/* PDF Viewer Pane */}
                  {viewPdf && (
                    <div style={{ border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", overflow: "hidden", height: "600px" }}>
                      <iframe 
                        src={`data:application/pdf;base64,${selected.parsedData.pdfBase64}#toolbar=0`} 
                        width="100%" 
                        height="100%" 
                        style={{ border: "none" }}
                      />
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {toast && <div className="toast-container"><div className={`toast toast-${toast.type}`}>{toast.msg}</div></div>}
    </>
  );
}
