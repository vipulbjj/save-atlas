"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, Lock, Loader2, Sparkles } from "lucide-react";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate network delay for premium feel
    setTimeout(() => {
      router.push("/dashboard");
    }, 1200);
  };

  return (
    <div className={styles.container}>
      <div className={styles.background}>
        <div className={styles.glowTop}></div>
        <div className={styles.glowBottom}></div>
      </div>
      
      <div className={styles.nav}>
        <a href="/" className={styles.logo}>
          SaveAtlas <span className={styles.logoDot}></span>
        </a>
      </div>

      <main className={styles.main}>
        <div className={styles.loginCard}>
          <div className={styles.cardHeader}>
            <div className={styles.iconWrapper}>
              <Sparkles size={24} className="text-[var(--accent-bronze)]" />
            </div>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>Enter your details to access your library</p>
          </div>

          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email address</label>
              <div className={styles.inputWrapper}>
                <Mail size={18} className={styles.inputIcon} />
                <input 
                  type="email" 
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.passwordHeader}>
                <label htmlFor="password">Password</label>
                <a href="#" className={styles.forgotLink}>Forgot?</a>
              </div>
              <div className={styles.inputWrapper}>
                <Lock size={18} className={styles.inputIcon} />
                <input 
                  type="password" 
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className={styles.signupText}>
            Don't have an account? <a href="#">Request Access</a>
          </p>
        </div>
      </main>
    </div>
  );
}
