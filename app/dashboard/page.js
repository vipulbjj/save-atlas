"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./dashboard.module.css";
import {
  LayoutGrid, BookmarkIcon, Sparkles, Box, Home,
  TreePine, Building, Triangle, Heart, Lightbulb,
  Search, Upload, User, RefreshCw, ExternalLink,
  ImageIcon, Film, Layers, List, LayoutDashboard,
  ChevronDown, X, ArrowUpRight, Clock, SortAsc, SortDesc
} from "lucide-react";

const CATEGORIES = [
  { id: "all", label: "All Saves", icon: <LayoutGrid size={15} /> },
  { id: "interiors", label: "Interiors", icon: <Home size={15} /> },
  { id: "facades", label: "Facades", icon: <Building size={15} /> },
  { id: "landscape", label: "Landscape", icon: <TreePine size={15} /> },
  { id: "materials", label: "Materials", icon: <Box size={15} /> },
  { id: "structural", label: "Structural", icon: <Triangle size={15} /> },
];

const MEDIA_FILTERS = [
  { id: "all", label: "All" },
  { id: "IMAGE", label: "Photos" },
  { id: "VIDEO", label: "Videos" },
  { id: "CAROUSEL", label: "Carousels" },
];

const SORT_OPTIONS = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
];

function inferCategory(save) {
  const text = `${save.caption || ""} ${(save.hashtags || []).join(" ")}`.toLowerCase();
  if (text.match(/interior|living|bedroom|kitchen|sofa|furniture|decor|room/)) return "interiors";
  if (text.match(/facade|exterior|house|villa|building|architect/)) return "facades";
  if (text.match(/garden|landscape|tree|plant|outdoor|courtyard|nature/)) return "landscape";
  if (text.match(/stair|ceiling|floor|material|stone|concrete|wood|metal/)) return "materials";
  if (text.match(/structural|beam|column|frame|bridge|engineer/)) return "structural";
  return "facades";
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Dashboard() {
  const [saves, setSaves] = useState([]);
  const [totalSaves, setTotalSaves] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [viewMode, setViewMode] = useState("grid"); // grid | list
  const [lastRefresh, setLastRefresh] = useState(null);
  const [selectedSave, setSelectedSave] = useState(null);
  const [showSort, setShowSort] = useState(false);
  const searchRef = useRef(null);
  const sortRef = useRef(null);

  const fetchSaves = useCallback(async (query = "") => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: "100" });
      if (query) params.set("search", query);
      const res = await fetch(`/api/saves?${params}`);
      const data = await res.json();
      if (data.ok) {
        setSaves(data.saves || []);
        setTotalSaves(data.total || 0);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error("Failed to fetch saves:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSaves(); }, [fetchSaves]);
  useEffect(() => {
    const interval = setInterval(() => fetchSaves(searchQuery), 30000);
    return () => clearInterval(interval);
  }, [fetchSaves, searchQuery]);
  useEffect(() => {
    const t = setTimeout(() => fetchSaves(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery, fetchSaves]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setShowSort(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut: / to focus search, Esc to close modal
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSelectedSave(null);
        setShowSort(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Filter + sort pipeline
  const filteredSaves = saves
    .filter((s) => {
      if (mediaFilter !== "all" && s.media_type !== mediaFilter) return false;
      if (activeCategory !== "all" && inferCategory(s) !== activeCategory) return false;
      return true;
    })
    .sort((a, b) => {
      const ta = new Date(a.timestamp || a.synced_at || 0).getTime();
      const tb = new Date(b.timestamp || b.synced_at || 0).getTime();
      return sortOrder === "newest" ? tb - ta : ta - tb;
    });

  // Category counts
  const categoryCounts = saves.reduce((acc, s) => {
    const cat = inferCategory(s);
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const hasRealData = saves.length > 0;

  // Stat tiles
  const stats = [
    { label: "Total Saves", value: totalSaves || "—" },
    { label: "Categories", value: hasRealData ? Object.keys(categoryCounts).length : "—" },
    { label: "Photos", value: hasRealData ? saves.filter(s => s.media_type === "IMAGE").length : "—" },
    { label: "Videos", value: hasRealData ? saves.filter(s => s.media_type === "VIDEO").length : "—" },
  ];

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <a href="/" className={styles.logo}>
            <span className={styles.logoMark}>SA</span>
            <span>SaveAtlas</span>
            <span className={styles.logoPing}></span>
          </a>

          <nav className={styles.nav}>
            <div className={styles.navSection}>
              <span className={styles.navLabel}>Library</span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className={`${styles.navItem} ${activeCategory === cat.id ? styles.navActive : ""}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <span className={styles.navIcon}>{cat.icon}</span>
                  <span>{cat.label}</span>
                  {cat.id !== "all" && categoryCounts[cat.id] > 0 && (
                    <span className={styles.navBadge}>{categoryCounts[cat.id]}</span>
                  )}
                  {cat.id === "all" && totalSaves > 0 && (
                    <span className={styles.navBadge}>{totalSaves}</span>
                  )}
                </button>
              ))}
            </div>

            <div className={styles.navSection}>
              <span className={styles.navLabel}>Collections</span>
              {[
                { icon: <Heart size={15} />, label: "Favourites" },
                { icon: <Lightbulb size={15} />, label: "Inspiration" },
                { icon: <Sparkles size={15} />, label: "AI Highlights" },
              ].map((item, i) => (
                <button key={i} className={styles.navItem}>
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>

        <div className={styles.sidebarBottom}>
          {lastRefresh && (
            <div className={styles.syncStatus}>
              <span className={styles.syncDot}></span>
              Synced {timeAgo(lastRefresh)}
            </div>
          )}
          <a href="/import" className={styles.importBtn}>
            <Upload size={15} />
            Import from Instagram
          </a>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className={styles.main}>
        {/* Top Bar */}
        <header className={styles.topBar}>
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} />
            <input
              ref={searchRef}
              type="text"
              className={styles.searchInput}
              placeholder='Search saves… (press "/" to focus)'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className={styles.searchClear} onClick={() => setSearchQuery("")}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className={styles.topActions}>
            <button
              className={`${styles.iconBtn} ${loading ? styles.spinning : ""}`}
              onClick={() => fetchSaves(searchQuery)}
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>

            {/* View toggle */}
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewActive : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid view"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewActive : ""}`}
                onClick={() => setViewMode("list")}
                title="List view"
              >
                <List size={15} />
              </button>
            </div>

            <div className={styles.userAvatar}>
              <User size={16} />
            </div>
          </div>
        </header>

        {/* Stats strip */}
        <div className={styles.statsStrip}>
          {stats.map((s, i) => (
            <div key={i} className={styles.statTile}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Filter + Sort bar */}
        <div className={styles.filterBar}>
          <div className={styles.mediaFilters}>
            {MEDIA_FILTERS.map((f) => (
              <button
                key={f.id}
                className={`${styles.filterPill} ${mediaFilter === f.id ? styles.filterActive : ""}`}
                onClick={() => setMediaFilter(f.id)}
              >
                {f.id === "IMAGE" && <ImageIcon size={13} />}
                {f.id === "VIDEO" && <Film size={13} />}
                {f.id === "CAROUSEL" && <Layers size={13} />}
                {f.label}
              </button>
            ))}
          </div>

          <div className={styles.sortWrap} ref={sortRef}>
            <button className={styles.sortBtn} onClick={() => setShowSort(!showSort)}>
              <SortDesc size={15} />
              {SORT_OPTIONS.find(s => s.id === sortOrder)?.label}
              <ChevronDown size={13} />
            </button>
            {showSort && (
              <div className={styles.sortDropdown}>
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    className={`${styles.sortOption} ${sortOrder === opt.id ? styles.sortActive : ""}`}
                    onClick={() => { setSortOrder(opt.id); setShowSort(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Empty — no data yet */}
          {!loading && !hasRealData && (
            <div className={styles.emptyState}>
              <div className={styles.emptyGlow}></div>
              <BookmarkIcon size={40} className={styles.emptyIcon} />
              <h2>Your architecture library is empty</h2>
              <p>Import your Instagram data export to populate your library with all your saved posts — including ones saved on mobile.</p>
              <a href="/import" className={styles.emptyAction}>
                <Upload size={16} /> Import from Instagram
              </a>
            </div>
          )}

          {/* No results from search/filter */}
          {!loading && hasRealData && filteredSaves.length === 0 && (
            <div className={styles.emptyState}>
              <Search size={36} className={styles.emptyIcon} />
              <h2>No results found</h2>
              <p>Try a different search term or clear your filters.</p>
              <button className={styles.emptyAction} onClick={() => { setSearchQuery(""); setMediaFilter("all"); setActiveCategory("all"); }}>
                Clear filters
              </button>
            </div>
          )}

          {/* Skeleton */}
          {loading && !hasRealData && (
            <div className={styles.grid}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={styles.skeleton} style={{ height: `${220 + (i % 4) * 60}px` }} />
              ))}
            </div>
          )}

          {/* Grid view */}
          {!loading && filteredSaves.length > 0 && viewMode === "grid" && (
            <div className={styles.grid}>
              {filteredSaves.map((save, i) => (
                <div
                  key={save.id || i}
                  className={styles.card}
                  style={{ "--delay": `${(i % 12) * 40}ms` }}
                  onClick={() => setSelectedSave(save)}
                >
                  <div className={styles.cardThumb}>
                    {save.thumbnail_url ? (
                      <img
                        src={save.thumbnail_url}
                        alt={save.caption || "Save"}
                        crossOrigin="anonymous"
                        loading="lazy"
                        onError={(e) => { e.target.parentElement.classList.add(styles.noImage); }}
                      />
                    ) : (
                      <div className={styles.cardNoImg}><ImageIcon size={24} /></div>
                    )}
                    {save.media_type === "VIDEO" && <span className={styles.cardBadgeVideo}><Film size={11} /> Video</span>}
                    {save.media_type === "CAROUSEL" && <span className={styles.cardBadgeCarousel}><Layers size={11} /> Album</span>}
                  </div>
                  <div className={styles.cardBody}>
                    {save.username && <span className={styles.cardUser}>@{save.username}</span>}
                    {save.caption && <p className={styles.cardCaption}>{save.caption.slice(0, 80)}{save.caption.length > 80 ? "…" : ""}</p>}
                    <div className={styles.cardFooter}>
                      <span className={styles.cardCat}>{CATEGORIES.find(c => c.id === inferCategory(save))?.label || "Architecture"}</span>
                      <span className={styles.cardDate}>{formatDate(save.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List view */}
          {!loading && filteredSaves.length > 0 && viewMode === "list" && (
            <div className={styles.list}>
              {filteredSaves.map((save, i) => (
                <div key={save.id || i} className={styles.listRow} onClick={() => setSelectedSave(save)}>
                  <div className={styles.listThumb}>
                    {save.thumbnail_url ? (
                      <img src={save.thumbnail_url} alt="" crossOrigin="anonymous" loading="lazy" />
                    ) : (
                      <ImageIcon size={18} />
                    )}
                  </div>
                  <div className={styles.listMeta}>
                    <span className={styles.listUser}>@{save.username || "unknown"}</span>
                    <p className={styles.listCaption}>{save.caption?.slice(0, 120) || "No caption"}{save.caption?.length > 120 ? "…" : ""}</p>
                  </div>
                  <span className={styles.listCat}>{CATEGORIES.find(c => c.id === inferCategory(save))?.label}</span>
                  <span className={styles.listDate}>{formatDate(save.timestamp)}</span>
                  {save.permalink && (
                    <a href={save.permalink} target="_blank" className={styles.listLink} onClick={e => e.stopPropagation()}>
                      <ArrowUpRight size={15} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {selectedSave && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedSave(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelectedSave(null)}><X size={18} /></button>

            <div className={styles.modalLeft}>
              {selectedSave.thumbnail_url ? (
                <img src={selectedSave.thumbnail_url} alt="" crossOrigin="anonymous" className={styles.modalImg} />
              ) : (
                <div className={styles.modalNoImg}><ImageIcon size={48} /></div>
              )}
            </div>

            <div className={styles.modalRight}>
              <div className={styles.modalMeta}>
                {selectedSave.username && (
                  <span className={styles.modalUser}>@{selectedSave.username}</span>
                )}
                <span className={styles.modalCat}>
                  {CATEGORIES.find(c => c.id === inferCategory(selectedSave))?.label || "Architecture"}
                </span>
              </div>

              {selectedSave.caption && (
                <p className={styles.modalCaption}>{selectedSave.caption}</p>
              )}

              {selectedSave.hashtags?.length > 0 && (
                <div className={styles.modalTags}>
                  {selectedSave.hashtags.slice(0, 10).map((tag, i) => (
                    <span key={i} className={styles.modalTag}>{tag}</span>
                  ))}
                </div>
              )}

              <div className={styles.modalStats}>
                {selectedSave.likes > 0 && (
                  <div className={styles.modalStat}>
                    <Heart size={14} /> {selectedSave.likes.toLocaleString()} likes
                  </div>
                )}
                {selectedSave.timestamp && (
                  <div className={styles.modalStat}>
                    <Clock size={14} /> {formatDate(selectedSave.timestamp)}
                  </div>
                )}
              </div>

              {selectedSave.permalink && (
                <a href={selectedSave.permalink} target="_blank" className={styles.modalAction}>
                  View on Instagram <ArrowUpRight size={16} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
