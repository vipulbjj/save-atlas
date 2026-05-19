"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, Lock, Loader2, Sparkles } from "lucide-react";
import styles from "./login.module.css";

import { createClient } from "@/lib/supabase-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    
    const supabase = createClient();
    
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        // Proceed to dashboard, user session should be created
        router.push("/dashboard");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to authenticate.");
      setLoading(false);
    }
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
            <h1 className={styles.title}>{isSignUp ? "Create an account" : "Welcome back"}</h1>
            <p className={styles.subtitle}>{isSignUp ? "Enter your details to create your library" : "Enter your details to access your library"}</p>
          </div>

          <form onSubmit={handleAuth} className={styles.form}>
            {errorMsg && (
              <div style={{ color: '#ff6b6b', background: 'rgba(255,107,107,0.1)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '16px' }}>
                {errorMsg}
              </div>
            )}
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
                  {isSignUp ? "Sign Up" : "Sign In"} <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className={styles.signupText}>
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
            <a href="#" onClick={(e) => { e.preventDefault(); setIsSignUp(!isSignUp); setErrorMsg(""); }}>
              {isSignUp ? "Sign In" : "Request Access"}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
