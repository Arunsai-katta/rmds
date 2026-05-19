"use client";

import { useState, useEffect, useCallback } from "react";
import { Provider, Facility, EMRClient, ParsedPDFResult, HL7Result, CPTMapping } from "@/lib/types";

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
  const [cptCodes, setCptCodes] = useState<CPTMapping[]>([]);
  
  const [emrType, setEmrType] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Editable fields
  const [editPhysNPI, setEditPhysNPI] = useState("");
  const [editPhysFirst, setEditPhysFirst] = useState("");
  const [editPhysLast, setEditPhysLast] = useState("");
  const [editPhysCred, setEditPhysCred] = useState("");
  const [editFacility, setEditFacility] = useState("");
  const [editTestName, setEditTestName] = useState("");
  const [editPatientFirst, setEditPatientFirst] = useState("");
  const [editPatientLast, setEditPatientLast] = useState("");
  const [editPatientGender, setEditPatientGender] = useState("");
  const [editFacilityId, setEditFacilityId] = useState("");

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, fRes, eRes, cptRes, rRes] = await Promise.all([
        fetch("/api/providers"), fetch("/api/facilities"), fetch("/api/emr-clients"),
        fetch("/api/cpt-codes"), fetch("/api/results?status=pending,failed")
      ]);
      setProviders(await pRes.json());
      const facs: Facility[] = await fRes.json();
      setFacilities(facs);
      const emrs: EMRClient[] = await eRes.json();
      setEmrClients(emrs);
      setCptCodes(await cptRes.json());
      if (emrs.length > 0) setEmrType(emrs[0].id);

      const dbResults = await rRes.json();
      const mapped: HL7Result[] = (dbResults as any[]).map((r) => ({
        id: r.id,
        parsedData: r.parsedData,
        hl7Content: r.hl7Content || "",
        emrType: r.emrClientId || "",
        status: r.status,
        createdAt: r.createdAt,
        sentAt: r.sentAt,
      }));
      setResults(mapped);
      if (mapped.length > 0) setSelectedIdx(0);
    } catch {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-set Target EMR based on the selected result's facility
  useEffect(() => {
    if (selectedIdx === null || results.length === 0 || facilities.length === 0) return;
    const result = results[selectedIdx];
    if (!result) return;
    const facilityId = result.parsedData.facilityId;
    if (facilityId) {
      const fac = facilities.find(f => f.id === facilityId);
      if (fac?.emrClientId) { setEmrType(fac.emrClientId); return; }
    }
    // Fallback: use emrClientId stored on the result record itself
    if (result.emrType) { setEmrType(result.emrType); return; }
  }, [selectedIdx, results, facilities]);

  const selected = selectedIdx !== null ? results[selectedIdx] : null;

  const startEdit = () => {
    if (!selected) return;
    setEditPhysNPI(selected.parsedData.referringPhysicianNPI);
    setEditPhysFirst(selected.parsedData.referringPhysicianFirstName);
    setEditPhysLast(selected.parsedData.referringPhysicianLastName);
    setEditPhysCred(selected.parsedData.referringPhysicianCredential);
    const matchedFac = facilities.find(f => f.name === selected.parsedData.facilityName || f.id === selected.parsedData.facilityId);
    setEditFacility(matchedFac?.name || selected.parsedData.facilityName);
    setEditFacilityId(matchedFac?.id || "");
    setEditTestName(selected.parsedData.testName);
    setEditPatientFirst(selected.parsedData.patientFirstName);
    setEditPatientLast(selected.parsedData.patientLastName);
    setEditPatientGender(selected.parsedData.patientGender || "U");
    setEditMode(true);
  };

  const applyProviderSelect = (npi: string) => {
    const prov = providers.find((p) => p.npi === npi);
    if (!prov) return;
    setEditPhysNPI(prov.npi);
    setEditPhysFirst(prov.firstName);
    setEditPhysLast(prov.lastName);
    setEditPhysCred(prov.credential);
    // Auto-set facility from provider's linked facilityId
    if (prov.facilityId) {
      const fac = facilities.find(f => f.id === prov.facilityId);
      if (fac) {
        setEditFacility(fac.name);
        setEditFacilityId(fac.id);
        // Auto-set EMR from facility's linked emrClientId
        if (fac.emrClientId) setEmrType(fac.emrClientId);
      }
    }
  };

  const applyFacilitySelect = (facilityId: string) => {
    const fac = facilities.find(f => f.id === facilityId);
    if (!fac) return;
    setEditFacility(fac.name);
    setEditFacilityId(fac.id);
    if (fac.emrClientId) setEmrType(fac.emrClientId);
  };

  const validateEditForm = (): boolean => {
    const errs: Record<string, string> = {};
    const isUnk = (v: string) => !v.trim() || v.trim().toUpperCase() === "UNKNOWN";
    if (isUnk(editPatientFirst)) errs.patientFirst = "Required and cannot be Unknown";
    if (isUnk(editPatientLast)) errs.patientLast = "Required and cannot be Unknown";
    if (isUnk(editPhysFirst)) errs.physFirst = "Required and cannot be Unknown";
    if (isUnk(editPhysLast)) errs.physLast = "Required and cannot be Unknown";
    if (isUnk(editPhysNPI)) errs.npi = "Required and cannot be Unknown";
    if (!editFacilityId.trim()) errs.facility = "Please select a facility";
    if (!editTestName.trim()) errs.testName = "Please select a test / study";
    setEditErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const regenerateHL7 = async () => {
    if (selectedIdx === null || !selected) return;
    if (!validateEditForm()) return;
    const updatedParsed = { ...selected.parsedData };
    if (editMode) {
      updatedParsed.referringPhysicianNPI = editPhysNPI;
      updatedParsed.referringPhysicianFirstName = editPhysFirst;
      updatedParsed.referringPhysicianLastName = editPhysLast;
      updatedParsed.referringPhysicianCredential = editPhysCred;
      updatedParsed.facilityName = editFacility;
      updatedParsed.facilityId = editFacilityId;
      updatedParsed.testName = editTestName;
      updatedParsed.patientFirstName = editPatientFirst;
      updatedParsed.patientLastName = editPatientLast;
      updatedParsed.patientGender = editPatientGender;
      const cpt = cptCodes.find(c => c.shortName === editTestName || c.description === editTestName || c.code === editTestName);
      if (cpt) { updatedParsed.cptCode = cpt.code; updatedParsed.testDescription = cpt.description; }
    }
    
    try {
      const res = await fetch("/api/generate-hl7", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parsedData: updatedParsed,
          saveToDb: true,
          resultId: selected.id,
        }),
      });
      const data = await res.json();
      const updated = [...results];
      updated[selectedIdx] = { ...updated[selectedIdx], parsedData: updatedParsed, hl7Content: data.hl7Content };
      setResults(updated);
      setEditMode(false);
      setEditErrors({});
      showToast("HL7 regenerated successfully");
    } catch {
      showToast("Failed to regenerate", "error");
    }
  };

  const openPdfInNewTab = (base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const isUnknown = (v?: string) =>
    !v?.trim() || v.trim().toUpperCase() === "UNKNOWN" || v.trim().toUpperCase() === "UNKNOWN FACILITY";

  const validateBeforeSend = (r: HL7Result): string[] => {
    const errors: string[] = [];
    const p = r.parsedData;
    if (!p.patientFirstName?.trim()) errors.push("Patient first name is required");
    if (!p.patientLastName?.trim()) errors.push("Patient last name is required");
    if (!p.patientDOB?.trim()) errors.push("Patient date of birth is required");
    if (isUnknown(p.facilityName) && !p.facilityId?.trim()) errors.push("Sending facility is required (Unknown is not allowed)");
    else if (isUnknown(p.facilityName)) errors.push("Sending facility name is Unknown — please assign a valid facility");
    if (!p.referringPhysicianFirstName?.trim() && !p.referringPhysicianLastName?.trim()) errors.push("Physician name is required");
    if (!p.referringPhysicianNPI?.trim() || p.referringPhysicianNPI.trim().toUpperCase() === "UNKNOWN")
      errors.push("Physician NPI is required");
    if (!p.testName?.trim()) errors.push("Test / study name is required");
    if (!p.cptCode?.trim()) errors.push("CPT code is required");
    return errors;
  };

  const handleSend = async () => {
    if (selectedIdx === null || !selected || !emrType) return;
    const errors = validateBeforeSend(selected);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setSending(true);
    try {
      const res = await fetch("/api/send-hl7", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hl7Content: selected.hl7Content,
          emrType,
          fileName: `${selected.parsedData.patientLastName}_${selected.parsedData.patientFirstName}_HL7.txt`,
          parsedData: selected.parsedData,
          resultId: selected.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Mark result as failed in UI immediately — no refresh needed
        const updated = [...results];
        updated[selectedIdx] = { ...updated[selectedIdx], status: "failed" };
        setResults(updated);
        showToast(data.error || "Send failed", "error");
        return;
      }
      if (data.success) {
        // Remove from the pending/failed list — it's been delivered
        const updated = results.filter((_, i) => i !== selectedIdx);
        setResults(updated);
        setSelectedIdx(updated.length > 0 ? Math.min(selectedIdx, updated.length - 1) : null);
        showToast("Sent to EMR successfully");
      }
    } catch {
      const updated = [...results];
      updated[selectedIdx] = { ...updated[selectedIdx], status: "failed" };
      setResults(updated);
      showToast("Network error — could not reach server", "error");
    } finally {
      setSending(false);
    }
  };

  const removeResult = async (idx: number) => {
    const target = results[idx];
    if (target) {
      await fetch(`/api/results?id=${target.id}`, { method: "DELETE" });
    }
    const updated = results.filter((_, i) => i !== idx);
    setResults(updated);
    setSelectedIdx(updated.length > 0 ? Math.min(idx, updated.length - 1) : null);
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
        {loading ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: 36 }}>⏳</div>
            <h3>Loading Results...</h3>
            <p>Fetching pending results from database.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No Results Ready</h3>
            <p>Upload and parse PDFs first.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
            {/* List */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Pending Results ({results.filter(r => r.status !== "sent").length})</h3>
              {results.map((r, i) => (
                <div
                  key={r.id} className="card"
                  style={{ marginBottom: 8, cursor: "pointer", borderColor: i === selectedIdx ? "var(--accent)" : undefined, padding: 12 }}
                  onClick={() => { setSelectedIdx(i); setEditMode(false); setEditErrors({}); }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {r.parsedData.patientLastName || "?"}, {r.parsedData.patientFirstName || "?"}
                    </span>
                    <span className={`badge ${
                        r.status === "sent" ? "badge-success"
                        : r.status === "failed" ? "badge-danger"
                        : "badge-warning"}`}>{r.status}</span>
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
                    <button className="btn btn-secondary" onClick={() => openPdfInNewTab(selected.parsedData.pdfBase64)}>
                      📄 View Original PDF
                    </button>
                    {!editMode && <button className="btn btn-secondary" onClick={() => { startEdit(); setValidationErrors([]); setEditErrors({}); }}>✏️ Edit Data</button>}
                    {selected.status !== "sent" && (
                      <button className="btn btn-success" onClick={handleSend} disabled={sending}>
                        {sending ? "Sending..." : "🚀 Send to EMR"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Validation errors */}
                {validationErrors.length > 0 && (
                  <div style={{
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)",
                    borderRadius: "var(--radius-md)", padding: "12px 16px",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--danger)", marginBottom: 6 }}>
                      ⚠ Cannot send — please fix the following:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {validationErrors.map((e) => (
                        <li key={e} style={{ fontSize: 12.5, color: "#fca5a5", marginBottom: 2 }}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
                  
                  {/* Editor / Info Pane */}
                  <div>
                    {editMode ? (
                      <div className="card" style={{background: "var(--bg-secondary)"}}>
                        <h4 className="mb-4" style={{fontSize: 14, fontWeight: 600}}>Edit Parsed Data</h4>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div className="form-group w-full">
                            <label className="form-label">Patient First Name <span style={{color:"var(--danger)"}}>*</span></label>
                            <input className="form-input" style={editErrors.patientFirst ? {borderColor:"var(--danger)"} : {}} value={editPatientFirst} onChange={(e) => setEditPatientFirst(e.target.value)} />
                            {editErrors.patientFirst && <span style={{fontSize:11,color:"var(--danger)"}}>{editErrors.patientFirst}</span>}
                          </div>
                          <div className="form-group w-full">
                            <label className="form-label">Patient Last Name <span style={{color:"var(--danger)"}}>*</span></label>
                            <input className="form-input" style={editErrors.patientLast ? {borderColor:"var(--danger)"} : {}} value={editPatientLast} onChange={(e) => setEditPatientLast(e.target.value)} />
                            {editErrors.patientLast && <span style={{fontSize:11,color:"var(--danger)"}}>{editErrors.patientLast}</span>}
                          </div>
                          <div className="form-group w-full" style={{ gridColumn: "1/-1" }}>
                            <label className="form-label">Patient Gender <span style={{color:"var(--danger)"}}>*</span></label>
                            <select className="form-select" value={editPatientGender} onChange={(e) => setEditPatientGender(e.target.value)}>
                              <option value="M">Male</option>
                              <option value="F">Female</option>
                              <option value="U">Unknown</option>
                            </select>
                          </div>
                          <div className="form-group" style={{gridColumn: "1/-1"}}>
                            <label className="form-label">Select Saved Physician</label>
                            <select className="form-select" value={editPhysNPI} onChange={(e) => applyProviderSelect(e.target.value)}>
                              <option value="">Custom Entry...</option>
                              {providers.map(p => <option key={p.npi} value={p.npi}>{p.firstName} {p.lastName} ({p.npi})</option>)}
                            </select>
                          </div>
                          <div className="form-group w-full">
                            <label className="form-label">Physician First Name <span style={{color:"var(--danger)"}}>*</span></label>
                            <input className="form-input" style={editErrors.physFirst ? {borderColor:"var(--danger)"} : {}} value={editPhysFirst} onChange={(e) => setEditPhysFirst(e.target.value)} />
                            {editErrors.physFirst && <span style={{fontSize:11,color:"var(--danger)"}}>{editErrors.physFirst}</span>}
                          </div>
                          <div className="form-group w-full">
                            <label className="form-label">Physician Last Name <span style={{color:"var(--danger)"}}>*</span></label>
                            <input className="form-input" style={editErrors.physLast ? {borderColor:"var(--danger)"} : {}} value={editPhysLast} onChange={(e) => setEditPhysLast(e.target.value)} />
                            {editErrors.physLast && <span style={{fontSize:11,color:"var(--danger)"}}>{editErrors.physLast}</span>}
                          </div>
                          <div className="form-group w-full" style={{gridColumn:"1/-1"}}>
                            <label className="form-label">NPI <span style={{color:"var(--danger)"}}>*</span></label>
                            <input className="form-input" style={editErrors.npi ? {borderColor:"var(--danger)"} : {}} value={editPhysNPI} onChange={(e) => setEditPhysNPI(e.target.value)} />
                            {editErrors.npi && <span style={{fontSize:11,color:"var(--danger)"}}>{editErrors.npi}</span>}
                          </div>
                          <div className="form-group w-full" style={{gridColumn:"1/-1"}}>
                            <label className="form-label">Facility <span style={{color:"var(--danger)"}}>*</span></label>
                            <select className="form-select" style={editErrors.facility ? {borderColor:"var(--danger)"} : {}} value={editFacilityId} onChange={(e) => applyFacilitySelect(e.target.value)}>
                              <option value="">Select Facility...</option>
                              {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                            {editErrors.facility && <span style={{fontSize:11,color:"var(--danger)"}}>{editErrors.facility}</span>}
                          </div>
                          <div className="form-group" style={{gridColumn: "1/-1"}}>
                            <label className="form-label">Test / Study Name <span style={{color:"var(--danger)"}}>*</span></label>
                            <select className="form-select" style={editErrors.testName ? {borderColor:"var(--danger)"} : {}} value={editTestName} onChange={(e) => setEditTestName(e.target.value)}>
                              <option value="">Select CPT / Study...</option>
                              {cptCodes.map(c => (
                                <option key={c.code} value={c.shortName}>{c.code} — {c.shortName} ({c.description})</option>
                              ))}
                              {editTestName && !cptCodes.some(c => c.shortName === editTestName) && (
                                <option value={editTestName}>{editTestName}</option>
                              )}
                            </select>
                            {editErrors.testName && <span style={{fontSize:11,color:"var(--danger)"}}>{editErrors.testName}</span>}
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
