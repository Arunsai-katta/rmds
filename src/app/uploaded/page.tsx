"use client";

import { useState, useEffect, useCallback } from "react";
import { HL7Result, EMRClient } from "@/lib/types";

export default function UploadedResultsPage() {
  const [results, setResults] = useState<HL7Result[]>([]);
  const [emrClients, setEmrClients] = useState<EMRClient[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, eRes] = await Promise.all([
        fetch("/api/results?status=sent"),
        fetch("/api/emr-clients"),
      ]);
      const dbResults = await rRes.json();
      const emrs: EMRClient[] = await eRes.json();
      setEmrClients(emrs);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = results.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.parsedData.patientLastName?.toLowerCase().includes(q) ||
      r.parsedData.patientFirstName?.toLowerCase().includes(q) ||
      r.parsedData.testName?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selected = selectedIdx !== null ? paginated[selectedIdx] : null;

  const getEmrName = (emrId: string) => {
    const client = emrClients.find((c) => c.id === emrId);
    return client ? `${client.name} (${client.connectionType?.toUpperCase()})` : emrId || "—";
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString();
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

  return (
    <>
      <div className="page-header flex items-center justify-between">
        <div>
          <h2>Uploaded Results</h2>
          <p>All results successfully sent to EMR</p>
        </div>
        <div className="flex gap-3 items-center">
          <input
            className="form-input"
            placeholder="Search patient or test..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedIdx(null); setPage(1); }}
            style={{ width: 240 }}
          />
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <h3>Loading...</h3>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <h3>No Sent Results Found</h3>
            <p>{search ? "No matches for your search." : "Results sent to EMR will appear here."}</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
            {/* List */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                Sent Results ({filtered.length})
              </h3>
              {paginated.map((r, i) => (
                <div
                  key={r.id}
                  className="card"
                  style={{
                    marginBottom: 8,
                    cursor: "pointer",
                    borderColor: i === selectedIdx ? "var(--success)" : undefined,
                    padding: 12,
                  }}
                  onClick={() => setSelectedIdx(i)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {r.parsedData.patientLastName || "?"}, {r.parsedData.patientFirstName || "?"}
                    </span>
                    <span className="badge badge-success">sent</span>
                  </div>
                  <div className="text-muted text-xs" style={{ marginBottom: 4 }}>
                    <span className="truncate" style={{ display: "block", maxWidth: 240 }}>
                      {r.parsedData.testName || "Unknown Test"}
                    </span>
                  </div>
                  <div className="text-muted text-xs">
                    {r.sentAt ? formatDate(r.sentAt) : formatDate(r.createdAt)}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 8 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "6px 12px", fontSize: 12 }}
                    disabled={safePage === 1}
                    onClick={() => { setPage(safePage - 1); setSelectedIdx(null); }}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Page {safePage} / {totalPages}
                  </span>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "6px 12px", fontSize: 12 }}
                    disabled={safePage === totalPages}
                    onClick={() => { setPage(safePage + 1); setSelectedIdx(null); }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>

            {/* Detail */}
            {selected && (
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div className="flex items-center justify-between">
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>
                    {selected.parsedData.patientLastName || "Unknown"},{" "}
                    {selected.parsedData.patientFirstName || "Unknown"}
                  </h3>
                  <div className="flex gap-2 items-center">
                    <button
                      className="btn btn-secondary"
                      onClick={() => openPdfInNewTab(selected.parsedData.pdfBase64)}
                    >
                      📄 View Original PDF
                    </button>
                    <span className="badge badge-success" style={{ fontSize: 13, padding: "6px 14px" }}>
                      ✓ Sent
                    </span>
                  </div>
                </div>

                {/* Info grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    background: "var(--bg-secondary)",
                    borderRadius: "var(--radius-md)",
                    padding: 16,
                  }}
                >
                  {[
                    ["Patient", `${selected.parsedData.patientLastName}, ${selected.parsedData.patientFirstName}`],
                    ["Gender", selected.parsedData.patientGender || "—"],
                    ["DOB", selected.parsedData.patientDOB || "—"],
                    ["Test / Study", selected.parsedData.testName || "—"],
                    ["CPT Code", selected.parsedData.cptCode || "—"],
                    ["Exam Date", selected.parsedData.examDate || "—"],
                    ["Facility", selected.parsedData.facilityName || "—"],
                    ["Physician", `${selected.parsedData.referringPhysicianFirstName || ""} ${selected.parsedData.referringPhysicianLastName || ""}`.trim() || "—"],
                    ["NPI", selected.parsedData.referringPhysicianNPI || "—"],
                    ["Target EMR", getEmrName(selected.emrType)],
                    ["Submitted At", formatDate(selected.sentAt)],
                    ["Created At", formatDate(selected.createdAt)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* HL7 preview */}
                <div className="card" style={{ background: "var(--bg-secondary)" }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>HL7 Message</h4>
                  <div
                    className="hl7-preview"
                    style={{ height: 320, overflowY: "auto", fontSize: 12 }}
                  >
                    {selected.hl7Content
                      ? selected.hl7Content
                          .split(/\r?\n/)
                          .filter(Boolean)
                          .map((line, i) => {
                            let cls = "";
                            if (line.startsWith("MSH")) cls = "seg-msh";
                            else if (line.startsWith("PID")) cls = "seg-pid";
                            else if (line.startsWith("PV1")) cls = "seg-pv1";
                            else if (line.startsWith("OBR")) cls = "seg-obr";
                            else if (line.startsWith("OBX")) cls = "seg-obx";
                            const display =
                              line.startsWith("OBX|2|ED") && line.length > 80
                                ? line.substring(0, 70) + "... [base64 data]"
                                : line;
                            return (
                              <div key={i} className={cls}>
                                {display}
                              </div>
                            );
                          })
                      : <span style={{ color: "var(--text-muted)" }}>No HL7 content stored.</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
