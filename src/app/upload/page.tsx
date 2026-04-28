"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ParsedPDFResult } from "@/lib/types";

export default function UploadPage() {
  const [files, setFiles] = useState<{ file: File; status: "pending" | "uploading" | "done" | "error" }[]>([]);
  const [results, setResults] = useState<ParsedPDFResult[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const pdfs = Array.from(newFiles)
      .filter((f) => f.type === "application/pdf")
      .map(file => ({ file, status: "pending" as const }));
    if (pdfs.length === 0) { showToast("Please select PDF files only", "error"); return; }
    setFiles((prev) => [...prev, ...pdfs]);
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleParseAll = async () => {
    const pending = files.filter(f => f.status === "pending" || f.status === "error");
    if (pending.length === 0) return;

    const newResults: ParsedPDFResult[] = [];

    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== "pending" && files[i].status !== "error") continue;
      
      // Update status to uploading
      setFiles(prev => {
        const next = [...prev];
        next[i].status = "uploading";
        return next;
      });

      try {
        const formData = new FormData();
        formData.append("files", files[i].file);
        const res = await fetch("/api/parse-pdf", { method: "POST", body: formData });
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
          const newRes = data.results[0];
          newResults.push(newRes);
          setFiles(prev => {
            const next = [...prev];
            next[i].status = "done";
            return next;
          });

          // Automatically save to sessionStorage
          const existing = sessionStorage.getItem("parsedResults");
          let allResults = existing ? JSON.parse(existing) : [];
          allResults.push(newRes);
          sessionStorage.setItem("parsedResults", JSON.stringify(allResults));
        } else {
          throw new Error("Parse failed");
        }
      } catch (e) {
        setFiles(prev => {
          const next = [...prev];
          next[i].status = "error";
          return next;
        });
      }
    }

    if (newResults.length > 0) {
      setResults(prev => [...prev, ...newResults]);
      // Remove successfully processed files from UI
      setFiles(prev => prev.filter(f => f.status !== "done"));
      showToast(`Parsed ${newResults.length} file(s) successfully`);
    }
  };

  const saveAndContinue = () => {
    // Already saved to session storage during parse
    showToast("Navigating to review...");
    router.push("/results");
  };

  return (
    <>
      <div className="page-header">
        <h2>Upload PDF Reports</h2>
        <p>Upload diagnostic result PDFs to parse and generate HL7 messages</p>
      </div>
      <div className="page-body">
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
          <div className="dropzone-sub">Upload single or multiple PDF reports</div>
          <input ref={inputRef} type="file" accept=".pdf" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
        </div>

        {/* File Queue */}
        {files.length > 0 && (
          <div className="card mt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>File Queue ({files.length})</h3>
              <div className="flex gap-2">
                <button className="btn btn-danger btn-sm" onClick={() => setFiles([])}>Clear</button>
                <button className="btn btn-primary" onClick={handleParseAll}>Process Files</button>
              </div>
            </div>
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: "1px solid var(--border-color)" }}>
                <span className="text-sm flex items-center gap-2">
                  📄 {f.file.name} 
                  {f.status === "uploading" && <span className="loading-spinner" style={{width: 14, height: 14}}/>}
                  {f.status === "error" && <span className="text-danger text-xs">(Failed)</span>}
                </span>
                {f.status !== "uploading" && (
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeFile(i)}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Parsed Ready to Save */}
        {results.length > 0 && (
          <div className="card mt-4" style={{ borderColor: "var(--success)", background: "rgba(16,185,129,0.05)" }}>
            <div className="flex justify-between items-center">
              <div>
                <h3 style={{ fontWeight: 700, color: "var(--success)" }}>{results.length} Files Ready</h3>
                <p className="text-sm text-muted">Files have been parsed successfully.</p>
              </div>
              <button className="btn btn-success" onClick={saveAndContinue}>Go to Send Results 🚀</button>
            </div>
          </div>
        )}
      </div>
      {toast && <div className="toast-container"><div className={`toast toast-${toast.type}`}>{toast.msg}</div></div>}
    </>
  );
}
