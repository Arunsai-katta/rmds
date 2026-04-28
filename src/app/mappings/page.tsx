"use client";

import { useState, useEffect, useCallback } from "react";
import { providers } from "@/data/providers";
import { facilities } from "@/data/facilities";
import { ProviderFacilityMapping } from "@/lib/types";

export default function MappingsPage() {
  const [mappings, setMappings] = useState<ProviderFacilityMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formProvider, setFormProvider] = useState("");
  const [formFacility, setFormFacility] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const fetchMappings = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/mappings");
    const data = await res.json();
    setMappings(data.mappings || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMappings(); }, [fetchMappings]);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openAdd = () => { setEditId(null); setFormProvider(""); setFormFacility(""); setShowModal(true); };
  const openEdit = (m: ProviderFacilityMapping) => {
    setEditId(m.id); setFormProvider(m.providerId); setFormFacility(m.facilityId); setShowModal(true);
  };

  const handleSave = async () => {
    if (!formProvider || !formFacility) return;
    if (editId) {
      await fetch("/api/mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, providerId: formProvider, facilityId: formFacility }),
      });
      showToast("Mapping updated");
    } else {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: formProvider, facilityId: formFacility }),
      });
      if (res.status === 409) { showToast("Mapping already exists", "error"); return; }
      showToast("Mapping added");
    }
    setShowModal(false);
    fetchMappings();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/mappings?id=${id}`, { method: "DELETE" });
    showToast("Mapping removed");
    fetchMappings();
  };

  const getProviderName = (id: string) => providers.find((p) => p.id === id)?.name || id;
  const getFacilityName = (id: string) => facilities.find((f) => f.id === id)?.name || id;

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Provider–Facility Mappings</h2>
            <p>Manage which physicians are mapped to which facilities</p>
          </div>
          <button className="btn btn-primary" onClick={openAdd} id="add-mapping-btn">+ Add Mapping</button>
        </div>
      </div>
      <div className="page-body">
        {loading ? (
          <div className="empty-state"><div className="loading-spinner" /></div>
        ) : mappings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔗</div>
            <h3>No Mappings Yet</h3>
            <p>Add your first provider-facility mapping</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Provider</th><th>Facility</th><th>Actions</th></tr></thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{getProviderName(m.providerId)}</td>
                    <td>{getFacilityName(m.facilityId)}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(m)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? "Edit Mapping" : "Add Mapping"}</h3>
            <div className="form-group">
              <label className="form-label">Provider</label>
              <select className="form-select" value={formProvider} onChange={(e) => setFormProvider(e.target.value)} id="select-provider">
                <option value="">Select provider...</option>
                {providers.map((p) => (<option key={p.id} value={p.id}>{p.name} ({p.npi})</option>))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Facility</label>
              <select className="form-select" value={formFacility} onChange={(e) => setFormFacility(e.target.value)} id="select-facility">
                <option value="">Select facility...</option>
                {facilities.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} id="save-mapping-btn">Save</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
    </>
  );
}
