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

    // Collect all JSON files for inspection
    const jsonEntries = [];
    zip.forEach((path, entry) => {
      if (!entry.dir && path.toLowerCase().endsWith(".json")) {
        jsonEntries.push({ path, entry });
      }
    });

    if (jsonEntries.length === 0) {
      throw new Error("No JSON files found inside the ZIP. Make sure you downloaded the Instagram data export.");
    }

    // Pass 1: prefer files named saved_posts*.json
    const savedPostsFiles = jsonEntries.filter(({ path }) =>
      path.toLowerCase().includes("saved_posts")
    );

    // Pass 2: if nothing named saved_posts, try all JSON files
    const filesToTry = savedPostsFiles.length > 0 ? savedPostsFiles : jsonEntries;

    const allSaves = [];
    const seenShortcodes = new Set();

    for (const { path, entry } of filesToTry) {
      try {
        const text = await entry.async("string");
        const parsed = JSON.parse(text);
        const saves = tryParseFormat(parsed, text);
        for (const s of saves) {
          if (!seenShortcodes.has(s.shortcode)) {
            seenShortcodes.add(s.shortcode);
            allSaves.push(s);
          }
        }
      } catch { /* skip unparseable files */ }
    }

    if (allSaves.length > 0) return allSaves;

    // Pass 3: brute-force regex across every JSON file in the ZIP
    for (const { entry } of jsonEntries) {
      try {
        const text = await entry.async("string");
        const saves = extractUrlsByRegex(text);
        for (const s of saves) {
          if (!seenShortcodes.has(s.shortcode)) {
            seenShortcodes.add(s.shortcode);
            allSaves.push(s);
          }
        }
      } catch { /* skip */ }
    }

    if (allSaves.length > 0) return allSaves;

    throw new Error(
      "Could not find any saved Instagram posts in this ZIP.\n\nMake sure you requested 'Saved posts' data in JSON format from Instagram. Try re-requesting the export and selecting only 'Saved posts and collections'."
    );

  } else if (name.endsWith(".json")) {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const saves = tryParseFormat(parsed, text);
      if (saves.length) return saves;
    } catch { /* fallthrough */ }
    const saves = extractUrlsByRegex(await file.text());
    if (saves.length) return saves;
    throw new Error("No Instagram saved post URLs found in this JSON file.");
  }

  throw new Error("Please upload the .zip file from Instagram, or a saved_posts.json file directly.");
}

// ── Fix Instagram's broken UTF-8 encoding in JSON exports ─────────────────
function fixEncoding(str) {
  if (!str) return str;
  try {
    // Instagram exports UTF-8 bytes as individual characters in a string
    const bytes = new Uint8Array(str.split("").map((c) => c.charCodeAt(0)));
    return new TextDecoder("utf-8").decode(bytes);
  } catch (e) {
    return str;
  }
}

// ── Try every known Instagram JSON export structure ────────────────────────
function tryParseFormat(raw, rawText) {
  const saves = [];
  const seen = new Set();

  const add = (shortcode, timestamp, title) => {
    if (!shortcode || seen.has(shortcode)) return;
    seen.add(shortcode);
    saves.push({
      shortcode,
      permalink: `https://www.instagram.com/p/${shortcode}/`,
      timestamp: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
      title: fixEncoding(title) || null,
    });
  };

  // Format A: { saved_saved_media: [{ string_map_data: { "Saved on": { href, timestamp } } }] }
  const itemsA = raw?.saved_saved_media || raw?.saves_media || [];
  for (const entry of itemsA) {
    const savedOn = entry?.string_map_data?.["Saved on"] || entry?.string_map_data?.["Saved On"];
    const href = savedOn?.href || entry?.href || null;
    const ts = savedOn?.timestamp || entry?.timestamp || null;
    if (href) {
      const m = href.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/);
      if (m) add(m[1], ts, entry?.title);
    }
  }
  if (saves.length) return saves;

  // Format B: array of { href, timestamp } directly
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const href = entry?.href || entry?.link || entry?.url || null;
      const ts = entry?.timestamp || entry?.saved_at || null;
      if (href) {
        const m = href.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/);
        if (m) add(m[1], ts, entry?.title || entry?.caption);
      }
      // Also check nested string_map_data
      const keys = entry?.string_map_data ? Object.values(entry.string_map_data) : [];
      for (const v of keys) {
        if (v?.href) {
          const m = v.href.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/);
          if (m) add(m[1], v.timestamp || ts, entry?.title);
        }
      }
    }
  }
  if (saves.length) return saves;

  // Format C: { media: [{ uri, creation_timestamp }] } (Facebook-style)
  const mediaItems = raw?.media || raw?.items || [];
  for (const item of mediaItems) {
    if (item?.uri) {
      const m = item.uri.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
      if (m) add(m[1], item.creation_timestamp || item.timestamp, item?.title);
    }
  }
  if (saves.length) return saves;

  // Format D: 2025-2026 export — array of { timestamp, label_values: [{ label, href, value }] }
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const ts = entry?.timestamp || null;
      const labelValues = entry?.label_values || [];
      let href = null;
      let caption = null;
      for (const lv of labelValues) {
        const label = (lv?.label || "").toLowerCase();
        if ((label === "url" || label === "link") && lv?.href) href = lv.href;
        if (label === "caption" && lv?.value) caption = lv.value;
      }
      if (!href) {
        // fallback: any href in label_values
        for (const lv of labelValues) {
          if (lv?.href && lv.href.includes("instagram.com")) { href = lv.href; break; }
        }
      }
      if (href) {
        const m = href.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
        if (m) add(m[1], ts, caption || entry?.title);
      }
    }
  }

  return saves;
}

// ── Last resort: regex sweep across raw text ───────────────────────────────
function extractUrlsByRegex(text) {
  const urlPattern = /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/g;
  const tsPattern = /"timestamp"\s*:\s*(\d+)/g;

  const shortcodes = [];
  const timestamps = [];
  let m;

  while ((m = urlPattern.exec(text)) !== null) {
    shortcodes.push(m[1]);
  }
  while ((m = tsPattern.exec(text)) !== null) {
    timestamps.push(parseInt(m[1], 10));
  }

  // Deduplicate shortcodes preserving order
  const seen = new Set();
  return shortcodes
    .filter((sc) => { if (seen.has(sc)) return false; seen.add(sc); return true; })
    .map((shortcode, i) => ({
      shortcode,
      permalink: `https://www.instagram.com/p/${shortcode}/`,
      timestamp: timestamps[i] ? new Date(timestamps[i] * 1000).toISOString() : new Date().toISOString(),
      title: null,
    }));
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

      const saves = await extractSavedPosts(file);

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
