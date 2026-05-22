"use client";

import { useState } from "react";
import { Mail, Loader2, ArrowRight } from "lucide-react";
import styles from "./forgot.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not send reset email.");
      }
      setSent(true);
    } catch (err) {
      setErrorMsg(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.nav}>
        <a href="/" className={styles.logo}>
          SaveAtlas <span className={styles.logoDot}></span>
        </a>
      </div>

      <main className={styles.main}>
        <div className={styles.card}>
          {sent ? (
            <div className={styles.success}>
              <h1 className={styles.title}>Check your email</h1>
              <p>
                If an account exists for <strong>{email}</strong>, we sent a password reset link.
                Open it on this device to choose a new password.
              </p>
              <a href="/login" className={styles.backLink}>
                Back to sign in
              </a>
            </div>
          ) : (
            <>
              <h1 className={styles.title}>Reset your password</h1>
              <p className={styles.subtitle}>
                Enter the email you used for SaveAtlas. We will send a secure reset link from Supabase.
              </p>

              {errorMsg && <p className={styles.error}>{errorMsg}</p>}

              <form onSubmit={handleSubmit}>
                <div className={styles.inputGroup}>
                  <label htmlFor="email">Email</label>
                  <div className={styles.inputWrapper}>
                    <Mail size={18} color="#888" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>
                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      Send reset link <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <a href="/login" className={styles.backLink}>
                Back to sign in
              </a>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
