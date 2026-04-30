"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Search, Grid as GridIcon, List, SortAsc, RefreshCw, ChevronDown, 
  Settings, Bell, Layers, ExternalLink, Heart, Clock, X, Image, Film, 
  ArrowUpRight, Sparkles, Lightbulb, Loader2
} from "lucide-react";
import styles from "./dashboard.module.css";

// Utility to fix Instagram's garbled UTF-8 encoding (mojibake)
const fixEncoding = (str) => {
  if (!str) return "";
  try {
    const bytes = new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return str;
  }
};

const CATEGORIES = [
  { id: "all", label: "All Saves", icon: <Layers size={15} />, color: "#B08D6A" },
  { id: "tech-ai", label: "Tech & AI", icon: <Sparkles size={15} />, color: "#6A8DB0" },
  { id: "business", label: "Business & Startups", icon: <ArrowUpRight size={15} />, color: "#B06A6A" },
  { id: "lifestyle", label: "Lifestyle & Growth", icon: <Heart size={15} />, color: "#8DB06A" },
  { id: "travel", label: "Travel & Stays", icon: <ArrowUpRight size={15} />, color: "#6AB0A8" },
  { id: "home-design", label: "Home & Design", icon: <Layers size={15} />, color: "#B0A86A" },
  { id: "other", label: "Everything Else", icon: <Layers size={15} />, color: "#888888" },
];

const inferCategory = (save) => {
  return save.ai_category || "other";
};

const formatDate = (ts) => {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", { 
    month: "short", day: "numeric", year: "numeric" 
  });
};

const Highlight = ({ text, query }) => {
  if (!query) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
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

const SUBCATEGORIES = {
  "tech-ai": [
    { id: "ai-tools", label: "AI Tools" },
    { id: "coding", label: "Coding" },
    { id: "productivity", label: "Productivity" },
    { id: "future", label: "Future Tech" }
  ],
  "business": [
    { id: "founders", label: "Founders" },
    { id: "marketing", label: "Marketing" },
    { id: "finance", label: "Finance" },
    { id: "strategy", label: "Strategy" }
  ],
  "lifestyle": [
    { id: "mindset", label: "Mindset" },
    { id: "family", label: "Family" },
    { id: "wellness", label: "Wellness" },
    { id: "personal-finance", label: "Money" }
  ],
  "travel": [
    { id: "destinations", label: "Places" },
    { id: "stays", label: "Stays" },
    { id: "tips", label: "Tips" },
    { id: "nature", label: "Nature" }
  ],
  "home-design": [
    { id: "architecture", label: "Architecture" },
    { id: "interiors", label: "Interiors" },
    { id: "decor", label: "Decor" },
    { id: "lighting", label: "Lighting" }
  ]
};

export default function Dashboard() {
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeCollection, setActiveCollection] = useState("all");
  const [activeSubCategory, setActiveSubCategory] = useState("all");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [viewMode, setViewMode] = useState("grid");
  const [selectedSave, setSelectedSave] = useState(null);
  const [showSort, setShowSort] = useState(false);
  const [totalSaves, setTotalSaves] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [globalStats, setGlobalStats] = useState({ total: 0, photos: 0, videos: 0, categories: {}, subCategories: {} });

  const searchRef = useRef(null);
  const sortRef = useRef(null);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (data.ok) setGlobalStats(data.stats);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  const fetchSaves = useCallback(async (query = "", cat = "all", sub = "all", coll = "all", reset = false) => {
    try {
      setLoading(true);
      const currentPage = reset ? 1 : page;
      const params = new URLSearchParams({ 
        limit: "50", 
        page: currentPage.toString(),
      });
      
      if (query) params.set("search", query);
      if (cat !== "all") params.set("category", cat);
      if (sub !== "all") params.set("subcategory", sub);
      
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
    fetchSaves(searchQuery, activeCategory, activeSubCategory, activeCollection, true); 
    setPage(1);
  }, [searchQuery, activeCategory, activeSubCategory, activeCollection]);

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  useEffect(() => {
    if (page > 1) {
      fetchSaves(searchQuery, activeCategory, activeSubCategory, activeCollection, false);
    }
  }, [page]);

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

  useEffect(() => {
    const handler = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setShowSort(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const hasRealData = saves.length > 0;

  const statsArr = [
    { label: "Total Saves", value: globalStats.total || "—" },
    { label: "Categories", value: hasRealData ? Object.keys(globalStats.categories).length : "—" },
    { label: "Photos", value: globalStats.photos || "—" },
    { label: "Videos", value: globalStats.videos || "—" },
  ];

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <a href="/" className={styles.logo}>
            <span className={styles.logoMark}>SA</span>
            <span>SaveAtlas</span>
          </a>

          <nav className={styles.nav}>
            <div className={styles.navSection}>
              <span className={styles.navLabel}>Library</span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className={`${styles.navItem} ${activeCategory === cat.id && activeCollection === 'all' ? styles.navActive : ""}`}
                  onClick={() => { setActiveCategory(cat.id); setActiveCollection('all'); setActiveSubCategory('all'); }}
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
                  onClick={() => { setActiveCollection(item.id); setActiveCategory('all'); setActiveSubCategory('all'); }}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>

        <div className={styles.sidebarBottom}>
          <div className={styles.sidebarStatus}>
            <div className={styles.statusDot}></div>
            <span>System Online</span>
          </div>
          <p className={styles.sidebarVersion}>v2.4.0 • Pro</p>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.searchBar}>
            <Search className={styles.searchIcon} size={18} />
            <input 
              ref={searchRef}
              type="text" 
              placeholder="Search your knowledge... ( / )" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className={styles.searchClear} onClick={() => setSearchQuery("")}>
                <X size={14} />
              </button>
            )}
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.welcome}>
            <div>
              <h1 className={styles.title}>Knowledge Library</h1>
              <p className={styles.subtitle}>
                Exploring {globalStats.total || 0} curated architectural & tech insights
              </p>
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

          {activeCategory !== 'all' && SUBCATEGORIES[activeCategory] && (
            <div className={styles.subToolbar}>
              <button 
                className={`${styles.subTab} ${activeSubCategory === 'all' ? styles.subTabActive : ""}`}
                onClick={() => setActiveSubCategory('all')}
              >
                All {CATEGORIES.find(c => c.id === activeCategory)?.label}
              </button>
              {SUBCATEGORIES[activeCategory].map((sub) => (
                <button 
                  key={sub.id}
                  className={`${styles.subTab} ${activeSubCategory === sub.id ? styles.subTabActive : ""}`}
                  onClick={() => setActiveSubCategory(sub.id)}
                >
                  {sub.label}
                  {globalStats.subCategories[activeCategory]?.[sub.id] > 0 && (
                    <span className={styles.subBadge}>{globalStats.subCategories[activeCategory][sub.id]}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {viewMode === "grid" ? (
            <div className={styles.grid}>
              {filteredSaves.map((save, i) => {
                const cat = CATEGORIES.find(c => c.id === inferCategory(save)) || CATEGORIES[CATEGORIES.length - 1];
                return (
                  <div key={save.id || i} className={styles.card} onClick={() => setSelectedSave(save)}>
                    <div className={styles.cardThumb}>
                      <img
                        src={save.thumbnail_url || `https://images.weserv.nl/?url=https://www.instagram.com/p/${save.instagram_id}/media/?size=l&w=640&h=640&fit=cover`}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => { 
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
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.cardMeta}>
                        <span className={styles.cardUser} style={{ color: cat.color }}>@{save.username || "user"}</span>
                        <span className={styles.cardCat}>{cat.label}</span>
                      </div>
                      <p className={styles.cardCaption}>
                        <Highlight text={fixEncoding(save.caption)} query={searchQuery} />
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
                      alt="" 
                      referrerPolicy="no-referrer"
                      loading="lazy" 
                    />
                  </div>
                  <div className={styles.listMeta}>
                    <span className={styles.listUser}>@{save.username || "unknown"}</span>
                    <p className={styles.listCaption}>{fixEncoding(save.caption)?.slice(0, 120)}...</p>
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
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelectedSave(null)}><X size={18} /></button>
            <div className={styles.modalLeft}>
              <img
                src={selectedSave.thumbnail_url || `https://images.weserv.nl/?url=https://www.instagram.com/p/${selectedSave.instagram_id}/media/?size=l&w=1080&h=1080&fit=cover`}
                alt=""
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
