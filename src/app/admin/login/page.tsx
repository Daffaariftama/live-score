"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", { username, password, redirect: false });
      if (res?.ok) {
        router.push("/admin");
      } else {
        setError("Username atau password salah.");
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-root">
      {/* Animated background blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="login-blob-accent" />

      {/* Grid lines decoration */}
      <div className="login-grid-overlay" aria-hidden="true" />

      <div className="login-card-wrapper">
        {/* Left hero panel — hidden on mobile */}
        <div className="login-hero" aria-hidden="true">
          <div className="login-hero-inner">
            <div className="login-hero-badge">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sensors</span>
              LIVE SCORING SYSTEM
            </div>
            <h2 className="login-hero-title">
              Kelola Skor<br />
              <span className="login-hero-title-accent">Secara Real-time</span>
            </h2>
            <p className="login-hero-desc">
              Panel admin untuk memantau dan mengelola skor peserta lomba cepat tepat secara langsung.
            </p>

            <div className="login-hero-stats">
              <div className="login-stat-item">
                <span className="material-symbols-outlined login-stat-icon">bolt</span>
                <div>
                  <p className="login-stat-label">Update Instan</p>
                  <p className="login-stat-value">Real-time</p>
                </div>
              </div>
              <div className="login-stat-item">
                <span className="material-symbols-outlined login-stat-icon">security</span>
                <div>
                  <p className="login-stat-label">Akses Aman</p>
                  <p className="login-stat-value">Protected</p>
                </div>
              </div>
              <div className="login-stat-item">
                <span className="material-symbols-outlined login-stat-icon">leaderboard</span>
                <div>
                  <p className="login-stat-label">Leaderboard</p>
                  <p className="login-stat-value">Live Board</p>
                </div>
              </div>
            </div>

            {/* Decorative leaderboard preview */}
            <div className="login-preview-card">
              <div className="login-preview-header">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>emoji_events</span>
                Live Rankings
                <span className="login-preview-live-dot" />
              </div>
              {["Kementerian Dalam Negeri", "Kementerian Keuangan", "Kementerian Pendidikan"].map((name, i) => (
                <div key={i} className="login-preview-row">
                  <span className={`login-preview-rank rank-${i + 1}`}>{i + 1}</span>
                  <span className="login-preview-name">{name}</span>
                  <span className="login-preview-score">{[150, 120, 100][i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right login form */}
        <div className="login-form-panel">
          <div className="login-form-inner">
            {/* Brand */}
            <div className="login-brand">
              <div className="login-brand-icon">
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>admin_panel_settings</span>
              </div>
              <div>
                <p className="login-brand-label">Admin Portal</p>
                <h1 className="login-brand-title">LOMBA CEPAT TEPAT</h1>
              </div>
            </div>

            <div className="login-divider" />

            <div className="login-welcome">
              <h2 className="login-welcome-title">Selamat Datang 👋</h2>
              <p className="login-welcome-subtitle">Masuk ke panel admin untuk mengelola kompetisi.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="login-form" noValidate>
              <div className="login-field">
                <label htmlFor="login-username" className="login-label">USERNAME</label>
                <div className="login-input-wrapper">
                  <span className="material-symbols-outlined login-input-icon">person</span>
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username"
                    autoComplete="username"
                    required
                    className="login-input"
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="login-password" className="login-label">PASSWORD</label>
                <div className="login-input-wrapper">
                  <span className="material-symbols-outlined login-input-icon">lock</span>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                    required
                    className="login-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-eye-btn"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {error && (
                <div className="login-error" role="alert">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
                  {error}
                </div>
              )}

              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="login-btn-submit"
              >
                {loading ? (
                  <>
                    <span className="spinner border-white" style={{ width: 16, height: 16 }} />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>login</span>
                    <span>Masuk ke Admin</span>
                  </>
                )}
              </button>
            </form>

            <div className="login-footer">
              <a href="/" className="login-back-link">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                Lihat Papan Klasemen Publik
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
