"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Grid as GridIcon, List, RefreshCw, ChevronDown,
  Layers, ExternalLink, Heart, X, Image, Film,
  ArrowUpRight, Sparkles, Lightbulb, Loader2, UploadCloud,
  LogOut, Menu, Wand2, CheckCircle2, AlertCircle, Plug, Zap, FolderOpen
} from "lucide-react";
import styles from "./dashboard.module.css";
import { createClient } from "@/lib/supabase-client";
import { CATEGORIES as TAXONOMY_CATEGORIES, SUBCATEGORIES } from "@/lib/categorize";
import { captionMatchesSearch } from "@/lib/aiSearch";

// ─── Utilities ────────────────────────────────────────────────────────────────

const fixEncoding = (str) => {
  if (!str) return "";
  try {
    const bytes = new Uint8Array(str.split("").map((c) => c.charCodeAt(0)));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return str;
  }
};

const formatDate = (ts) => {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
};

const saveImageAlt = (save) =>
  save.caption
    ? fixEncoding(save.caption).slice(0, 80)
    : `Instagram save by @${save.username || "user"}`;

// ─── Category meta (icon + color) not in lib/categorize so keep locally ───────

const CAT_META = {
  "all":        { icon: <Layers size={15} />,      color: "#B08D6A" },
  "tech-ai":    { icon: <Sparkles size={15} />,    color: "#6A8DB0" },
  "business":   { icon: <ArrowUpRight size={15} />,color: "#B06A6A" },
  "lifestyle":  { icon: <Heart size={15} />,        color: "#8DB06A" },
  "food":       { icon: <Sparkles size={15} />,    color: "#D4886A" },
  "fitness":    { icon: <Zap size={15} />,          color: "#6AB08D" },
  "travel":     { icon: <ArrowUpRight size={15} />, color: "#6AB0A8" },
  "home-design":{ icon: <Layers size={15} />,       color: "#B0A86A" },
  "fashion":    { icon: <Sparkles size={15} />,    color: "#C47FC4" },
  "art-culture":{ icon: <Lightbulb size={15} />,   color: "#A07AB0" },
  "other":      { icon: <Layers size={15} />,       color: "#888888" },
};

// Build full CATEGORIES array: "all" + taxonomy
const ALL_CAT = [
  { id: "all", label: "All Saves", ...CAT_META["all"] },
  ...TAXONOMY_CATEGORIES
    .filter((c) => c.id !== "other")
    .map((c) => ({ ...c, ...CAT_META[c.id] })),
  { id: "other", label: "Everything Else", ...CAT_META["other"] },
];

// ─── Highlight component ──────────────────────────────────────────────────────

const Highlight = ({ text, query }) => {
  if (!query || !text) return <span>{text || ""}</span>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className={styles.highlight}>{part}</mark>
          : part
      )}
    </span>
  );
};

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_SAVES = [
  { id: "demo_1", instagram_id: "demo1", thumbnail_url: "/modern_villa_facade_1777051470979.png", username: "architecture_daily", caption: "Stunning modern minimal villa with raw concrete and expansive glass #architecture #minimal", ai_category: "home-design", likes: 1, timestamp: new Date().toISOString() },
  { id: "demo_2", instagram_id: "demo2", thumbnail_url: "/japandi_interior_1777051495653.png", username: "japandi_homes", caption: "Perfect blend of Japanese minimalism and Scandinavian functionality. The warm wood tones are incredible.", ai_category: "home-design", likes: 0, timestamp: new Date(Date.now() - 86400000).toISOString() },
  { id: "demo_3", instagram_id: "demo3", thumbnail_url: "/concrete_staircase_1777051518775.png", username: "brutal_architecture", caption: "Board-formed concrete floating staircase detail. Brutal yet refined.", ai_category: "home-design", likes: 1, timestamp: new Date(Date.now() - 186400000).toISOString() },
  { id: "demo_4", instagram_id: "demo4", thumbnail_url: "/tropical_courtyard_1777051537632.png", username: "tropical_spaces", caption: "Bringing the outside in. This internal courtyard is an absolute dream oasis.", ai_category: "travel", likes: 0, timestamp: new Date(Date.now() - 286400000).toISOString() },
  { id: "demo_5", instagram_id: "demo5", thumbnail_url: "/wooden_ceiling_1777051553645.png", username: "interior_details", caption: "Slatted wood ceiling treatment that completely transforms the acoustic and visual space of this room.", ai_category: "home-design", likes: 0, timestamp: new Date(Date.now() - 386400000).toISOString() },
];

const DEMO_STATS = {
  total: 5, photos: 5, videos: 0,
  categories: { "home-design": 4, "travel": 1 },
  subCategories: { "home-design": { "architecture": 2, "interiors": 2 }, "travel": { "stays": 1 } },
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeCollection, setActiveCollection] = useState("all");
  const [activeSubCategory, setActiveSubCategory] = useState("all");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [sortOrder] = useState("newest");
  const [viewMode, setViewMode] = useState("grid");
  const [selectedSave, setSelectedSave] = useState(null);
  const [totalSaves, setTotalSaves] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [globalStats, setGlobalStats] = useState({ total: 0, photos: 0, videos: 0, categories: {}, subCategories: {}, igCollections: {} });
  const [activeIgFolder, setActiveIgFolder] = useState(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [importBanner, setImportBanner] = useState(null);

  // Organize state
  const [organizeState, setOrganizeState] = useState("idle"); // idle | running | done | error
  const [organizeProgress, setOrganizeProgress] = useState({ processed: 0, total: 0 });
  const organizeRef = useRef(false);
  const indexRef = useRef(false);

  // Dynamic theme pills mined from post text for the active category
  const [topics, setTopics] = useState([]);
  const [activeTheme, setActiveTheme] = useState(null); // { label, query }

  const searchRef = useRef(null);
  const activeRequestRef = useRef(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Import banner from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const imported = params.get("imported");
    if (imported) {
      setImportBanner(`Imported ${imported} saves — try search: villa, startup, travel`);
      params.delete("imported");
      const qs = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
  }, []);

  // Fetch current user email (client-side fallback)
  useEffect(() => {
    const isDemo = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "true";
    if (isDemo) { setUserEmail("demo@saveatlas.com"); return; }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    }).catch(() => {});
  }, []);

  // Background semantic index — runs once per session, no UI
  useEffect(() => {
    const isDemo = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "true";
    if (isDemo || indexRef.current) return;

    indexRef.current = true;
    (async () => {
      let offset = 0;
      try {
        for (let i = 0; i < 25; i++) {
          const res = await fetch("/api/saves/index", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offset }),
          });
          const data = await res.json();
          if (!data.ok) break;
          if (data.done) break;
          offset = data.nextOffset ?? offset + (data.processed || 0);
        }
      } catch {
        indexRef.current = false;
      }
    })();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (data.ok) {
        setGlobalStats(data.stats);
        if (data.email) setUserEmail(data.email);
      }
    } catch {}
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch {}
  };

  const fetchSaves = useCallback(async (query, cat, sub, coll, media, igFolder, reset) => {
    const requestId = ++activeRequestRef.current;
    try {
      setLoading(true);
      if (reset) setSaves([]);
      const currentPage = reset ? 1 : page;
      const params = new URLSearchParams({ limit: "50", page: currentPage.toString() });
      if (query) params.set("search", query);
      if (cat !== "all") params.set("category", cat);
      if (sub !== "all") params.set("subcategory", sub);
      if (coll !== "all") params.set("collection", coll);
      if (igFolder) params.set("ig_collection", igFolder);
      if (media !== "all") params.set("media_type", media);

      const res = await fetch(`/api/saves?${params}`);
      const data = await res.json();
      if (requestId !== activeRequestRef.current) return;
      if (data.ok) {
        const newSaves = data.saves || [];
        if (reset) {
          setSaves(newSaves);
        } else {
          setSaves((prev) => {
            const existingIds = new Set(prev.map((s) => s.id));
            return [...prev, ...newSaves.filter((s) => !existingIds.has(s.id))];
          });
        }
        setTotalSaves(data.total || 0);
        setHasMore(newSaves.length === 50);
      }
    } catch {} finally {
      if (requestId === activeRequestRef.current) setLoading(false);
    }
  }, [page]);

  // Effective search: typed query OR selected theme from pills
  const effectiveSearch = activeTheme?.query ?? debouncedSearchQuery;

  // Main data effect
  useEffect(() => {
    const isDemo = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "true";
    if (isDemo) {
      setGlobalStats(DEMO_STATS);
      let filteredDemo = DEMO_SAVES;
      if (activeCategory !== "all") filteredDemo = filteredDemo.filter((s) => s.ai_category === activeCategory);
      if (effectiveSearch) {
        filteredDemo = filteredDemo.filter((s) => captionMatchesSearch(s.caption, effectiveSearch));
      }
      setSaves(filteredDemo);
      setTotalSaves(filteredDemo.length);
      setHasMore(false);
      setLoading(false);
      return;
    }
    fetchStats();
    fetchSaves(effectiveSearch, activeCategory, activeSubCategory, activeCollection, mediaFilter, activeIgFolder, true);
    setPage(1);
  }, [effectiveSearch, activeCategory, activeSubCategory, activeCollection, activeIgFolder, mediaFilter]);

  useEffect(() => {
    if (page > 1) {
      fetchSaves(effectiveSearch, activeCategory, activeSubCategory, activeCollection, mediaFilter, activeIgFolder, false);
    }
  }, [page]);

  const loadMore = () => setPage((prev) => prev + 1);

  const toggleLike = async (e, save) => {
    e.stopPropagation();
    const newLikes = (save.likes || 0) === 0 ? 1 : 0;
    try {
      const res = await fetch("/api/saves/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: save.id, likes: newLikes }),
      });
      if (res.ok) setSaves((prev) => prev.map((s) => s.id === save.id ? { ...s, likes: newLikes } : s));
    } catch {}
  };

  // ─── Organize (batch re-classify) ─────────────────────────────────────────

  const runOrganize = async () => {
    if (organizeState === "running") return;
    setOrganizeState("running");
    setOrganizeProgress({ processed: 0, total: 0 });
    organizeRef.current = true;
    let offset = 0;
    let totalProcessed = 0;

    try {
      while (organizeRef.current) {
        const res = await fetch("/api/saves/organize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Organize failed");

        totalProcessed += data.processed;
        setOrganizeProgress({ processed: totalProcessed, total: data.total });

        if (data.done) break;
        offset = data.nextOffset;
      }

      setOrganizeState("done");
      // Refresh stats + saves after organize
      await fetchStats();
      fetchSaves(debouncedSearchQuery, activeCategory, activeSubCategory, activeCollection, mediaFilter, activeIgFolder, true);
      // Reset done state after 4 s
      setTimeout(() => setOrganizeState("idle"), 4000);
    } catch (err) {
      console.error("Organize error:", err);
      setOrganizeState("error");
      setTimeout(() => setOrganizeState("idle"), 4000);
    } finally {
      organizeRef.current = false;
    }
  };

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSelectedSave(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Fetch theme pills whenever the active category changes
  useEffect(() => {
    if (activeCategory === "all") { setTopics([]); setActiveTheme(null); return; }
    let cancelled = false;
    fetch(`/api/saves/topics?category=${activeCategory}&limit=10`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setTopics(d.topics || []); })
      .catch(() => {});
    setActiveTheme(null);
    setActiveSubCategory("all");
    return () => { cancelled = true; };
  }, [activeCategory]);

  // ─── Derived data ─────────────────────────────────────────────────────────

  // Sort non-"all" categories by user count, hide those with 0 saves
  const igFolders = Object.entries(globalStats.igCollections || {})
    .filter(([, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1]);

  const hasIgFolders = igFolders.length > 0;

  const visibleCategories = [
    ALL_CAT[0], // "all" always first
    ...ALL_CAT.slice(1).filter((c) => (globalStats.categories[c.id] ?? 0) > 0)
      .sort((a, b) => (globalStats.categories[b.id] ?? 0) - (globalStats.categories[a.id] ?? 0)),
  ];

  const activeCategoryLabel = ALL_CAT.find((c) => c.id === activeCategory)?.label;

  const sidebarSubcategories = activeCategory !== "all"
    ? Object.entries(globalStats.subCategories?.[activeCategory] || {})
        .filter(([id, count]) => id && id !== "other" && count >= 3)
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({
          id,
          count,
          label: SUBCATEGORIES[activeCategory]?.find((s) => s.id === id)?.label
            || id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        }))
    : [];

  // Dynamic subtitle: list user's top categories by name
  const topCatNames = Object.entries(globalStats.categories)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => ALL_CAT.find((c) => c.id === id)?.label)
    .filter(Boolean);

  const dynamicSubtitle = topCatNames.length > 0
    ? `${globalStats.total} saves across ${topCatNames.join(", ")} and more`
    : `${globalStats.total || 0} Instagram saves — search across travel, startups, design, and more`;


  // Search placeholder based on active category
  const searchPlaceholders = {
    "tech-ai":    "Search AI tools, coding, productivity…",
    "business":   "Search startups, marketing, finance…",
    "lifestyle":  "Search mindset, wellness, family…",
    "food":       "Search recipes, restaurants, coffee…",
    "fitness":    "Search workouts, yoga, nutrition…",
    "travel":     "Search destinations, stays, tips…",
    "home-design":"Search interiors, decor, architecture…",
    "fashion":    "Search outfits, streetwear, luxury…",
    "art-culture":"Search art, photography, music…",
  };
  const searchPlaceholder = searchPlaceholders[activeCategory] || "Search library with AI intelligence…";

  const filteredSaves = [...saves].sort((a, b) => {
    const ta = new Date(a.timestamp || a.synced_at || 0).getTime();
    const tb = new Date(b.timestamp || b.synced_at || 0).getTime();
    return sortOrder === "newest" ? tb - ta : ta - tb;
  });

  const statsArr = [
    { label: "Total Saves", value: globalStats.total ?? 0 },
    { label: "Categories", value: Object.keys(globalStats.categories ?? {}).filter((k) => globalStats.categories[k] > 0).length },
    { label: "Photos", value: globalStats.photos ?? 0 },
    { label: "Videos", value: globalStats.videos ?? 0 },
  ];

  // ─── Organize button state ─────────────────────────────────────────────────

  const organizeIcon = organizeState === "running"
    ? <Loader2 size={14} className={styles.spinning} />
    : organizeState === "done"
    ? <CheckCircle2 size={14} />
    : organizeState === "error"
    ? <AlertCircle size={14} />
    : <Wand2 size={14} />;

  const organizeLabel = organizeState === "running"
    ? organizeProgress.total > 0
      ? `Organizing… ${organizeProgress.processed}/${organizeProgress.total}`
      : "Organizing…"
    : organizeState === "done"
    ? "Done!"
    : organizeState === "error"
    ? "Failed — retry?"
    : "Auto Organize";

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.layout}>
      {sidebarOpen && (
        <button
          type="button"
          className={styles.sidebarOverlay}
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarTop}>
          <a href="/" className={styles.logo}>
            <span className={styles.logoMark}>SA</span>
            <span>SaveAtlas</span>
          </a>

          <a href="/import" className={styles.uploadBtn}>
            <UploadCloud size={16} />
            Upload Instagram Data
          </a>

          <nav className={styles.nav}>
            <div className={styles.navSection}>
              <span className={styles.navLabel}>{hasIgFolders ? "Your Folders" : "Library"}</span>
              <button
                className={`${styles.navItem} ${activeCategory === "all" && activeCollection === "all" && !activeIgFolder ? styles.navActive : ""}`}
                onClick={() => {
                  setActiveCategory("all");
                  setActiveCollection("all");
                  setActiveSubCategory("all");
                  setActiveIgFolder(null);
                  setSidebarOpen(false);
                }}
              >
                <span className={styles.navIcon}><Layers size={15} /></span>
                <span>All Saves</span>
                {globalStats.total > 0 && (
                  <span className={styles.navBadge}>{globalStats.total}</span>
                )}
              </button>

              {hasIgFolders ? (
                igFolders.map(([name, count]) => (
                  <button
                    key={name}
                    className={`${styles.navItem} ${activeIgFolder === name ? styles.navActive : ""}`}
                    onClick={() => {
                      setActiveIgFolder(name);
                      setActiveCategory("all");
                      setActiveCollection("all");
                      setActiveSubCategory("all");
                      setActiveTheme(null);
                      setSidebarOpen(false);
                    }}
                  >
                    <span className={styles.navIcon}><FolderOpen size={15} /></span>
                    <span>{name}</span>
                    <span className={styles.navBadge}>{count}</span>
                  </button>
                ))
              ) : (
                visibleCategories.filter((c) => c.id !== "all").map((cat) => (
                  <button
                    key={cat.id}
                    className={`${styles.navItem} ${activeCategory === cat.id && activeCollection === "all" && !activeIgFolder ? styles.navActive : ""}`}
                    onClick={() => {
                      setActiveCategory(cat.id);
                      setActiveCollection("all");
                      setActiveSubCategory("all");
                      setActiveIgFolder(null);
                      setSidebarOpen(false);
                    }}
                  >
                    <span className={styles.navIcon}>{cat.icon}</span>
                    <span>{cat.label}</span>
                    {(globalStats.categories[cat.id] ?? 0) > 0 && (
                      <span className={styles.navBadge}>{globalStats.categories[cat.id]}</span>
                    )}
                  </button>
                ))
              )}
            </div>

            {hasIgFolders && visibleCategories.filter((c) => c.id !== "all").length > 0 && (
              <div className={styles.navSection}>
                <span className={styles.navLabel}>AI Categories</span>
                {visibleCategories.filter((c) => c.id !== "all").map((cat) => (
                  <button
                    key={cat.id}
                    className={`${styles.navItem} ${activeCategory === cat.id && activeCollection === "all" && !activeIgFolder ? styles.navActive : ""}`}
                    onClick={() => {
                      setActiveCategory(cat.id);
                      setActiveCollection("all");
                      setActiveSubCategory("all");
                      setActiveIgFolder(null);
                      setSidebarOpen(false);
                    }}
                  >
                    <span className={styles.navIcon}>{cat.icon}</span>
                    <span>{cat.label}</span>
                    {(globalStats.categories[cat.id] ?? 0) > 0 && (
                      <span className={styles.navBadge}>{globalStats.categories[cat.id]}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {activeCategory !== "all" && !activeIgFolder && sidebarSubcategories.length > 0 && (
              <div className={styles.navSection}>
                <span className={styles.navLabel}>In {activeCategoryLabel}</span>
                <button
                  className={`${styles.navSubItem} ${activeSubCategory === "all" && !activeTheme ? styles.navSubActive : ""}`}
                  onClick={() => {
                    setActiveSubCategory("all");
                    setActiveTheme(null);
                    setSidebarOpen(false);
                  }}
                >
                  <span>All in category</span>
                </button>
                {sidebarSubcategories.map((sub) => (
                  <button
                    key={sub.id}
                    className={`${styles.navSubItem} ${activeSubCategory === sub.id && !activeTheme ? styles.navSubActive : ""}`}
                    onClick={() => {
                      setActiveSubCategory(sub.id);
                      setActiveTheme(null);
                      setSearchQuery("");
                      setSidebarOpen(false);
                    }}
                  >
                    <span>{sub.label}</span>
                    <span className={styles.navBadge}>{sub.count}</span>
                  </button>
                ))}
              </div>
            )}

            <div className={styles.navSection}>
              <span className={styles.navLabel}>Collections</span>
              {[
                { id: "favourites", icon: <Heart size={15} />, label: "Favourites" },
                { id: "inspiration", icon: <Lightbulb size={15} />, label: "Inspiration" },
                { id: "highlights",  icon: <Sparkles size={15} />,  label: "AI Highlights" },
              ].map((item) => (
                <button
                  key={item.id}
                  className={`${styles.navItem} ${activeCollection === item.id ? styles.navActive : ""}`}
                  onClick={() => { setActiveCollection(item.id); setActiveCategory("all"); setActiveSubCategory("all"); setActiveIgFolder(null); setSidebarOpen(false); }}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>

        <div className={styles.sidebarBottom}>
          <div className={styles.userProfile}>
            <div className={styles.userAvatar}>
              {(userEmail || "explorer@saveatlas.com")[0].toUpperCase()}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userEmail}>{userEmail || "explorer@saveatlas.com"}</span>
              <span className={styles.userBadge}>Free plan</span>
            </div>
            <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
          <div className={styles.sidebarStatus}>
            <div className={styles.statusDot}></div>
            <span>System Online</span>
          </div>
          <p className={styles.sidebarVersion}>v2.5.0 • Pro</p>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.menuBtn}
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className={`${styles.searchBar} ${searchQuery ? styles.searchBarActive : ""}`}>
            <div className={styles.aiGlow}></div>
            <Search className={styles.searchIcon} size={18} />
            <input
              ref={searchRef}
              type="text"
              placeholder={activeTheme ? `Showing "${activeTheme.label}" — clear to see all` : searchPlaceholder}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) setActiveTheme(null); }}
              style={activeTheme ? { color: "var(--text-muted)", fontStyle: "italic" } : {}}
            />
            {(searchQuery || activeTheme) && (
              <button className={styles.searchClear} onClick={() => { setSearchQuery(""); setActiveTheme(null); }}>
                <X size={14} />
              </button>
            )}
            <div className={styles.searchHint}>
              <Sparkles size={10} />
              <span>⌘K</span>
            </div>
          </div>
        </header>

        <div className={styles.content}>
          {importBanner && (
            <div className={styles.importBanner} role="status">
              <Sparkles size={16} />
              <span>{importBanner}</span>
              <button type="button" className={styles.importBannerDismiss} onClick={() => setImportBanner(null)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          )}

          <div className={styles.welcome}>
            <div>
              <h1 className={styles.title}>Knowledge Library</h1>
              <p className={styles.subtitle}>{dynamicSubtitle}</p>
            </div>
            <div className={styles.stats}>
              {statsArr.map((s, i) => (
                <div key={i} className={styles.statCard}>
                  <span className={styles.statLabel}>{s.label}</span>
                  <span className={styles.statValue}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.tabs}>
              {["all", "IMAGE", "VIDEO"].map((type) => (
                <button
                  key={type}
                  className={`${styles.tab} ${mediaFilter === type ? styles.tabActive : ""}`}
                  onClick={() => setMediaFilter(type)}
                >
                  {type === "all" && "All"}
                  {type === "IMAGE" && "Photos"}
                  {type === "VIDEO" && "Videos"}
                </button>
              ))}
            </div>

            <div className={styles.viewActions}>
              {/* Auto Organize button */}
              {globalStats.total > 0 && (
                <button
                  className={`${styles.organizeBtn} ${organizeState !== "idle" ? styles.organizeBtnActive : ""}`}
                  onClick={runOrganize}
                  disabled={organizeState === "running"}
                  title="Re-classify all your saves with the latest AI categories"
                >
                  {organizeIcon}
                  <span>{organizeLabel}</span>
                </button>
              )}

              <div className={styles.viewToggle}>
                <button
                  className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
                  onClick={() => setViewMode("grid")}
                >
                  <GridIcon size={18} />
                </button>
                <button
                  className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
                  onClick={() => setViewMode("list")}
                >
                  <List size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Filter pills — subcategories + distinct caption themes */}
          {activeCategory !== "all" && !activeIgFolder && topics.length > 0 && (
            <div className={styles.subToolbarWrap}>
              <div className={styles.subToolbar} role="tablist" aria-label="Category filters">
              <button
                className={`${styles.subTab} ${!activeTheme && activeSubCategory === "all" ? styles.subTabActive : ""}`}
                onClick={() => {
                  setActiveTheme(null);
                  setActiveSubCategory("all");
                }}
              >
                All {activeCategoryLabel}
              </button>
              {topics.map((theme) => (
                <button
                  key={theme.id}
                  className={`${styles.subTab} ${
                    (theme.kind === "subcategory" && activeSubCategory === theme.subcategoryId && !activeTheme)
                    || (theme.kind === "theme" && activeTheme?.query === theme.query)
                      ? styles.subTabActive
                      : ""
                  }`}
                  onClick={() => {
                    setSearchQuery("");
                    if (theme.kind === "subcategory") {
                      setActiveSubCategory(theme.subcategoryId);
                      setActiveTheme(null);
                    } else {
                      setActiveSubCategory("all");
                      setActiveTheme({ label: theme.label, query: theme.query });
                    }
                  }}
                >
                  {theme.label}
                  <span className={styles.subBadge}>{theme.count}</span>
                </button>
              ))}
              </div>
              <span className={styles.subToolbarHint} aria-hidden="true">Scroll →</span>
            </div>
          )}

          {/* Loading state */}
          {loading && saves.length === 0 ? (
            <div className={styles.loaderWrap}>
              <Loader2 className={styles.spinning} size={40} />
              <p>AI is scouring your library…</p>
            </div>
          ) : saves.length === 0 ? (
            globalStats.total > 0 ? (
              <div className={styles.emptyState}>
                <Layers size={48} className={styles.emptyIcon} />
                <h2>No items match your filters</h2>
                <p>Try adjusting your search or clearing your active filters to view your saves.</p>
                <button
                  className={styles.emptyBtn}
                  onClick={() => { setSearchQuery(""); setActiveTheme(null); setActiveCategory("all"); setActiveSubCategory("all"); setActiveCollection("all"); setActiveIgFolder(null); setMediaFilter("all"); }}
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <Layers size={48} className={styles.emptyIcon} />
                <h2>Your library is empty</h2>
                <p>Import your Instagram saves to start building your AI-powered knowledge base.</p>
                <a href="/import" className={styles.emptyBtn}>
                  <UploadCloud size={18} />
                  Upload Instagram Data
                </a>
                {/* Auto-sync guidance card */}
                <div className={styles.syncCard}>
                  <div className={styles.syncCardIcon}><Plug size={22} /></div>
                  <div className={styles.syncCardBody}>
                    <strong>Keep saves in sync automatically</strong>
                    <p>Install the SaveAtlas Chrome extension — it detects new saves on Instagram and syncs them to your library in the background.</p>
                    <a
                      href="https://chromewebstore.google.com/detail/saveatlas"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.syncCardLink}
                    >
                      Get the extension <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            )
          ) : viewMode === "grid" ? (
            <div className={styles.grid}>
              {filteredSaves.map((save, i) => {
                const cat = ALL_CAT.find((c) => c.id === (save.ai_category || "other")) || ALL_CAT[ALL_CAT.length - 1];
                return (
                  <div key={save.id || i} className={styles.card} onClick={() => setSelectedSave(save)}>
                    <div className={styles.cardThumb}>
                      <img
                        src={save.thumbnail_url || `https://images.weserv.nl/?url=https://www.instagram.com/p/${save.instagram_id}/media/?size=l&w=640&h=640&fit=cover`}
                        alt={saveImageAlt(save)}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (e.target.src.includes("weserv.nl")) {
                            e.target.src = `https://www.instagram.com/p/${save.instagram_id}/media/?size=l`;
                          } else {
                            e.target.style.display = "none";
                          }
                        }}
                      />
                      <button
                        className={`${styles.cardAction} ${save.likes > 0 ? styles.activeHeart : ""}`}
                        onClick={(e) => toggleLike(e, save)}
                      >
                        <Heart size={14} fill={save.likes > 0 ? "currentColor" : "none"} />
                      </button>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.cardMeta}>
                        <span className={styles.cardUser} style={{ color: cat.color }}>@{save.username || "user"}</span>
                        <span className={styles.cardCat}>{cat.label}</span>
                      </div>
                      <p className={styles.cardCaption}>
                        <Highlight text={fixEncoding(save.caption)} query={searchQuery || activeTheme?.query || ""} />
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.list}>
              {filteredSaves.map((save, i) => (
                <div key={save.id || i} className={styles.listRow} onClick={() => setSelectedSave(save)}>
                  <div className={styles.listThumb}>
                    <img
                      src={save.thumbnail_url || `https://images.weserv.nl/?url=https://www.instagram.com/p/${save.instagram_id}/media/?size=l&w=200&h=200&fit=cover`}
                      alt={saveImageAlt(save)}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  </div>
                  <div className={styles.listMeta}>
                    <span className={styles.listUser}>@{save.username || "unknown"}</span>
                    <p className={styles.listCaption}>{fixEncoding(save.caption)?.slice(0, 120)}…</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMore && (
            <div className={styles.loadMoreWrap}>
              <button className={styles.loadMoreBtn} onClick={loadMore} disabled={loading}>
                {loading ? <RefreshCw className={styles.spinning} /> : "Load More"}
              </button>
            </div>
          )}
        </div>
      </main>

      {selectedSave && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedSave(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelectedSave(null)}><X size={18} /></button>
            <div className={styles.modalLeft}>
              <img
                src={selectedSave.thumbnail_url || `https://images.weserv.nl/?url=https://www.instagram.com/p/${selectedSave.instagram_id}/media/?size=l&w=1080&h=1080&fit=cover`}
                alt={saveImageAlt(selectedSave)}
                referrerPolicy="no-referrer"
              />
            </div>
            <div className={styles.modalRight}>
              <p>{fixEncoding(selectedSave.caption)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
