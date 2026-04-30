"use client";

import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";
import { Upload, FileJson, CheckCircle2, AlertCircle, Loader2, ArrowRight, ExternalLink, FolderOpen } from "lucide-react";
import styles from "./import.module.css";

const STEPS = [
  {
    number: "01",
    title: "Request your data from Instagram",
    description: 'Go to Instagram → Settings → Your activity → Download your information. Choose "Some of your information", select "Saved posts", pick JSON format.',
    action: { label: "Open Instagram Settings", href: "https://www.instagram.com/download/request/" },
  },
  {
    number: "02",
    title: "Download the ZIP",
    description: "Instagram emails you a download link within 24–48 hours. Download the ZIP — no need to extract it.",
  },
  {
    number: "03",
    title: "Drop it here",
    description: "We read saved_posts.json directly inside the ZIP in your browser — nothing else is ever uploaded.",
  },
];

// ── Client-side ZIP parser ─────────────────────────────────────────────────
async function extractSavedPosts(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);

    // Search all paths for saved_posts.json (Instagram changes the folder structure)
    const candidates = [];
    zip.forEach((path, entry) => {
      if (!entry.dir && path.toLowerCase().includes("saved_posts.json")) {
        candidates.push(entry);
      }
    });

    if (candidates.length === 0) {
      throw new Error(
        `Could not find saved_posts.json inside the ZIP.\n\nMake sure you selected 'Saved posts' in JSON format when requesting your data.`
      );
    }

    const jsonText = await candidates[0].async("string");
    return JSON.parse(jsonText);

  } else if (name.endsWith(".json")) {
    const text = await file.text();
    return JSON.parse(text);
  }

  throw new Error("Please upload the .zip file from Instagram, or the saved_posts.json directly.");
}

// ── Parse Instagram's JSON format into clean saves ─────────────────────────
function parseInstagramJson(raw) {
  const items = raw?.saved_saved_media || raw?.saves || (Array.isArray(raw) ? raw : []);

  if (!items.length) {
    throw new Error(
      "No saved posts found in the file.\n\nMake sure this is saved_posts.json from an Instagram data export."
    );
  }

  const saves = [];
  for (const entry of items) {
    const savedOn = entry?.string_map_data?.["Saved on"];
    const href = savedOn?.href || entry?.href || null;
    const ts = savedOn?.timestamp || entry?.timestamp || null;
    if (!href || !href.includes("instagram.com/p/")) continue;

    const match = href.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/);
    const shortcode = match?.[1];
    if (!shortcode) continue;

    saves.push({
      shortcode,
      permalink: `https://www.instagram.com/p/${shortcode}/`,
      timestamp: ts ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
      title: entry?.title || null,
    });
  }

  if (!saves.length) {
    throw new Error("Couldn't extract any Instagram URLs. Is this the correct file?");
  }

  return saves;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | parsing | uploading | success | error
  const [statusLabel, setStatusLabel] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((incoming) => {
    if (!incoming) return;
    const n = incoming.name.toLowerCase();
    if (!n.endsWith(".zip") && !n.endsWith(".json")) {
      setError("Please upload a .zip file (Instagram export) or a saved_posts.json file.");
      return;
    }
    setFile(incoming);
    setError(null);
    setStatus("idle");
    setResult(null);
    setProgress(0);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleImport = async () => {
    if (!file) return;
    setError(null);
    setProgress(0);

    try {
      // Step 1 — Parse ZIP locally in the browser
      setStatus("parsing");
      setStatusLabel(`Reading ${file.name}…`);
      setProgress(15);

      const raw = await extractSavedPosts(file);
      const saves = parseInstagramJson(raw);

      setProgress(35);
      setStatusLabel(`Found ${saves.length} saved posts. Sending to your library…`);

      // Step 2 — Send only the small JSON array to the API (not the huge ZIP)
      setStatus("uploading");

      // Animate progress during API call
      const timer = setInterval(() => {
        setProgress((p) => Math.min(p + 3, 90));
      }, 500);

      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saves }),
      });

      clearInterval(timer);
      setProgress(100);

      const data = await res.json();

      if (!data.ok) throw new Error(data.error || "Import failed. Please try again.");

      setStatus("success");
      setResult(data);

    } catch (err) {
      setStatus("error");
      setError(err.message || "Something went wrong. Please try again.");
      setProgress(0);
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setStatusLabel("");
    setResult(null);
    setError(null);
    setProgress(0);
  };

  const isProcessing = status === "parsing" || status === "uploading";

  return (
    <div className={styles.page}>
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
            Upload your official Instagram data export. We read the file locally in your browser — the ZIP is never sent to our servers.
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

        {/* Upload Card */}
        <div className={styles.uploadCard}>
          {status === "success" ? (
            <div className={styles.successState}>
              <CheckCircle2 size={56} className={styles.successIcon} />
              <h2>Import complete!</h2>
              <p>
                <strong>{result?.imported}</strong> saves added to your library
                {result?.total > result?.imported
                  ? ` — ${result.total - result.imported} were already there.`
                  : "."}
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
                className={`${styles.dropZone} ${dragOver ? styles.dragOver : ""} ${file && !isProcessing ? styles.hasFile : ""} ${isProcessing ? styles.isProcessing : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !isProcessing && !file && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,.json"
                  className={styles.fileInput}
                  onChange={(e) => handleFile(e.target.files[0])}
                />

                {isProcessing ? (
                  <div className={styles.uploading}>
                    <Loader2 size={36} className={styles.spinner} />
                    <p>{statusLabel}</p>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                    </div>
                    <span className={styles.progressNote}>
                      {status === "parsing" ? "Parsing locally — nothing uploaded yet" : "Saving to your library…"}
                    </span>
                  </div>
                ) : file ? (
                  <div className={styles.fileSelected}>
                    <FolderOpen size={36} className={styles.fileIcon} />
                    <div>
                      <strong>{file.name}</strong>
                      <span>{(file.size / 1024 / 1024).toFixed(1)} MB · ready to import</span>
                    </div>
                    <button className={styles.clearFile} onClick={(e) => { e.stopPropagation(); reset(); }}>✕</button>
                  </div>
                ) : (
                  <div className={styles.dropPrompt}>
                    <Upload size={36} className={styles.uploadIcon} />
                    <p><strong>Drop your Instagram export ZIP here</strong></p>
                    <span>or click to browse · accepts .zip or saved_posts.json</span>
                  </div>
                )}
              </div>

              {error && (
                <div className={styles.errorBanner}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: "pre-line" }}>{error}</span>
                </div>
              )}

              {file && !isProcessing && (
                <button className={styles.importButton} onClick={handleImport}>
                  <Upload size={16} />
                  Import {file.name}
                </button>
              )}
            </>
          )}
        </div>

        <p className={styles.privacyNote}>
          🔒 The ZIP is parsed entirely in your browser. Only the list of saved post URLs is sent to your private database.
        </p>
      </main>
    </div>
  );
}
