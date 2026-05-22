"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Search, Grid as GridIcon, List, SortAsc, RefreshCw, ChevronDown, 
  Settings, Bell, Layers, ExternalLink, Heart, Clock, X, Image, Film, 
  ArrowUpRight, Sparkles, Lightbulb, Loader2, UploadCloud, LogOut, Menu
} from "lucide-react";
import styles from "./dashboard.module.css";
import { createClient } from "@/lib/supabase-client";

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

const saveImageAlt = (save) =>
  save.caption
    ? fixEncoding(save.caption).slice(0, 80)
    : `Instagram save by @${save.username || "user"}`;

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

const DEMO_SAVES = [
  {
    id: "demo_1",
    instagram_id: "demo1",
    thumbnail_url: "/modern_villa_facade_1777051470979.png",
    username: "architecture_daily",
    caption: "Stunning modern minimal villa with raw concrete and expansive glass #architecture #minimal",
    ai_category: "home-design",
    likes: 1,
    timestamp: new Date().toISOString()
  },
  {
    id: "demo_2",
    instagram_id: "demo2",
    thumbnail_url: "/japandi_interior_1777051495653.png",
    username: "japandi_homes",
    caption: "Perfect blend of Japanese minimalism and Scandinavian functionality. The warm wood tones are incredible.",
    ai_category: "home-design",
    likes: 0,
    timestamp: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: "demo_3",
    instagram_id: "demo3",
    thumbnail_url: "/concrete_staircase_1777051518775.png",
    username: "brutal_architecture",
    caption: "Board-formed concrete floating staircase detail. Brutal yet refined.",
    ai_category: "home-design",
    likes: 1,
    timestamp: new Date(Date.now() - 186400000).toISOString()
  },
  {
    id: "demo_4",
    instagram_id: "demo4",
    thumbnail_url: "/tropical_courtyard_1777051537632.png",
    username: "tropical_spaces",
    caption: "Bringing the outside in. This internal courtyard is an absolute dream oasis.",
    ai_category: "travel",
    likes: 0,
    timestamp: new Date(Date.now() - 286400000).toISOString()
  },
  {
    id: "demo_5",
    instagram_id: "demo5",
    thumbnail_url: "/wooden_ceiling_1777051553645.png",
    username: "interior_details",
    caption: "Slatted wood ceiling treatment that completely transforms the acoustic and visual space of this room.",
    ai_category: "home-design",
    likes: 0,
    timestamp: new Date(Date.now() - 386400000).toISOString()
  }
];

const DEMO_STATS = {
  total: 5,
  photos: 5,
  videos: 0,
  categories: { "home-design": 4, "travel": 1 },
  subCategories: { "home-design": { "architecture": 2, "interiors": 2 }, "travel": { "stays": 1 } }
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [importBanner, setImportBanner] = useState(null);

  const searchRef = useRef(null);
  const sortRef = useRef(null);
  const activeRequestRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const imported = params.get("imported");
    if (imported) {
      setImportBanner(`Imported ${imported} saves — try search: villa, startup, travel`);
      params.delete("imported");
      const qs = params.toString();
      const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'true';
      if (isDemo) {
        setUserEmail("demo@saveatlas.com");
        return;
      }
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setUserEmail(user.email);
        }
      } catch (err) {
        console.error("Error fetching user client-side:", err);
      }
    };
    fetchUser();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (data.ok) {
        setGlobalStats(data.stats);
        if (data.email) setUserEmail(data.email);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  const fetchSaves = useCallback(async (query = "", cat = "all", sub = "all", coll = "all", media = "all", reset = false) => {
    const requestId = ++activeRequestRef.current;
    try {
      setLoading(true);
      if (reset) setSaves([]); // Immediate clear for snappy feel
      
      const currentPage = reset ? 1 : page;
      const params = new URLSearchParams({ 
        limit: "50", 
        page: currentPage.toString(),
      });
      
      if (query) params.set("search", query);
      if (cat !== "all") params.set("category", cat);
      if (sub !== "all") params.set("subcategory", sub);
      if (coll !== "all") params.set("collection", coll);
      if (media !== "all") params.set("media_type", media);
      
      const res = await fetch(`/api/saves?${params}`);
      const data = await res.json();
      
      if (requestId !== activeRequestRef.current) {
        // Discard stale out-of-order response to prevent race conditions
        return;
      }
      
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
      if (requestId === activeRequestRef.current) {
        setLoading(false);
      }
    }
  }, [page]);

  useEffect(() => { 
    const isDemo = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === 'true';
    if (isDemo) {
      setGlobalStats(DEMO_STATS);
      
      let filteredDemo = DEMO_SAVES;
      if (activeCategory !== "all") {
        filteredDemo = filteredDemo.filter(s => inferCategory(s) === activeCategory);
      }
      if (debouncedSearchQuery) {
        const q = debouncedSearchQuery.toLowerCase();
        filteredDemo = filteredDemo.filter(s => (s.caption || "").toLowerCase().includes(q));
      }
      
      setSaves(filteredDemo);
      setTotalSaves(filteredDemo.length);
      setHasMore(false);
      setLoading(false);
      return;
    }

    fetchStats();
    fetchSaves(debouncedSearchQuery, activeCategory, activeSubCategory, activeCollection, mediaFilter, true); 
    setPage(1);
  }, [debouncedSearchQuery, activeCategory, activeSubCategory, activeCollection, mediaFilter]);

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  useEffect(() => {
    if (page > 1) {
      fetchSaves(debouncedSearchQuery, activeCategory, activeSubCategory, activeCollection, mediaFilter, false);
    }
  }, [page, debouncedSearchQuery, activeCategory, activeSubCategory, activeCollection, mediaFilter]);

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

  const filteredSaves = [...saves]
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
      // Cmd+K or Ctrl+K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      
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

  const statsArr = [
    { label: "Total Saves", value: globalStats.total ?? 0 },
    { label: "Categories", value: globalStats.categories ? Object.keys(globalStats.categories).length : 0 },
    { label: "Photos", value: globalStats.photos ?? 0 },
    { label: "Videos", value: globalStats.videos ?? 0 },
  ];

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
              <span className={styles.navLabel}>Library</span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  className={`${styles.navItem} ${activeCategory === cat.id && activeCollection === 'all' ? styles.navActive : ""}`}
                  onClick={() => { setActiveCategory(cat.id); setActiveCollection('all'); setActiveSubCategory('all'); setSidebarOpen(false); }}
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
                  onClick={() => { setActiveCollection(item.id); setActiveCategory('all'); setActiveSubCategory('all'); setSidebarOpen(false); }}
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
          <p className={styles.sidebarVersion}>v2.4.0 • Pro</p>
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
              placeholder="Search library with AI intelligence..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className={styles.searchClear} onClick={() => setSearchQuery("")}>
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
              <p className={styles.subtitle}>
                {globalStats.total || 0} Instagram saves — search across travel, startups, design, and more
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

          {loading && saves.length === 0 ? (
            <div className={styles.loaderWrap}>
              <Loader2 className={styles.spinning} size={40} />
              <p>AI is scouring your library...</p>
            </div>
          ) : saves.length === 0 ? (
            globalStats.total > 0 ? (
              <div className={styles.emptyState}>
                <Layers size={48} className={styles.emptyIcon} />
                <h2>No items match your filters</h2>
                <p>Try adjusting your search or clearing your active filters to view your saves.</p>
                <button
                  className={styles.emptyBtn}
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("all");
                    setActiveSubCategory("all");
                    setActiveCollection("all");
                    setMediaFilter("all");
                  }}
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
              </div>
            )
          ) : viewMode === "grid" ? (
            <div className={styles.grid}>
              {filteredSaves.map((save, i) => {
                const cat = CATEGORIES.find(c => c.id === inferCategory(save)) || CATEGORIES[CATEGORIES.length - 1];
                return (
                  <div key={save.id || i} className={styles.card} onClick={() => setSelectedSave(save)}>
                    <div className={styles.cardThumb}>
                      <img
                        src={save.thumbnail_url || `https://images.weserv.nl/?url=https://www.instagram.com/p/${save.instagram_id}/media/?size=l&w=640&h=640&fit=cover`}
                        alt={saveImageAlt(save)}
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
                      alt={saveImageAlt(save)}
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
