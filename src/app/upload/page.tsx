"use client";

import { useState, useRef } from "react";
import { ParsedPDFResult } from "@/lib/types";

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [results, setResults] = useState<ParsedPDFResult[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const pdfs = Array.from(newFiles).filter((f) => f.type === "application/pdf");
    if (pdfs.length === 0) { showToast("Please select PDF files only", "error"); return; }
    setFiles((prev) => [...prev, ...pdfs]);
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleParse = async () => {
    if (files.length === 0) return;
    setParsing(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const res = await fetch("/api/parse-pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
        showToast(`Parsed ${data.results.length} file(s) successfully`);
      }
    } catch {
      showToast("Failed to parse PDFs", "error");
    }
    setParsing(false);
  };

  const saveToSession = () => {
    sessionStorage.setItem("parsedResults", JSON.stringify(results));
    showToast("Results saved — go to Results & Send page");
  };

  const confPercent = (c: number) => c >= 80 ? "badge-success" : c >= 50 ? "badge-warning" : "badge-danger";

  return (
    <>
      <div className="page-header">
        <h2>Upload PDF Reports</h2>
        <p>Upload diagnostic result PDFs to parse and generate HL7 messages</p>
      </div>
      <div className="page-body">
        {/* Dropzone */}
        <div
          className={`dropzone ${dragActive ? "active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          id="pdf-dropzone"
        >
          <div className="dropzone-icon">📂</div>
          <div className="dropzone-text">Drop PDF files here or click to browse</div>
          <div className="dropzone-sub">Supports RMDS diagnostic report PDFs (X-Ray, Ultrasound, Echo, etc.)</div>
          <input ref={inputRef} type="file" accept=".pdf" multiple hidden onChange={(e) => handleFiles(e.target.files)} id="pdf-input" />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="card mt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Selected Files ({files.length})</h3>
              <div className="flex gap-2">
                <button className="btn btn-danger btn-sm" onClick={() => setFiles([])}>Clear All</button>
                <button className="btn btn-primary" onClick={handleParse} disabled={parsing} id="parse-btn">
                  {parsing ? <><span className="loading-spinner" /> Parsing...</> : "🔍 Parse PDFs"}
                </button>
              </div>
            </div>
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: "1px solid var(--border-color)" }}>
                <span className="text-sm">📄 {f.name} <span className="text-muted text-xs">({(f.size / 1024).toFixed(0)} KB)</span></span>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeFile(i)}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Parsed results */}
        {results.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Parsed Results</h3>
              <button className="btn btn-success" onClick={saveToSession} id="save-results-btn">
                💾 Save & Continue to Review
              </button>
            </div>
            <div className="card-grid card-grid-2">
              {results.map((r) => (
                <div key={r.id} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <span style={{ fontSize: 13, fontWeight: 600 }} className="truncate">{r.fileName}</span>
                    <span className={`badge ${confPercent(r.confidence)}`}>{r.confidence}% conf</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 13 }}>
                    <div><span className="text-muted text-xs">Patient</span><br /><strong>{r.patientLastName}, {r.patientFirstName}</strong></div>
                    <div><span className="text-muted text-xs">DOB</span><br />{r.patientDOB || "—"}</div>
                    <div><span className="text-muted text-xs">Ref Physician</span><br />{r.referringPhysicianName || "—"}</div>
                    <div><span className="text-muted text-xs">NPI</span><br /><code style={{ fontSize: 11 }}>{r.referringPhysicianNPI || "Not found"}</code></div>
                    <div><span className="text-muted text-xs">Facility</span><br />{r.facilityName || "—"}</div>
                    <div><span className="text-muted text-xs">Exam Date</span><br />{r.examDate || "—"}</div>
                    <div style={{ gridColumn: "1/-1" }}><span className="text-muted text-xs">Test / Study</span><br />{r.testName || "—"} {r.cptCode && <span className="badge badge-accent">{r.cptCode}</span>}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && <div className="toast-container"><div className={`toast toast-${toast.type}`}>{toast.msg}</div></div>}
    </>
  );
}
