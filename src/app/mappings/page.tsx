"use client";

import { useState, useEffect, useCallback } from "react";
import { Provider, Facility, EMRClient, CPTMapping } from "@/lib/types";

export default function MappingDataPage() {
  const [activeTab, setActiveTab] = useState<"providers" | "facilities" | "emr" | "cpt">("providers");
  
  const [providers, setProviders] = useState<Provider[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [emrClients, setEmrClients] = useState<EMRClient[]>([]);
  const [cptCodes, setCptCodes] = useState<CPTMapping[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [provRes, facRes, emrRes, cptRes] = await Promise.all([
        fetch("/api/providers"), fetch("/api/facilities"), fetch("/api/emr-clients"), fetch("/api/cpt-codes")
      ]);
      setProviders(await provRes.json());
      setFacilities(await facRes.json());
      setEmrClients(await emrRes.json());
      setCptCodes(await cptRes.json());
    } catch {
      showToast("Failed to load data", "error");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // General CRUD helpers
  const handleSave = async (endpoint: string, data: any, id?: string) => {
    const method = id ? "PUT" : "POST";
    const body = id ? { id, ...data } : data;
    const res = await fetch(endpoint, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("Save failed");
    showToast("Saved successfully");
    fetchData();
  };

  const handleDelete = async (endpoint: string, id: string) => {
    if (!confirm("Are you sure you want to delete this?")) return;
    await fetch(`${endpoint}?id=${id}`, { method: "DELETE" });
    showToast("Deleted successfully");
    fetchData();
  };

  // --- Modal States ---
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"provider" | "facility" | "emr" | "cpt">("provider");
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const openModal = (type: typeof modalType, item?: any) => {
    setModalType(type);
    setEditId(item?.id || null);
    setFormData(item || {});
    setFormErrors({});
    setModalOpen(true);
  };

  const req = (label: string) => <> <span style={{ color: "var(--danger)" }}>*</span></>;  // required marker helper

  const validateModal = (): boolean => {
    const errs: Record<string, string> = {};
    const f = formData;
    const r = (v?: string) => !v?.trim();
    if (modalType === "provider") {
      if (r(f.firstName) && r(f.lastName) && r(f.name)) errs.name = "Full name or first/last name is required";
      if (r(f.npi)) errs.npi = "NPI is required";
      if (!f.facilityId) errs.facilityId = "Facility is required";
    }
    if (modalType === "facility") {
      if (r(f.name)) errs.name = "Facility name is required";
      if (r(f.companyId)) errs.companyId = "Company ID is required";
      if (!f.emrClientId) errs.emrClientId = "EMR Client is required";
    }
    if (modalType === "emr") {
      if (r(f.name)) errs.name = "EMR name is required";
      if (f.connectionType === "sftp" || !f.connectionType || f.connectionType === "api") {
        if (f.connectionType === "sftp") {
          if (r(f.sftpHost)) errs.sftpHost = "Host is required";
          if (r(f.sftpPort)) errs.sftpPort = "Port is required";
          if (r(f.sftpUser)) errs.sftpUser = "Username is required";
          if (r(f.sftpPass)) errs.sftpPass = "Password / Key is required";
          if (r(f.sftpFolder)) errs.sftpFolder = "Upload folder is required";
        } else {
          if (r(f.apiUrl)) errs.apiUrl = "Endpoint URL is required";
          if (r(f.authToken)) errs.authToken = "Auth token is required";
        }
      }
    }
    if (modalType === "cpt") {
      if (r(f.code)) errs.code = "CPT code is required";
      if (r(f.shortName)) errs.shortName = "Short name is required";
      if (r(f.description)) errs.description = "Description is required";
      const kw = Array.isArray(f.keywords) ? f.keywords.join(",") : f.keywords || "";
      if (!kw.trim()) errs.keywords = "At least one keyword is required";
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitModal = async () => {
    if (!validateModal()) return;
    try {
      if (modalType === "provider") await handleSave("/api/providers", formData, editId || undefined);
      if (modalType === "facility") await handleSave("/api/facilities", formData, editId || undefined);
      if (modalType === "emr") await handleSave("/api/emr-clients", formData, editId || undefined);
      if (modalType === "cpt") {
        // CPT codes use `code` as key, not `id`
        const method = editId ? "PUT" : "POST";
        const res = await fetch("/api/cpt-codes", {
          method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error("Save failed");
        showToast("Saved successfully");
        fetchData();
      }
      setModalOpen(false);
    } catch {
      showToast("Error saving", "error");
    }
  };

  if (loading) return <div className="page-body empty-state"><div className="loading-spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h2>Mapping & Configuration Data</h2>
        <p>Manage Providers, Facilities, Mappings, and EMR Integrations</p>
      </div>

      <div className="page-body">
        {/* Tabs */}
        <div className="flex gap-2 mb-6" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: 16 }}>
          {["providers", "facilities", "emr", "cpt"].map((tab) => (
            <button
              key={tab}
              className={`btn ${activeTab === tab ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab(tab as any)}
              style={{ textTransform: "capitalize" }}
            >
              {tab === "emr" ? "EMR Clients" : tab === "cpt" ? "CPT Codes" : tab}
            </button>
          ))}
        </div>

        {/* PROVIDERS TAB */}
        {activeTab === "providers" && (
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontWeight: 700 }}>Physicians / Providers ({providers.length})</h3>
              <button className="btn btn-primary btn-sm" onClick={() => openModal("provider")}>+ Add Provider</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>NPI</th><th>Credential</th><th>Facility</th><th>Actions</th></tr></thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</td>
                      <td><code>{p.npi}</code></td>
                      <td><span className="badge badge-info">{p.credential}</span></td>
                      <td>{facilities.find(f => f.id === p.facilityId)?.name || p.practiceGroup || '-'}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openModal("provider", p)} style={{ marginRight: 8 }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete("/api/providers", p.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FACILITIES TAB */}
        {activeTab === "facilities" && (
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontWeight: 700 }}>Facilities / Hospitals ({facilities.length})</h3>
              <button className="btn btn-primary btn-sm" onClick={() => openModal("facility")}>+ Add Facility</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Company ID</th><th>Address</th><th>EMR Client</th><th>Actions</th></tr></thead>
                <tbody>
                  {facilities.map((f) => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600 }}>{f.name}</td>
                      <td><code>{f.companyId}</code></td>
                      <td>{f.address} {f.city} {f.state} {f.zip}</td>
                      <td>{emrClients.find(e => e.id === f.emrClientId)?.name || '-'}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openModal("facility", f)} style={{ marginRight: 8 }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete("/api/facilities", f.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EMR TAB */}
        {activeTab === "emr" && (
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontWeight: 700 }}>EMR Clients ({emrClients.length})</h3>
              <button className="btn btn-primary btn-sm" onClick={() => openModal("emr")}>+ Add EMR Client</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Connection Type</th><th>Details</th><th>Actions</th></tr></thead>
                <tbody>
                  {emrClients.map((e) => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600 }}>{e.name}</td>
                      <td><span className="badge badge-accent">{e.connectionType?.toUpperCase() || "API"}</span></td>
                      <td>
                        {e.connectionType === "sftp" ? (
                          <span className="text-xs text-muted">{e.sftpUser}@{e.sftpHost}:{e.sftpPort}</span>
                        ) : (
                          <span className="text-xs text-muted">Auth Token: {e.authToken ? "********" : "None"}</span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openModal("emr", e)} style={{ marginRight: 8 }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete("/api/emr-clients", e.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CPT CODES TAB */}
        {activeTab === "cpt" && (
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontWeight: 700 }}>CPT Codes ({cptCodes.length})</h3>
              <button className="btn btn-primary btn-sm" onClick={() => openModal("cpt")}>+ Add CPT Code</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Code</th><th>Short Name</th><th>Description</th><th>Keywords</th><th>Actions</th></tr></thead>
                <tbody>
                  {cptCodes.map((c) => (
                    <tr key={c.code}>
                      <td><code>{c.code}</code></td>
                      <td style={{ fontWeight: 600 }}>{c.shortName}</td>
                      <td>{c.description}</td>
                      <td><span className="text-xs text-muted">{c.keywords?.join(", ")}</span></td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openModal("cpt", { ...c, id: c.code })} style={{ marginRight: 8 }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={async () => {
                          if (!confirm("Delete this CPT code?")) return;
                          await fetch(`/api/cpt-codes?code=${c.code}`, { method: "DELETE" });
                          showToast("Deleted successfully");
                          fetchData();
                        }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? "Edit" : "Add"} {modalType === "cpt" ? "CPT CODE" : modalType.toUpperCase()}</h3>

            {modalType === "provider" && (
              <>
                <div className="form-group">
                  <label className="form-label">Full Name </label>
                  <input className="form-input" style={formErrors.name ? {borderColor:"var(--danger)"} : {}} value={formData.name || ""} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  {formErrors.name && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.name}</span>}
                </div>
                <div className="flex gap-4">
                  <div className="form-group w-full">
                    <label className="form-label">First Name</label>
                    <input className="form-input" value={formData.firstName || ""} onChange={(e) => setFormData({...formData, firstName: e.target.value})} />
                  </div>
                  <div className="form-group w-full">
                    <label className="form-label">Last Name</label>
                    <input className="form-input" value={formData.lastName || ""} onChange={(e) => setFormData({...formData, lastName: e.target.value})} />
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="form-group w-full">
                    <label className="form-label">NPI <span style={{color:"var(--danger)"}}>*</span></label>
                    <input className="form-input" style={formErrors.npi ? {borderColor:"var(--danger)"} : {}} value={formData.npi || ""} onChange={(e) => setFormData({...formData, npi: e.target.value})} />
                    {formErrors.npi && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.npi}</span>}
                  </div>
                  <div className="form-group w-full">
                    <label className="form-label">Credential</label>
                    <input className="form-input" value={formData.credential || ""} onChange={(e) => setFormData({...formData, credential: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Facility <span style={{color:"var(--danger)"}}>*</span></label>
                  <select className="form-select" style={formErrors.facilityId ? {borderColor:"var(--danger)"} : {}} value={formData.facilityId || ""} onChange={(e) => setFormData({...formData, facilityId: e.target.value})}>
                    <option value="">Select facility...</option>
                    {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  {formErrors.facilityId && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.facilityId}</span>}
                </div>
              </>
            )}

            {modalType === "facility" && (
              <>
                <div className="form-group">
                  <label className="form-label">Facility Name <span style={{color:"var(--danger)"}}>*</span></label>
                  <input className="form-input" style={formErrors.name ? {borderColor:"var(--danger)"} : {}} value={formData.name || ""} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  {formErrors.name && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.name}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Company ID (HL7 MSH.6) <span style={{color:"var(--danger)"}}>*</span></label>
                  <input className="form-input" style={formErrors.companyId ? {borderColor:"var(--danger)"} : {}} value={formData.companyId || ""} onChange={(e) => setFormData({...formData, companyId: e.target.value})} />
                  {formErrors.companyId && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.companyId}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input className="form-input" value={formData.address || ""} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                </div>
                <div className="flex gap-4">
                  <div className="form-group w-full">
                    <label className="form-label">City</label>
                    <input className="form-input" value={formData.city || ""} onChange={(e) => setFormData({...formData, city: e.target.value})} />
                  </div>
                  <div className="form-group w-full">
                    <label className="form-label">State</label>
                    <input className="form-input" value={formData.state || ""} onChange={(e) => setFormData({...formData, state: e.target.value})} />
                  </div>
                  <div className="form-group w-full">
                    <label className="form-label">Zip</label>
                    <input className="form-input" value={formData.zip || ""} onChange={(e) => setFormData({...formData, zip: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">EMR Client <span style={{color:"var(--danger)"}}>*</span></label>
                  <select className="form-select" style={formErrors.emrClientId ? {borderColor:"var(--danger)"} : {}} value={formData.emrClientId || ""} onChange={(e) => setFormData({...formData, emrClientId: e.target.value})}>
                    <option value="">Select EMR...</option>
                    {emrClients.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  {formErrors.emrClientId && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.emrClientId}</span>}
                </div>
              </>
            )}

            {modalType === "emr" && (
              <>
                <div className="form-group">
                  <label className="form-label">EMR Name <span style={{color:"var(--danger)"}}>*</span></label>
                  <input className="form-input" style={formErrors.name ? {borderColor:"var(--danger)"} : {}} value={formData.name || ""} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  {formErrors.name && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.name}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Connection Type <span style={{color:"var(--danger)"}}>*</span></label>
                  <select className="form-select" value={formData.connectionType || "api"} onChange={(e) => setFormData({...formData, connectionType: e.target.value})}>
                    <option value="api">API</option>
                    <option value="sftp">SFTP</option>
                  </select>
                </div>

                {formData.connectionType === "sftp" ? (
                  <div className="card mt-4" style={{ padding: 16 }}>
                    <h4 style={{ marginBottom: 12, fontSize: 13, fontWeight: 600 }}>SFTP Configuration</h4>
                    <div className="flex gap-4">
                      <div className="form-group w-full">
                        <label className="form-label">Host <span style={{color:"var(--danger)"}}>*</span></label>
                        <input className="form-input" style={formErrors.sftpHost ? {borderColor:"var(--danger)"} : {}} value={formData.sftpHost || ""} onChange={(e) => setFormData({...formData, sftpHost: e.target.value})} />
                        {formErrors.sftpHost && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.sftpHost}</span>}
                      </div>
                      <div className="form-group" style={{ width: 100 }}>
                        <label className="form-label">Port <span style={{color:"var(--danger)"}}>*</span></label>
                        <input className="form-input" style={formErrors.sftpPort ? {borderColor:"var(--danger)"} : {}} value={formData.sftpPort || "22"} onChange={(e) => setFormData({...formData, sftpPort: e.target.value})} />
                        {formErrors.sftpPort && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.sftpPort}</span>}
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="form-group w-full">
                        <label className="form-label">Username <span style={{color:"var(--danger)"}}>*</span></label>
                        <input className="form-input" style={formErrors.sftpUser ? {borderColor:"var(--danger)"} : {}} value={formData.sftpUser || ""} onChange={(e) => setFormData({...formData, sftpUser: e.target.value})} />
                        {formErrors.sftpUser && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.sftpUser}</span>}
                      </div>
                      <div className="form-group w-full">
                        <label className="form-label">Password / Key <span style={{color:"var(--danger)"}}>*</span></label>
                        <input className="form-input" type="password" style={formErrors.sftpPass ? {borderColor:"var(--danger)"} : {}} value={formData.sftpPass || ""} onChange={(e) => setFormData({...formData, sftpPass: e.target.value})} />
                        {formErrors.sftpPass && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.sftpPass}</span>}
                      </div>
                    </div>
                    <div className="form-group mt-2">
                      <label className="form-label">Upload Folder (Path) <span style={{color:"var(--danger)"}}>*</span></label>
                      <input className="form-input" style={formErrors.sftpFolder ? {borderColor:"var(--danger)"} : {}} value={formData.sftpFolder || ""} placeholder="/upload/results" onChange={(e) => setFormData({...formData, sftpFolder: e.target.value})} />
                      {formErrors.sftpFolder && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.sftpFolder}</span>}
                    </div>
                  </div>
                ) : (
                  <div className="card mt-4" style={{ padding: 16 }}>
                    <h4 style={{ marginBottom: 12, fontSize: 13, fontWeight: 600 }}>API Configuration</h4>
                    <div className="form-group">
                      <label className="form-label">Endpoint URL <span style={{color:"var(--danger)"}}>*</span></label>
                      <input className="form-input" style={formErrors.apiUrl ? {borderColor:"var(--danger)"} : {}} value={formData.apiUrl || ""} placeholder="https://api.emr.com/v1/results" onChange={(e) => setFormData({...formData, apiUrl: e.target.value})} />
                      {formErrors.apiUrl && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.apiUrl}</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Auth Token <span style={{color:"var(--danger)"}}>*</span></label>
                      <input className="form-input" style={formErrors.authToken ? {borderColor:"var(--danger)"} : {}} value={formData.authToken || ""} onChange={(e) => setFormData({...formData, authToken: e.target.value})} />
                      {formErrors.authToken && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.authToken}</span>}
                    </div>
                  </div>
                )}
              </>
            )}

            {modalType === "cpt" && (
              <>
                <div className="flex gap-4">
                  <div className="form-group" style={{ width: 140 }}>
                    <label className="form-label">CPT Code <span style={{color:"var(--danger)"}}>*</span></label>
                    <input className="form-input" style={formErrors.code ? {borderColor:"var(--danger)"} : {}} value={formData.code || ""} disabled={!!editId} onChange={(e) => setFormData({...formData, code: e.target.value})} placeholder="e.g. 71046" />
                    {formErrors.code && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.code}</span>}
                  </div>
                  <div className="form-group w-full">
                    <label className="form-label">Short Name <span style={{color:"var(--danger)"}}>*</span></label>
                    <input className="form-input" style={formErrors.shortName ? {borderColor:"var(--danger)"} : {}} value={formData.shortName || ""} onChange={(e) => setFormData({...formData, shortName: e.target.value})} placeholder="e.g. CHEST X-RAY" />
                    {formErrors.shortName && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.shortName}</span>}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description <span style={{color:"var(--danger)"}}>*</span></label>
                  <input className="form-input" style={formErrors.description ? {borderColor:"var(--danger)"} : {}} value={formData.description || ""} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="e.g. Chest X-Ray 2 Views" />
                  {formErrors.description && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.description}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Keywords <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(comma-separated)</span> <span style={{color:"var(--danger)"}}>*</span></label>
                  <input
                    className="form-input"
                    style={formErrors.keywords ? {borderColor:"var(--danger)"} : {}}
                    value={Array.isArray(formData.keywords) ? formData.keywords.join(", ") : formData.keywords || ""}
                    onChange={(e) => setFormData({...formData, keywords: e.target.value})}
                    placeholder="e.g. chest, x-ray, xray"
                  />
                  {formErrors.keywords && <span style={{fontSize:11,color:"var(--danger)"}}>{formErrors.keywords}</span>}
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setModalOpen(false); setFormErrors({}); }}>Cancel</button>
              <button className="btn btn-primary" onClick={submitModal}>Save Data</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast-container"><div className={`toast toast-${toast.type}`}>{toast.msg}</div></div>}
    </>
  );
}
