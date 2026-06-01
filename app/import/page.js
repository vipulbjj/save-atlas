"use client";

import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";
import {
  parseSavedCollectionsFromExport,
  parseCollectionsFromText,
  mergeCollectionMaps,
  countCollectionEntries,
  isCollectionsJsonPath,
} from "@/lib/parseInstagramCollections";
import { Upload, FileJson, CheckCircle2, AlertCircle, Loader2, ArrowRight, ExternalLink, FolderOpen } from "lucide-react";
import styles from "./import.module.css";

const STEPS = [
  {
    number: "01",
    title: "Request your Instagram export",
    description:
      'Instagram app or web: Settings → Accounts Center → Your information and permissions → Download your information → "Some of your information" → check **Saved posts and collections** (both) → JSON → Create files.',
    action: { label: "Open Instagram download page", href: "https://www.instagram.com/download/request/" },
  },
  {
    number: "02",
    title: "Download the ZIP when ready",
    description:
      "Instagram emails a link (often within 24–48 hours). Download the .zip file — you do not need to unzip it on your phone or computer first.",
  },
  {
    number: "03",
    title: "Upload here — parsed on your device",
    description:
      "We extract saved_posts.json inside your browser. Only the list of post URLs and captions is sent to SaveAtlas — not your full export or Instagram password.",
  },
];

// ── Client-side ZIP parser ─────────────────────────────────────────────────
async function parseCollectionsFromZip(_zip, jsonEntries) {
  let merged = {};

  const collectionFiles = jsonEntries.filter(({ path }) => isCollectionsJsonPath(path));
  const savedPostsFiles = jsonEntries.filter(({ path }) =>
    path.toLowerCase().includes("saved_posts"),
  );

  async function parseEntry(entry, path, { allowRegexFallback = false } = {}) {
    try {
      const text = await entry.async("string");
      const parsed = JSON.parse(text);
      const hasCollectionKey =
        parsed?.saved_saved_collections
        || parsed?.saved_collections
        || parsed?.collections;

      if (hasCollectionKey || isCollectionsJsonPath(path)) {
        merged = mergeCollectionMaps(merged, parseSavedCollectionsFromExport(parsed));
      }

      if (allowRegexFallback && countCollectionEntries(merged) === 0) {
        merged = mergeCollectionMaps(merged, parseCollectionsFromText(text));
      }
    } catch { /* skip */ }
  }

  // 1) Dedicated saved_collections.json (user-named folders live here)
  for (const { path, entry } of collectionFiles) {
    await parseEntry(entry, path, { allowRegexFallback: true });
  }

  // 2) Some exports embed saved_saved_collections inside saved_posts.json
  for (const { path, entry } of savedPostsFiles) {
    await parseEntry(entry, path);
  }

  // 3) Any other JSON that declares collection keys
  if (countCollectionEntries(merged) === 0) {
    for (const { path, entry } of jsonEntries) {
      if (isCollectionsJsonPath(path) || path.toLowerCase().includes("saved_posts")) continue;
      await parseEntry(entry, path);
    }
  }

  return merged;
}

function attachCollections(saves, collectionsByShortcode) {
  if (!collectionsByShortcode || !Object.keys(collectionsByShortcode).length) return saves;
  return saves.map((s) => ({
    ...s,
    collections: collectionsByShortcode[s.shortcode] || [],
  }));
}

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

    const collectionsByShortcode = await parseCollectionsFromZip(zip, jsonEntries);

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

    if (allSaves.length > 0) return attachCollections(allSaves, collectionsByShortcode);

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

    if (allSaves.length > 0) return attachCollections(allSaves, collectionsByShortcode);

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

const IG_SHORTCODE_RE = /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/;

function shortcodeFromHref(href) {
  if (!href) return null;
  const m = href.match(IG_SHORTCODE_RE);
  return m ? m[1] : null;
}

function permalinkForShortcode(shortcode, href) {
  if (href?.includes("/reel/")) return `https://www.instagram.com/reel/${shortcode}/`;
  if (href?.includes("/tv/")) return `https://www.instagram.com/tv/${shortcode}/`;
  return `https://www.instagram.com/p/${shortcode}/`;
}

// ── Try every known Instagram JSON export structure ────────────────────────
function tryParseFormat(raw, rawText) {
  const saves = [];
  const seen = new Set();

  const add = (shortcode, timestamp, title, href) => {
    if (!shortcode || seen.has(shortcode)) return;
    seen.add(shortcode);
    saves.push({
      shortcode,
      permalink: permalinkForShortcode(shortcode, href),
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
    const shortcode = shortcodeFromHref(href);
    if (shortcode) add(shortcode, ts, entry?.title, href);
  }
  if (saves.length) return saves;

  // Format B: array of { href, timestamp } directly
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const href = entry?.href || entry?.link || entry?.url || null;
      const ts = entry?.timestamp || entry?.saved_at || null;
      const direct = shortcodeFromHref(href);
      if (direct) add(direct, ts, entry?.title || entry?.caption, href);
      // Also check nested string_map_data
      const keys = entry?.string_map_data ? Object.values(entry.string_map_data) : [];
      for (const v of keys) {
        if (v?.href) {
          const nested = shortcodeFromHref(v.href);
          if (nested) add(nested, v.timestamp || ts, entry?.title, v.href);
        }
      }
    }
  }
  if (saves.length) return saves;

  // Format C: { media: [{ uri, creation_timestamp }] } (Facebook-style)
  const mediaItems = raw?.media || raw?.items || [];
  for (const item of mediaItems) {
    if (item?.uri) {
      const sc = shortcodeFromHref(item.uri);
      if (sc) add(sc, item.creation_timestamp || item.timestamp, item?.title, item.uri);
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
        const sc = shortcodeFromHref(href);
        if (sc) add(sc, ts, caption || entry?.title, href);
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
  const [parseStats, setParseStats] = useState(null);
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
    setParseStats(null);
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

      const savesWithFolders = saves.filter((s) => s.collections?.length).length;
      const folderNames = new Set();
      for (const s of saves) {
        for (const name of s.collections || []) folderNames.add(name);
      }
      setParseStats({
        savesWithFolders,
        foldersFound: folderNames.size,
        folderNames: [...folderNames].sort((a, b) => a.localeCompare(b)),
      });

      setProgress(35);
      setStatusLabel(
        savesWithFolders > 0
          ? `Found ${saves.length} posts in ${folderNames.size} Instagram folders. Syncing…`
          : `Found ${saves.length} saved posts. Sending to your library…`,
      );

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
    setParseStats(null);
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
            Official Instagram export only. Sign in once, drop your ZIP below, and we organize every saved post into categories you can search (try &quot;villa&quot;, &quot;startup&quot;, or &quot;travel&quot;).
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
              {result?.imported > 0 ? (
                <p>
                  <strong>{result.imported}</strong> new saves added to your library
                  {result.total > result.imported
                    ? ` — ${result.total - result.imported} were already there.`
                    : "."}
                </p>
              ) : (
                <p>
                  All <strong>{result?.total ?? 0}</strong> posts were already in your library.
                </p>
              )}
              {result?.collectionsUpdated > 0 ? (
                <p>
                  Linked <strong>{result.collectionsUpdated}</strong> saves to{" "}
                  <strong>{result.foldersFound ?? parseStats?.foldersFound ?? 0}</strong> Instagram folders
                  {parseStats?.folderNames?.length ? `: ${parseStats.folderNames.slice(0, 6).join(", ")}${parseStats.folderNames.length > 6 ? "…" : ""}` : "."}
                </p>
              ) : parseStats?.savesWithFolders > 0 ? (
                <p className={styles.warnText}>
                  Found {parseStats.savesWithFolders} posts with folder tags in your ZIP, but none were saved to the database. Try importing again after the latest app update.
                </p>
              ) : (
                <p className={styles.warnText}>
                  No Instagram collection folders found in this ZIP. When requesting your export, select <strong>Saved posts and collections</strong> (not posts only).
                </p>
              )}
              <div className={styles.successActions}>
                <a
                  href={`/dashboard?imported=${encodeURIComponent(String(result?.imported ?? 0))}`}
                  className={styles.primaryButton}
                >
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
