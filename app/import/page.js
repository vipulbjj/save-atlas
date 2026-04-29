"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileJson, CheckCircle2, AlertCircle, Loader2, ArrowRight, ExternalLink } from "lucide-react";
import styles from "./import.module.css";

const STEPS = [
  {
    number: "01",
    title: "Request your data from Instagram",
    description: "Go to Instagram → Settings → Your activity → Download your information. Select JSON format. Request will take 24–48 hours.",
    action: { label: "Open Instagram Settings", href: "https://www.instagram.com/download/request/" },
  },
  {
    number: "02",
    title: "Download & extract the ZIP",
    description: "Instagram emails you a download link. Download the ZIP file — no need to extract it.",
  },
  {
    number: "03",
    title: "Upload it here",
    description: "Drop your ZIP below. We find saved_posts.json inside, import all your saves into your library.",
  },
];

export default function ImportPage() {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | success | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((incoming) => {
    if (!incoming) return;
    const name = incoming.name.toLowerCase();
    if (!name.endsWith(".zip") && !name.endsWith(".json")) {
      setError("Please upload a .zip or .json file from Instagram.");
      return;
    }
    setFile(incoming);
    setError(null);
    setStatus("idle");
    setResult(null);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    setProgress(0);
    setError(null);

    // Animate progress while uploading
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 8, 88));
    }, 400);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await res.json();

      if (!data.ok) {
        setStatus("error");
        setError(data.error || "Import failed. Please try again.");
      } else {
        setStatus("success");
        setResult(data);
      }
    } catch (err) {
      clearInterval(progressInterval);
      setStatus("error");
      setError("Network error. Please check your connection and try again.");
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setResult(null);
    setError(null);
    setProgress(0);
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <a href="/" className={styles.logo}>
          SaveAtlas <span className={styles.logoDot}></span>
        </a>
        <a href="/dashboard" className={styles.dashboardLink}>
          View Dashboard <ArrowRight size={16} />
        </a>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>Import your Instagram saves</h1>
          <p className={styles.subtitle}>
            Upload your official Instagram data export to sync all your saved posts — including ones saved on mobile.
          </p>
        </div>

        {/* Steps */}
        <div className={styles.steps}>
          {STEPS.map((step, i) => (
            <div key={i} className={styles.step}>
              <div className={styles.stepNumber}>{step.number}</div>
              <div className={styles.stepContent}>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                {step.action && (
                  <a href={step.action.href} target="_blank" className={styles.stepAction}>
                    {step.action.label} <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Upload Zone */}
        <div className={styles.uploadCard}>
          {status === "success" ? (
            <div className={styles.successState}>
              <CheckCircle2 size={56} className={styles.successIcon} />
              <h2>Import complete!</h2>
              <p>
                <strong>{result?.imported}</strong> saves added to your library
                {result?.total > result?.imported && ` (${result.total - result.imported} already existed)`}.
              </p>
              <div className={styles.successActions}>
                <a href="/dashboard" className={styles.primaryButton}>
                  View my library <ArrowRight size={16} />
                </a>
                <button onClick={reset} className={styles.secondaryButton}>
                  Import another file
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`${styles.dropZone} ${dragOver ? styles.dragOver : ""} ${file ? styles.hasFile : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => status === "idle" && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,.json"
                  className={styles.fileInput}
                  onChange={(e) => handleFile(e.target.files[0])}
                />

                {status === "uploading" ? (
                  <div className={styles.uploading}>
                    <Loader2 size={40} className={styles.spinner} />
                    <p>Processing your export...</p>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                    </div>
                    <span className={styles.progressLabel}>{Math.round(progress)}%</span>
                  </div>
                ) : file ? (
                  <div className={styles.fileSelected}>
                    <FileJson size={40} className={styles.fileIcon} />
                    <div>
                      <strong>{file.name}</strong>
                      <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                    <button className={styles.clearFile} onClick={(e) => { e.stopPropagation(); reset(); }}>✕</button>
                  </div>
                ) : (
                  <div className={styles.dropPrompt}>
                    <Upload size={40} className={styles.uploadIcon} />
                    <p><strong>Drop your Instagram export here</strong></p>
                    <span>or click to browse — accepts .zip or .json</span>
                  </div>
                )}
              </div>

              {error && (
                <div className={styles.errorBanner}>
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              {file && status !== "uploading" && (
                <button className={styles.importButton} onClick={handleUpload}>
                  <Upload size={18} />
                  Import {file.name}
                </button>
              )}
            </>
          )}
        </div>

        {/* Privacy note */}
        <p className={styles.privacyNote}>
          🔒 Your data is stored privately in your own database. We never share or sell your Instagram data.
        </p>
      </main>
    </div>
  );
}
