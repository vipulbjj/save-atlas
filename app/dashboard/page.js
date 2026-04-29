"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./dashboard.module.css";
import {
  LayoutDashboard, FolderHeart, Sparkles, Box, Home,
  TreePine, Building, Triangle, Heart, Lightbulb,
  Search, Upload, User, RefreshCw, ExternalLink, ImageIcon
} from "lucide-react";

// Fallback mock images (only shown when no real data yet)
const MOCK_IMAGES = [
  { src: "/japandi_interior_1777051495653.png", tags: ["Interior", "Wood", "Minimal"] },
  { src: "/modern_villa_facade_1777051470979.png", tags: ["Facade", "Concrete", "Lighting"] },
  { src: "/concrete_staircase_1777051518775.png", tags: ["Staircase", "Brutalist", "Shadows"] },
  { src: "/tropical_courtyard_1777051537632.png", tags: ["Courtyard", "Pool", "Tropical"] },
  { src: "/wooden_ceiling_1777051553645.png", tags: ["Ceiling", "Wood", "Museum"] },
];

export default function Dashboard() {
  const [saves, setSaves] = useState([]);
  const [totalSaves, setTotalSaves] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [lastRefresh, setLastRefresh] = useState(null);

  const categories = [
    { name: "Dashboard", icon: <LayoutDashboard size={18} />, id: "all", active: true },
    { name: "Collections", icon: <FolderHeart size={18} />, id: "collections" },
    { name: "AI Categories", icon: <Sparkles size={18} />, id: "ai" },
  ];

  const smartTags = [
    { name: "Materials", icon: <Box size={18} />, filter: "materials" },
    { name: "Interiors", icon: <Home size={18} />, filter: "interiors" },
    { name: "Landscape", icon: <TreePine size={18} />, filter: "landscape" },
    { name: "Facades", icon: <Building size={18} />, filter: "facades" },
    { name: "Structural Ideas", icon: <Triangle size={18} />, filter: "structural" },
  ];

  const smartCollections = [
    { name: "Favorites", icon: <Heart size={18} /> },
    { name: "Emerging Taste Patterns", icon: <Lightbulb size={18} /> },
    { name: "Luxury Minimalism", icon: <FolderHeart size={18} /> },
  ];

  const fetchSaves = useCallback(async (query = "") => {
    try {
      setLoading(true);
      const url = `/api/saves?limit=50${query ? `&search=${encodeURIComponent(query)}` : ""}`;
      const res = await fetch(url);
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

  // Initial load
  useEffect(() => {
    fetchSaves();
  }, [fetchSaves]);

  // Auto-refresh every 30 seconds to pick up new synced saves
  useEffect(() => {
    const interval = setInterval(() => fetchSaves(searchQuery), 30000);
    return () => clearInterval(interval);
  }, [fetchSaves, searchQuery]);

  // Search debounce
  useEffect(() => {
    const timeout = setTimeout(() => fetchSaves(searchQuery), 400);
    return () => clearTimeout(timeout);
  }, [searchQuery, fetchSaves]);

  // Build AI clusters from real data
  const buildClusters = () => {
    if (saves.length === 0) return [];
    const grouped = {};
    for (const save of saves) {
      const category = save.ai_category || inferCategory(save);
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(save);
    }
    return Object.entries(grouped)
      .map(([name, items]) => ({ name, count: items.length, items }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  };

  const inferCategory = (save) => {
    const text = `${save.caption || ""} ${(save.hashtags || []).join(" ")}`.toLowerCase();
    if (text.match(/interior|living|bedroom|kitchen|sofa|furniture/)) return "Interiors";
    if (text.match(/facade|exterior|house|villa|building|architecture/)) return "Facades";
    if (text.match(/garden|landscape|tree|plant|outdoor|courtyard/)) return "Landscape";
    if (text.match(/stair|ceiling|floor|material|stone|concrete|wood/)) return "Materials";
    return "Architecture";
  };

  const aiClusters = saves.length > 0 ? buildClusters() : [];
  const feedItems = saves.length > 0 ? saves : [];
  const hasRealData = saves.length > 0;

  return (
    <div className={styles.dashboardContainer}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          SaveAtlas <span className={styles.logoDot}></span>
        </div>

        <div className={styles.navGroup}>
          <div className={styles.navTitle}>Overview</div>
          {categories.map((item, i) => (
            <div
              key={i}
              className={`${styles.navItem} ${activeCategory === item.id ? styles.active : ""}`}
              onClick={() => setActiveCategory(item.id)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.name}
            </div>
          ))}
        </div>

        <div className={styles.navGroup}>
          <div className={styles.navTitle}>AI Taxonomy</div>
          {smartTags.map((item, i) => (
            <div key={i} className={styles.navItem} onClick={() => setSearchQuery(item.filter)}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.name}
            </div>
          ))}
        </div>

        <div className={styles.navGroup}>
          <div className={styles.navTitle}>Smart Collections</div>
          {smartCollections.map((item, i) => (
            <div key={i} className={styles.navItem}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.name}
            </div>
          ))}
        </div>

        <div className={styles.sidebarStats}>
          <div className={styles.statRow}>
            <span>Total Saves</span>
            <strong>{totalSaves}</strong>
          </div>
          {lastRefresh && (
            <div className={styles.statRow}>
              <span>Last updated</span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {lastRefresh.toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        <button className={styles.uploadButton}>
          <Upload size={18} />
          Upload Export
        </button>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <div className={styles.searchHeader}>
          <div className={styles.searchContainer}>
            <Search size={20} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search your inspiration library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            className={styles.refreshButton}
            onClick={() => fetchSaves(searchQuery)}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? styles.spinning : ""} />
          </button>
          <div className={styles.profileAvatar}>
            <User size={20} />
          </div>
        </div>

        {/* Empty state — waiting for first sync */}
        {!loading && !hasRealData && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><ImageIcon size={48} /></div>
            <h2>No saves synced yet</h2>
            <p>Install the SaveAtlas Chrome extension and browse Instagram Saved posts to start syncing your architecture library.</p>
            <a href="https://www.instagram.com/your_activity/saved/" target="_blank" className={styles.emptyAction}>
              <ExternalLink size={16} /> Open Instagram Saved
            </a>
          </div>
        )}

        {/* AI Clusters — only shown when real data exists */}
        {hasRealData && aiClusters.length > 0 && (
          <section className={styles.clustersSection}>
            <h2><Sparkles size={20} /> AI Clusters</h2>
            <div className={styles.clustersGrid}>
              {aiClusters.map((cluster, i) => (
                <div key={i} className={styles.clusterCard} onClick={() => setSearchQuery(cluster.name)}>
                  <div className={styles.clusterHeader}>
                    <h3>{cluster.name}</h3>
                    <span className={styles.clusterCount}>{cluster.count}</span>
                  </div>
                  <div className={styles.clusterImages}>
                    {cluster.items.slice(0, 2).map((save, j) => (
                      save.thumbnail_url ? (
                        <img key={j} src={save.thumbnail_url} alt={save.caption || "Save"} crossOrigin="anonymous" />
                      ) : (
                        <div key={j} className={styles.clusterImagePlaceholder}>
                          <ImageIcon size={20} />
                        </div>
                      )
                    ))}
                    {cluster.count > 2 && (
                      <div className={styles.clusterMore}>+{cluster.count - 2}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Feed — real data */}
        {hasRealData && (
          <section className={styles.feedSection}>
            <h2>
              Recently Synced
              {loading && <RefreshCw size={14} className={styles.spinning} style={{ marginLeft: 8, opacity: 0.5 }} />}
            </h2>
            <div className={styles.masonryGrid}>
              {feedItems.map((save, i) => (
                <div
                  key={save.id || i}
                  className={styles.masonryItem}
                  style={{ gridRowEnd: `span ${Math.ceil((280 + (i % 3) * 80) / 20)}` }}
                >
                  {save.thumbnail_url ? (
                    <img
                      src={save.thumbnail_url}
                      alt={save.caption || "Instagram save"}
                      crossOrigin="anonymous"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  ) : (
                    <div className={styles.imagePlaceholder}>
                      <ImageIcon size={32} />
                    </div>
                  )}
                  <div className={styles.itemOverlay}>
                    <div className={styles.itemMeta}>
                      {save.username && <span className={styles.itemUsername}>@{save.username}</span>}
                      {save.permalink && (
                        <a href={save.permalink} target="_blank" className={styles.itemLink} onClick={e => e.stopPropagation()}>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <div className={styles.itemTags}>
                      {(save.ai_tags?.length > 0 ? save.ai_tags : save.hashtags || []).slice(0, 3).map((tag, j) => (
                        <span key={j} className={styles.itemTag}>{tag.replace("#", "")}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Loading skeleton */}
        {loading && !hasRealData && (
          <section className={styles.feedSection}>
            <h2>Loading your library...</h2>
            <div className={styles.masonryGrid}>
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className={`${styles.masonryItem} ${styles.skeleton}`} style={{ gridRowEnd: `span ${Math.ceil((280 + (i % 3) * 80) / 20)}` }} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
