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
  { id: "tech-ai", label: "Tech & AI", icon: <Sparkles size={15} />, color: "#818cf8" },
  { id: "business", label: "Business & Startups", icon: <Building size={15} />, color: "#fbbf24" },
  { id: "lifestyle", label: "Lifestyle & Growth", icon: <Heart size={15} />, color: "#f87171" },
  { id: "travel", label: "Travel & Stays", icon: <TreePine size={15} />, color: "#34d399" },
  { id: "home-design", label: "Home & Design", icon: <Home size={15} />, color: "#fb923c" },
  { id: "other", label: "Everything Else", icon: <Layers size={15} />, color: "#94a3b8" },
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

function fixEncoding(str) {
  if (!str) return str;
  try {
    // Instagram exports UTF-8 bytes as individual characters
    const bytes = new Uint8Array(str.split("").map((c) => c.charCodeAt(0)));
    return new TextDecoder("utf-8").decode(bytes);
  } catch (e) {
    return str;
  }
}

function inferCategory(save) {
  const text = fixEncoding(`${save.caption || ""} ${(save.hashtags || []).join(" ")}`).toLowerCase();
  
  if (text.match(/ai|claude|gpt|ai|code|python|repo|efficient|logic|tech/)) return "tech-ai";
  if (text.match(/startup|yc|founder|marketing|brand|budget|startup|founder|yc|paul graham/)) return "business";
  if (text.match(/love|relationship|maa|life|secrets|perspective|child|family|mindset|growth/)) return "lifestyle";
  if (text.match(/travel|trip|road trip|vacation|staycation|stay|dividends|eiffel|visit/)) return "travel";
  if (text.match(/home|interior|living|bedroom|kitchen|sofa|furniture|decor|room|villa|facade|architect/)) return "home-design";
  
  return "other";
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Highlight({ text, query }) {
  if (!query || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className={styles.highlight}>{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
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

  const [globalStats, setGlobalStats] = useState({ total: 0, photos: 0, videos: 0, categories: {} });

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (data.ok) setGlobalStats(data.stats);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  const fetchSaves = useCallback(async (query = "", cat = "all", coll = "all", reset = false) => {
    try {
      setLoading(true);
      const currentPage = reset ? 1 : page;
      const params = new URLSearchParams({ 
        limit: "50", 
        page: currentPage.toString(),
      });
      
      if (query) params.set("search", query);
      if (cat !== "all") params.set("category", cat);
      
      const res = await fetch(`/api/saves?${params}`);
      const data = await res.json();
      
      if (data.ok) {
        const newSaves = data.saves || [];
        if (reset) {
          setSaves(newSaves);
        } else {
          setSaves(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            return [...prev, ...newSaves.filter(s => !existingIds.has(s.id))];
          });
        }
        setTotalSaves(data.total || 0);
        setHasMore(newSaves.length === 50);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error("Failed to fetch saves:", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { 
    fetchStats();
    fetchSaves(searchQuery, activeCategory, activeCollection, true); 
    setPage(1);
  }, [searchQuery, activeCategory, activeCollection]);

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  useEffect(() => {
    if (page > 1) {
      fetchSaves(searchQuery, activeCategory, activeCollection, false);
    }
  }, [page]);

  // Sort and Media filter remain client-side for responsiveness
  const filteredSaves = saves
    .filter((s) => {
      if (mediaFilter !== "all" && s.media_type !== mediaFilter) return false;
      if (activeCollection === "favourites" && s.likes === 0) return false;
      if (activeCollection === "inspiration" && !s.ai_category?.match(/home|tech/)) return false;
      if (activeCollection === "highlights" && !s.caption?.match(/#highlight|excellent|best/i)) return false;
      return true;
    })
    .sort((a, b) => {
      const ta = new Date(a.timestamp || a.synced_at || 0).getTime();
      const tb = new Date(b.timestamp || b.synced_at || 0).getTime();
      return sortOrder === "newest" ? tb - ta : ta - tb;
    });

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
        if (document.activeElement.tagName !== "INPUT") {
          e.preventDefault();
          searchRef.current?.focus();
        }
      }
      if (e.key === "Escape") {
        setSelectedSave(null);
        setShowSort(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const toggleLike = async (e, save) => {
    e.stopPropagation();
    try {
      const newLikes = (save.likes || 0) === 0 ? 1 : 0;
      const res = await fetch(`/api/saves/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: save.id, likes: newLikes }),
      });
      if (res.ok) {
        setSaves(prev => prev.map(s => s.id === save.id ? { ...s, likes: newLikes } : s));
      }
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  const hasRealData = saves.length > 0;

  // Stat tiles
  const stats = [
    { label: "Total Saves", value: globalStats.total || "—" },
    { label: "Categories", value: hasRealData ? Object.keys(globalStats.categories).length : "—" },
    { label: "Photos", value: globalStats.photos || "—" },
    { label: "Videos", value: globalStats.videos || "—" },
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
                  className={`${styles.navItem} ${activeCategory === cat.id && activeCollection === 'all' ? styles.navActive : ""}`}
                  onClick={() => { setActiveCategory(cat.id); setActiveCollection('all'); }}
                >
                  <span className={styles.navIcon}>{cat.icon}</span>
                  <span>{cat.label}</span>
                  {cat.id !== "all" && globalStats.categories[cat.id] > 0 && (
                    <span className={styles.navBadge}>{globalStats.categories[cat.id]}</span>
                  )}
                  {cat.id === "all" && globalStats.total > 0 && (
                    <span className={styles.navBadge}>{globalStats.total}</span>
                  )}
                </button>
              ))}
            </div>

            <div className={styles.navSection}>
              <span className={styles.navLabel}>Collections</span>
              {[
                { id: "favourites", icon: <Heart size={15} />, label: "Favourites" },
                { id: "inspiration", icon: <Lightbulb size={15} />, label: "Inspiration" },
                { id: "highlights", icon: <Sparkles size={15} />, label: "AI Highlights" },
              ].map((item) => (
                <button 
                  key={item.id} 
                  className={`${styles.navItem} ${activeCollection === item.id ? styles.navActive : ""}`}
                  onClick={() => { setActiveCollection(item.id); setActiveCategory('all'); }}
                >
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
              {filteredSaves.map((save, i) => {
                const cat = CATEGORIES.find(c => c.id === inferCategory(save)) || CATEGORIES[CATEGORIES.length - 1];
                return (
                  <div
                    key={save.id || i}
                    className={styles.card}
                    style={{ "--delay": `${(i % 12) * 40}ms` }}
                    onClick={() => setSelectedSave(save)}
                  >
                    <div className={styles.cardThumb}>
                      <img
                        src={save.thumbnail_url || `https://images.weserv.nl/?url=https://www.instagram.com/p/${save.instagram_id}/media/?size=l&w=640&h=640&fit=cover`}
                        alt={save.caption || "Save"}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        style={{ display: 'block' }}
                        onError={(e) => { 
                          // If proxy fails, try one direct fallback then hide
                          if (e.target.src.includes('weserv.nl')) {
                            e.target.src = `https://www.instagram.com/p/${save.instagram_id}/media/?size=l`;
                          } else {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }
                        }}
                      />
                      <button 
                          className={`${styles.cardAction} ${save.likes > 0 ? styles.activeHeart : ""}`}
                          onClick={(e) => toggleLike(e, save)}
                        >
                          <Heart size={14} fill={save.likes > 0 ? "currentColor" : "none"} />
                        </button>
                      <div 
                        className={styles.cardPlaceholder} 
                        style={{ 
                          display: 'none',
                          background: `linear-gradient(135deg, ${cat.color}22, ${cat.color}44)` 
                        }}
                      >
                        <div className={styles.placeholderIcon} style={{ color: cat.color }}>
                          {cat.icon}
                        </div>
                        <p className={styles.placeholderText}>
                          {save.caption?.slice(0, 120) || "Knowledge Entry"}
                        </p>
                      </div>
                      {save.media_type === "VIDEO" && <span className={styles.cardBadgeVideo}><Film size={11} /> Video</span>}
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.cardMeta}>
                        <span className={styles.cardUser} style={{ color: cat.color }}>
                          {save.username ? `@${save.username}` : "Collection"}
                        </span>
                        <span className={styles.cardCat}>{cat.label}</span>
                      </div>
                      {save.caption && (
                        <p className={styles.cardCaption}>
                          <Highlight text={fixEncoding(save.caption)} query={searchQuery} />
                        </p>
                      )}
                      <div className={styles.cardFooter}>
                        <span className={styles.cardDate}>{formatDate(save.timestamp)}</span>
                        {save.permalink && (
                          <div className={styles.cardLinkIcon}><ExternalLink size={12} /></div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
                    <p className={styles.listCaption}>{fixEncoding(save.caption)?.slice(0, 120) || "No caption"}{save.caption?.length > 120 ? "…" : ""}</p>
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
          {/* Pagination */}
          {hasMore && filteredSaves.length > 0 && (
            <div className={styles.loadMoreWrap}>
              <button 
                className={styles.loadMoreBtn} 
                onClick={loadMore} 
                disabled={loading}
              >
                {loading ? <Loader2 size={18} className={styles.spinning} /> : "Load More"}
              </button>
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
              <img
                src={selectedSave.thumbnail_url || `https://images.weserv.nl/?url=https://www.instagram.com/p/${selectedSave.instagram_id}/media/?size=l&w=1080&h=1080&fit=cover`}
                alt=""
                className={styles.modalImg}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (e.target.src.includes('weserv.nl')) {
                    e.target.src = `https://www.instagram.com/p/${selectedSave.instagram_id}/media/?size=l`;
                  }
                }}
              />
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
                <p className={styles.modalCaption}>{fixEncoding(selectedSave.caption)}</p>
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
