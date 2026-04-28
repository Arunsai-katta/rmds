"use client";

import { useState, useEffect, useCallback } from "react";
import { Provider, Facility, ProviderFacilityMapping, EMRClient } from "@/lib/types";

export default function MappingDataPage() {
  const [activeTab, setActiveTab] = useState<"providers" | "facilities" | "mappings" | "emr">("providers");
  
  const [providers, setProviders] = useState<Provider[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [mappings, setMappings] = useState<ProviderFacilityMapping[]>([]);
  const [emrClients, setEmrClients] = useState<EMRClient[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [provRes, facRes, mapRes, emrRes] = await Promise.all([
        fetch("/api/providers"), fetch("/api/facilities"), fetch("/api/mappings"), fetch("/api/emr-clients")
      ]);
      setProviders(await provRes.json());
      setFacilities(await facRes.json());
      setMappings((await mapRes.json()).mappings || []);
      setEmrClients(await emrRes.json());
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
  const [modalType, setModalType] = useState<"provider" | "facility" | "mapping" | "emr">("provider");
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  const openModal = (type: typeof modalType, item?: any) => {
    setModalType(type);
    setEditId(item?.id || null);
    setFormData(item || {});
    setModalOpen(true);
  };

  const submitModal = async () => {
    try {
      if (modalType === "provider") await handleSave("/api/providers", formData, editId || undefined);
      if (modalType === "facility") await handleSave("/api/facilities", formData, editId || undefined);
      if (modalType === "mapping") await handleSave("/api/mappings", formData, editId || undefined);
      if (modalType === "emr") await handleSave("/api/emr-clients", formData, editId || undefined);
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
          {["providers", "facilities", "mappings", "emr"].map((tab) => (
            <button
              key={tab}
              className={`btn ${activeTab === tab ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab(tab as any)}
              style={{ textTransform: "capitalize" }}
            >
              {tab === "emr" ? "EMR Clients" : tab}
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
                <thead><tr><th>Name</th><th>NPI</th><th>Credential</th><th>Practice Group</th><th>Actions</th></tr></thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</td>
                      <td><code>{p.npi}</code></td>
                      <td><span className="badge badge-info">{p.credential}</span></td>
                      <td>{p.practiceGroup}</td>
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
                <thead><tr><th>Name</th><th>Company ID</th><th>Address</th><th>Actions</th></tr></thead>
                <tbody>
                  {facilities.map((f) => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600 }}>{f.name}</td>
                      <td><code>{f.companyId}</code></td>
                      <td>{f.address} {f.city} {f.state} {f.zip}</td>
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

        {/* MAPPINGS TAB */}
        {activeTab === "mappings" && (
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontWeight: 700 }}>Provider -&gt; Facility Mappings ({mappings.length})</h3>
              <button className="btn btn-primary btn-sm" onClick={() => openModal("mapping")}>+ Add Mapping</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Provider</th><th>Facility</th><th>Actions</th></tr></thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{providers.find(p => p.id === m.providerId)?.name || m.providerId}</td>
                      <td>{facilities.find(f => f.id === m.facilityId)?.name || m.facilityId}</td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => openModal("mapping", m)} style={{ marginRight: 8 }}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete("/api/mappings", m.id)}>Delete</button>
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
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? "Edit" : "Add"} {modalType.toUpperCase()}</h3>

            {modalType === "provider" && (
              <>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-input" value={formData.name || ""} onChange={(e) => setFormData({...formData, name: e.target.value})} />
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
                    <label className="form-label">NPI</label>
                    <input className="form-input" value={formData.npi || ""} onChange={(e) => setFormData({...formData, npi: e.target.value})} />
                  </div>
                  <div className="form-group w-full">
                    <label className="form-label">Credential</label>
                    <input className="form-input" value={formData.credential || ""} onChange={(e) => setFormData({...formData, credential: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Practice Group</label>
                  <input 
                    className="form-input" 
                    list="practice-groups" 
                    value={formData.practiceGroup || ""} 
                    onChange={(e) => setFormData({...formData, practiceGroup: e.target.value})} 
                    placeholder="Select or type new group..."
                  />
                  <datalist id="practice-groups">
                    {Array.from(new Set(providers.map(p => p.practiceGroup).filter(Boolean))).map(group => (
                      <option key={group} value={group} />
                    ))}
                  </datalist>
                </div>
              </>
            )}

            {modalType === "facility" && (
              <>
                <div className="form-group">
                  <label className="form-label">Facility Name</label>
                  <input className="form-input" value={formData.name || ""} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Company ID (HL7 MSH.6)</label>
                  <input className="form-input" value={formData.companyId || ""} onChange={(e) => setFormData({...formData, companyId: e.target.value})} />
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
              </>
            )}

            {modalType === "mapping" && (
              <>
                <div className="form-group">
                  <label className="form-label">Provider</label>
                  <select className="form-select" value={formData.providerId || ""} onChange={(e) => setFormData({...formData, providerId: e.target.value})}>
                    <option value="">Select...</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.npi})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Facility</label>
                  <select className="form-select" value={formData.facilityId || ""} onChange={(e) => setFormData({...formData, facilityId: e.target.value})}>
                    <option value="">Select...</option>
                    {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </>
            )}

            {modalType === "emr" && (
              <>
                <div className="form-group">
                  <label className="form-label">EMR Name</label>
                  <input className="form-input" value={formData.name || ""} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Connection Type</label>
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
                        <label className="form-label">Host</label>
                        <input className="form-input" value={formData.sftpHost || ""} onChange={(e) => setFormData({...formData, sftpHost: e.target.value})} />
                      </div>
                      <div className="form-group" style={{ width: 100 }}>
                        <label className="form-label">Port</label>
                        <input className="form-input" value={formData.sftpPort || "22"} onChange={(e) => setFormData({...formData, sftpPort: e.target.value})} />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="form-group w-full">
                        <label className="form-label">Username</label>
                        <input className="form-input" value={formData.sftpUser || ""} onChange={(e) => setFormData({...formData, sftpUser: e.target.value})} />
                      </div>
                      <div className="form-group w-full">
                        <label className="form-label">Password / Key</label>
                        <input className="form-input" type="password" value={formData.sftpPass || ""} onChange={(e) => setFormData({...formData, sftpPass: e.target.value})} />
                      </div>
                    </div>
                    <div className="form-group mt-2">
                      <label className="form-label">Upload Folder (Path)</label>
                      <input className="form-input" value={formData.sftpFolder || ""} placeholder="/upload/results" onChange={(e) => setFormData({...formData, sftpFolder: e.target.value})} />
                    </div>
                  </div>
                ) : (
                  <div className="card mt-4" style={{ padding: 16 }}>
                    <h4 style={{ marginBottom: 12, fontSize: 13, fontWeight: 600 }}>API Configuration</h4>
                    <div className="form-group">
                      <label className="form-label">Endpoint URL</label>
                      <input className="form-input" value={formData.apiUrl || ""} placeholder="https://api.emr.com/v1/results" onChange={(e) => setFormData({...formData, apiUrl: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Auth Token</label>
                      <input className="form-input" value={formData.authToken || ""} onChange={(e) => setFormData({...formData, authToken: e.target.value})} />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitModal}>Save Data</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast-container"><div className={`toast toast-${toast.type}`}>{toast.msg}</div></div>}
    </>
  );
}
