"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import styles from "./page.module.css";
import { 
  Folder, Sparkles, UploadCloud, Search, ArrowRight, LayoutGrid, 
  Compass, ShieldCheck, Database, LogOut, LayoutDashboard
} from "lucide-react";
import { createClient } from "@/lib/supabase-client";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        setIsLoggedIn(!!session);
      } catch (err) {
        console.error("Error checking session on homepage:", err);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setIsLoggedIn(false);
      window.location.reload();
    } catch (err) {
      console.error("Failed to log out from homepage:", err);
    }
  };

  const previewImages = [
    { src: "/modern_villa_facade_1777051470979.png", alt: "Modern Villa Facade" },
    { src: "/japandi_interior_1777051495653.png", alt: "Japandi Interior" },
    { src: "/concrete_staircase_1777051518775.png", alt: "Concrete Staircase" },
    { src: "/tropical_courtyard_1777051537632.png", alt: "Tropical Courtyard" },
    { src: "/wooden_ceiling_1777051553645.png", alt: "Wooden Ceiling" },
  ];

  return (
    <div className={styles.container}>
      {/* Background radial glows */}
      <div className={styles.backgroundGlows}>
        <div className={styles.glowTop}></div>
        <div className={styles.glowMiddle}></div>
        <div className={styles.glowBottom}></div>
      </div>

      <header className={styles.header}>
        <a href="/" className={styles.logo}>
          SaveAtlas <span className={styles.logoDot}></span>
        </a>
        <nav className={styles.nav}>
          <a href="#features" className={styles.navLink}>Features</a>
          <a href="#how-it-works" className={styles.navLink}>How it Works</a>
          <a href="#vision" className={styles.navLink}>Vision AI</a>
          {!loading && (
            isLoggedIn ? (
              <>
                <a href="/dashboard" className={styles.btnSecondary}>
                  <LayoutDashboard size={15} /> Dashboard
                </a>
                <button onClick={handleLogout} className={styles.btnSecondary} style={{ gap: '6px' }}>
                  <LogOut size={15} /> Log Out
                </button>
              </>
            ) : (
              <a href="/login" className={styles.btnSecondary}>Log In</a>
            )
          )}
        </nav>
      </header>

      <main>
        {/* Section 1 — Hero */}
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              Turn your Instagram saves <br />
              <span className={styles.textGradient}>into an intelligent knowledge base.</span>
            </h1>
            <p className={styles.heroSubtitle}>
              SaveAtlas automatically visualizes and categorizes your bookmarks—from design inspirations and YC startup lessons to travel gems—into a searchable visual library.
            </p>
            <div className={styles.heroActions}>
              {isLoggedIn ? (
                <>
                  <a href="/dashboard" className={styles.btnPrimary}>
                    <LayoutDashboard size={18} />
                    Go to Dashboard
                  </a>
                  <button onClick={handleLogout} className={styles.btnSecondary}>
                    <LogOut size={18} />
                    Log Out Account
                  </button>
                </>
              ) : (
                <>
                  <a href="/import" className={styles.btnPrimary}>
                    <UploadCloud size={18} />
                    Build My Library
                  </a>
                  <a href="/dashboard?demo=true" className={styles.btnSecondary}>
                    Explore Demo
                  </a>
                </>
              )}
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.moodboardPreview}>
              {previewImages.map((img, i) => (
                <div key={i} className={styles.previewItem}>
                  <Image src={img.src} alt={img.alt} fill className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 2 — Bento Grid Features */}
        <section id="features" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Core Strengths</span>
            <h2 className={styles.sectionTitle}>Stop scrolling, start organizing.</h2>
            <p className={styles.sectionDesc}>
              Stop digging through thousands of chaotic Instagram folders. SaveAtlas clusters your bookmarks and enables semantic intelligence.
            </p>
          </div>

          <div className={styles.bentoGrid}>
            <div className={`${styles.bentoCard} ${styles.bentoCol2}`}>
              <div>
                <div className={styles.bentoIcon}>
                  <Sparkles size={20} />
                </div>
                <h3 className={styles.bentoTitle}>AI-Driven Taxonomy</h3>
                <p className={styles.bentoDesc}>
                  No manual tags required. Our AI scans image contents, titles, and tags to classify everything automatically into logical verticals.
                </p>
              </div>
              <div className={styles.bentoVisualTags}>
                <span className={`${styles.bentoTag} ${styles.bentoTagActive}`}>
                  <Sparkles size={12} /> Tech & AI
                </span>
                <span className={styles.bentoTag}>Home & Design</span>
                <span className={styles.bentoTag}>Startup Lessons</span>
                <span className={styles.bentoTag}>Travel & Places</span>
                <span className={styles.bentoTag}>Lifestyle</span>
              </div>
            </div>

            <div className={styles.bentoCard}>
              <div>
                <div className={styles.bentoIcon}>
                  <ShieldCheck size={20} />
                </div>
                <h3 className={styles.bentoTitle}>Local Privacy</h3>
                <p className={styles.bentoDesc}>
                  Your raw ZIP file parsing occurs entirely locally. We prioritize secure authentication and full user ownership.
                </p>
              </div>
            </div>

            <div className={styles.bentoCard}>
              <div>
                <div className={styles.bentoIcon}>
                  <Database size={20} />
                </div>
                <h3 className={styles.bentoTitle}>High Volume Sync</h3>
                <p className={styles.bentoDesc}>
                  Supports parsing massive bookmark histories (1,000+ saves) with high-efficiency chunked uploads and caching.
                </p>
              </div>
            </div>

            <div className={`${styles.bentoCard} ${styles.bentoCol2}`}>
              <div>
                <div className={styles.bentoIcon}>
                  <Search size={20} />
                </div>
                <h3 className={styles.bentoTitle}>Smart Synonym Mapping</h3>
                <p className={styles.bentoDesc}>
                  Type intuitive thoughts like "villa" or "stays" and witness the AI instantly return premium records mapped under "luxury" or "travel."
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 — How it Works */}
        <section id="how-it-works" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>The Protocol</span>
            <h2 className={styles.sectionTitle}>Simple and highly secure.</h2>
            <p className={styles.sectionDesc}>
              No third-party logins or screen scrapes. Request your official archive from Instagram, drop it, and explore.
            </p>
          </div>

          <div className={styles.howItWorksGrid}>
            <div className={styles.howItWorksCard}>
              <div className={styles.howItWorksNumber}>01</div>
              <h3 className={styles.howItWorksTitle}>Request Data</h3>
              <p className={styles.howItWorksDesc}>Request your official JSON files directly from your Instagram Account Settings.</p>
            </div>
            <div className={styles.howItWorksCard}>
              <div className={styles.howItWorksNumber}>02</div>
              <h3 className={styles.howItWorksTitle}>Upload Zip</h3>
              <p className={styles.howItWorksDesc}>Upload the ZIP. Our local parser processes all files directly within the client.</p>
            </div>
            <div className={styles.howItWorksCard}>
              <div className={styles.howItWorksNumber}>03</div>
              <h3 className={styles.howItWorksTitle}>AI Visualization</h3>
              <p className={styles.howItWorksDesc}>Explore a premium, categorized library with interactive semantic searches.</p>
            </div>
          </div>
        </section>

        {/* Section 4 — Vision AI */}
        <section id="vision" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Visual Intelligence</span>
            <h2 className={styles.sectionTitle}>Deep Multi-Modal Understanding</h2>
            <p className={styles.sectionDesc}>
              Our vision models parse layout elements, color tones, text, and materials to classify with stunning accuracy.
            </p>
          </div>

          <div className={styles.aiAnalysis}>
            <div className={styles.aiImage}>
              <Image src="/modern_villa_facade_1777051470979.png" alt="AI Analysis Visualization" fill className="object-cover" />
              <div className={styles.scanningOverlay}></div>
              <div className={styles.aiPoints}>
                <div className={styles.aiPoint} style={{ top: '35%', left: '45%' }}></div>
                <div className={styles.aiPoint} style={{ top: '65%', left: '55%' }}></div>
                <div className={styles.aiPoint} style={{ top: '48%', left: '22%' }}></div>
              </div>
            </div>
            
            <div className={styles.aiDetails}>
              <div className={styles.detailCard}>
                <div className={styles.detailLabel}>Detected Architecture</div>
                <div className={styles.detailValue}>
                  Modern Minimalist Villa <span className={styles.confidence}>98% Confidence</span>
                </div>
              </div>
              <div className={styles.detailCard}>
                <div className={styles.detailLabel}>Visual Textures</div>
                <div className={styles.detailValue}>
                  Polished Concrete & Wood <span className={styles.confidence}>94% Confidence</span>
                </div>
              </div>
              <div className={styles.detailCard}>
                <div className={styles.detailLabel}>Categorization</div>
                <div className={styles.detailValue}>
                  Home & Design <span className={styles.confidence}>99% Confidence</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5 — Call to Action */}
        <section className={styles.section}>
          <div className={styles.ctaCard}>
            <div className={styles.ctaGlow}></div>
            <h2 className={styles.ctaTitle}>Ready to unlock your archives?</h2>
            <p className={styles.ctaDesc}>
              Join thousands of creators, designers, and startup founders who organize their bookmarks into clean, beautiful libraries.
            </p>
            <div className={styles.ctaActions}>
              {isLoggedIn ? (
                <a href="/dashboard" className={styles.btnPrimary}>
                  <LayoutDashboard size={18} />
                  Go to Dashboard
                </a>
              ) : (
                <>
                  <a href="/import" className={styles.btnPrimary}>
                    <UploadCloud size={18} />
                    Build My Library
                  </a>
                  <a href="/dashboard?demo=true" className={styles.btnSecondary}>
                    Explore Demo
                  </a>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerLogo}>SaveAtlas</div>
          <div className={styles.footerCopy}>© {new Date().getFullYear()} SaveAtlas. Premium Instagram Saves Organizer.</div>
          <div className={styles.footerLinks}>
            <a href="#features" className={styles.footerLink}>Features</a>
            <a href="#how-it-works" className={styles.footerLink}>How it Works</a>
            <a href="/login" className={styles.footerLink}>Account</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
