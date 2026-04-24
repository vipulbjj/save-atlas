"use client";

import Image from "next/image";
import styles from "./dashboard.module.css";
import { 
  LayoutDashboard, FolderHeart, Sparkles, Box, Home, 
  TreePine, Building, Triangle, Heart, Lightbulb, 
  Search, Upload, User, Settings
} from "lucide-react";

export default function Dashboard() {
  const categories = [
    { name: "Dashboard", icon: <LayoutDashboard size={18} />, active: true },
    { name: "Collections", icon: <FolderHeart size={18} /> },
    { name: "AI Categories", icon: <Sparkles size={18} /> },
  ];

  const smartTags = [
    { name: "Materials", icon: <Box size={18} /> },
    { name: "Interiors", icon: <Home size={18} /> },
    { name: "Landscape", icon: <TreePine size={18} /> },
    { name: "Facades", icon: <Building size={18} /> },
    { name: "Structural Ideas", icon: <Triangle size={18} /> },
  ];

  const smartCollections = [
    { name: "Favorites", icon: <Heart size={18} /> },
    { name: "Emerging Taste Patterns", icon: <Lightbulb size={18} /> },
    { name: "Luxury Minimalism", icon: <FolderHeart size={18} /> },
  ];

  const aiClusters = [
    { name: "Natural Stone", count: 142, images: ["/concrete_staircase_1777051518775.png", "/tropical_courtyard_1777051537632.png"] },
    { name: "Japandi Living", count: 86, images: ["/japandi_interior_1777051495653.png", "/wooden_ceiling_1777051553645.png"] },
    { name: "Modern Courtyards", count: 54, images: ["/tropical_courtyard_1777051537632.png", "/modern_villa_facade_1777051470979.png"] },
    { name: "Minimalist Facades", count: 112, images: ["/modern_villa_facade_1777051470979.png", "/concrete_staircase_1777051518775.png"] },
  ];

  const feedItems = [
    { src: "/japandi_interior_1777051495653.png", tags: ["Interior", "Wood", "Minimal"], height: 350 },
    { src: "/modern_villa_facade_1777051470979.png", tags: ["Facade", "Concrete", "Lighting"], height: 280 },
    { src: "/concrete_staircase_1777051518775.png", tags: ["Staircase", "Brutalist", "Shadows"], height: 400 },
    { src: "/tropical_courtyard_1777051537632.png", tags: ["Courtyard", "Pool", "Tropical"], height: 300 },
    { src: "/wooden_ceiling_1777051553645.png", tags: ["Ceiling", "Wood", "Museum"], height: 380 },
    { src: "/modern_villa_facade_1777051470979.png", tags: ["Exterior", "Dusk"], height: 260 },
  ];

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
            <div key={i} className={`${styles.navItem} ${item.active ? styles.active : ''}`}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.name}
            </div>
          ))}
        </div>

        <div className={styles.navGroup}>
          <div className={styles.navTitle}>AI Taxonomy</div>
          {smartTags.map((item, i) => (
            <div key={i} className={styles.navItem}>
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

        <button className={styles.uploadButton}>
          <Upload size={18} />
          Upload Export
        </button>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <div className={styles.searchHeader}>
          <div className={styles.searchContainer}>
            <Search size={20} className="text-[var(--text-muted)]" />
            <input type="text" className={styles.searchInput} placeholder="Search your inspiration library..." />
          </div>
          <div className={styles.profileAvatar}>
            <User size={20} />
          </div>
        </div>

        <section className={styles.clustersSection}>
          <h2><Sparkles size={20} className="text-[var(--accent-emerald)]" /> AI Clusters</h2>
          <div className={styles.clustersGrid}>
            {aiClusters.map((cluster, i) => (
              <div key={i} className={styles.clusterCard}>
                <div className={styles.clusterHeader}>
                  <h3 className="font-medium">{cluster.name}</h3>
                  <span className={styles.clusterCount}>{cluster.count}</span>
                </div>
                <div className={styles.clusterImages}>
                  {cluster.images.map((img, j) => (
                    <img key={j} src={img} alt="Preview" />
                  ))}
                  <div className="flex-1 bg-[var(--bg-primary)] rounded-lg flex items-center justify-center text-xs text-[var(--text-muted)]">
                    +{cluster.count - 2}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.feedSection}>
          <h2>Recently Analyzed</h2>
          <div className={styles.masonryGrid}>
            {feedItems.map((item, i) => (
              <div key={i} className={styles.masonryItem} style={{ gridRowEnd: `span ${Math.ceil(item.height / 20)}` }}>
                <Image src={item.src} alt="Architecture save" fill />
                <div className={styles.itemOverlay}>
                  <div className={styles.itemTags}>
                    {item.tags.map((tag, j) => (
                      <span key={j} className={styles.itemTag}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
