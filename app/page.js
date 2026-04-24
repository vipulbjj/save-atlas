"use client";

import Image from "next/image";
import styles from "./page.module.css";
import { Folder, Sparkles, UploadCloud, Search, ArrowRight, LayoutGrid, Compass } from "lucide-react";

export default function Home() {
  const previewImages = [
    { src: "/modern_villa_facade_1777051470979.png", alt: "Modern Villa Facade" },
    { src: "/japandi_interior_1777051495653.png", alt: "Japandi Interior" },
    { src: "/concrete_staircase_1777051518775.png", alt: "Concrete Staircase" },
    { src: "/tropical_courtyard_1777051537632.png", alt: "Tropical Courtyard" },
    { src: "/wooden_ceiling_1777051553645.png", alt: "Wooden Ceiling" },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          SaveAtlas <span className={styles.logoDot}></span>
        </div>
        <nav className="flex gap-8 items-center text-sm font-medium">
          <a href="#features" className="hover:text-white text-[var(--text-secondary)] transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white text-[var(--text-secondary)] transition-colors">How it Works</a>
          <button className="btn-secondary">Log In</button>
        </nav>
      </header>

      <main>
        {/* Section 1 — Hero */}
        <section className={styles.hero}>
          <div className={styles.heroBackground}></div>
          <div className={`${styles.heroContent} animate-fade-in`}>
            <h1 className={styles.heroTitle}>
              Your Instagram saves <br />
              <span className="text-gradient font-serif italic">deserve better</span> than folders.
            </h1>
            <p className={styles.heroSubtitle}>
              AI organizes your architecture and design inspiration into a searchable, intelligent knowledge library.
            </p>
            <div className={styles.heroActions}>
              <button className="btn-primary">
                <UploadCloud size={18} />
                Import Saves
              </button>
              <button className="btn-secondary">
                View Demo
              </button>
            </div>
          </div>

          <div className={`${styles.heroVisual} animate-fade-in stagger-2`}>
            <div className={styles.moodboardPreview}>
              {previewImages.map((img, i) => (
                <div key={i} className={styles.previewItem}>
                  <Image src={img.src} alt={img.alt} fill className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 2 — Problem Visualization */}
        <section id="features" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>The Problem</span>
            <h2 className={styles.sectionTitle}>From generic folders to intelligent clusters</h2>
            <p className="text-[var(--text-secondary)]">
              Stop losing great ideas in endless generic collections. SaveAtlas understands the visual language of your saves and reorganizes them automatically.
            </p>
          </div>

          <div className={styles.comparisonContainer}>
            <div className={`${styles.comparisonBox} before`}>
              <h3>Before: Messy Folders</h3>
              <div className={styles.folderList}>
                {["Architecture", "House Ideas", "Cool Stuff", "Random", "Materials"].map((folder, i) => (
                  <div key={i} className={styles.folderItem}>
                    <Folder size={18} />
                    {folder}
                  </div>
                ))}
              </div>
            </div>

            <ArrowRight className="hidden md:block text-[var(--accent-bronze)]" size={32} />

            <div className={`${styles.comparisonBox} ${styles.after}`}>
              <h3>After: Smart Architecture Taxonomy</h3>
              <div className={styles.clusterList}>
                {["Residential Facades", "Japandi Interiors", "Natural Stone", "Concrete Textures", "Minimalist Bathrooms", "Hidden Lighting", "Courtyard Design"].map((tag, i) => (
                  <div key={i} className={styles.clusterTag}>
                    <Sparkles size={14} className="text-[var(--accent-emerald)]" />
                    {tag}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 — AI Categorization */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Vision AI</span>
            <h2 className={styles.sectionTitle}>Deep visual understanding</h2>
            <p className="text-[var(--text-secondary)]">
              Our vision models analyze materials, lighting, architectural styles, and spatial layouts to tag your saves with unprecedented accuracy.
            </p>
          </div>

          <div className={styles.aiAnalysis}>
            <div className={styles.aiImage}>
              <Image src="/modern_villa_facade_1777051470979.png" alt="AI Analysis" fill className="object-cover" />
              <div className={styles.scanningOverlay}></div>
              <div className={styles.aiPoints}>
                <div className={styles.aiPoint} style={{ top: '30%', left: '40%' }}></div>
                <div className={styles.aiPoint} style={{ top: '70%', left: '60%' }}></div>
                <div className={styles.aiPoint} style={{ top: '50%', left: '20%' }}></div>
              </div>
            </div>
            
            <div className={styles.aiDetails}>
              <div className={styles.detailCard}>
                <div className={styles.detailLabel}>Architectural Style</div>
                <div className={styles.detailValue}>
                  Modern Minimalist Villa <span className={styles.confidence}>98%</span>
                </div>
              </div>
              <div className={styles.detailCard}>
                <div className={styles.detailLabel}>Material Palette</div>
                <div className={styles.detailValue}>
                  Board-Formed Concrete, Natural Wood <span className={styles.confidence}>94%</span>
                </div>
              </div>
              <div className={styles.detailCard}>
                <div className={styles.detailLabel}>Lighting Concept</div>
                <div className={styles.detailValue}>
                  Warm Interior Glow, Twilight Exterior <span className={styles.confidence}>91%</span>
                </div>
              </div>
              <div className={styles.detailCard}>
                <div className={styles.detailLabel}>Spatial Elements</div>
                <div className={styles.detailValue}>
                  Large Glass Panels, Floating Staircase <span className={styles.confidence}>88%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5 — Search Experience */}
        <section className={styles.section}>
          <div className={`${styles.sectionHeader} ${styles.searchSection}`}>
            <span className={styles.sectionLabel}>Semantic Search</span>
            <h2 className={styles.sectionTitle}>Find exactly what you're looking for</h2>
            <p className="text-[var(--text-secondary)] mb-12">
              Search by visual language, material, or feeling. No more scrolling forever.
            </p>

            <div className={styles.searchBar}>
              <div className={styles.searchIcon}>
                <Search size={20} />
              </div>
              <input type="text" className={styles.searchInput} placeholder="Search 'warm minimalist villa with hidden lighting'..." />
            </div>

            <div className={styles.searchExamples}>
              {["stone staircase", "double-height living room", "wood ceiling detailing", "brutalist concrete facade"].map((example, i) => (
                <button key={i} className={styles.searchExample}>
                  {example}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
