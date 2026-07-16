"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";

type ScoreEntry = { id: number; name: string; score: number; bid: number; createdAt: Date; updatedAt: Date };

// ─── Modal tambah / edit ───────────────────────────────────────────────────────
function Modal({ open, entry, onClose, onSaved }: {
  open: boolean; entry: ScoreEntry | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [score, setScore] = useState("");
  const [error, setError] = useState("");
  const utils = api.useUtils();

  const create = api.score.create.useMutation({
    onSuccess: async () => { await utils.score.getAll.invalidate(); onSaved(); },
    onError: (err) => setError(err.message || "Gagal menyimpan data. Coba lagi."),
  });
  const update = api.score.update.useMutation({
    onSuccess: async () => { await utils.score.getAll.invalidate(); onSaved(); },
    onError: (err) => setError(err.message || "Gagal memperbarui data. Coba lagi."),
  });

  useEffect(() => {
    if (open) {
      setName(entry?.name ?? "");
      setScore(entry?.score.toString() ?? "0");
      setError("");
    }
  }, [open, entry]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Nama kementerian tidak boleh kosong."); return; }
    const s = parseInt(score, 10);
    if (isNaN(s)) { setError("Skor harus berupa angka."); return; }
    if (entry) update.mutate({ id: entry.id, name: name.trim(), score: s });
    else create.mutate({ name: name.trim(), score: s });
  }

  const isPending = create.isPending || update.isPending;
  if (!open) return null;

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="admin-modal-card">
        <div className="admin-modal-header">
          <h3 className="admin-modal-title">
            {entry ? "Edit Kementerian" : "Tambah Kementerian"}
          </h3>
          <button className="admin-modal-close" onClick={onClose} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="admin-modal-form">
          <div className="admin-field">
            <label className="admin-label" htmlFor="modal-name">NAMA KEMENTERIAN</label>
            <div className="admin-input-wrap">
              <span className="material-symbols-outlined admin-input-icon">corporate_fare</span>
              <input
                id="modal-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kementerian Pertahanan"
                className="admin-input"
              />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="modal-score">INITIAL SCORE</label>
            <div className="admin-input-wrap">
              <span className="material-symbols-outlined admin-input-icon">scoreboard</span>
              <input
                id="modal-score"
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="admin-input"
              />
            </div>
          </div>

          {error && <div className="admin-field-error"><span className="material-symbols-outlined" style={{fontSize:15}}>error</span>{error}</div>}

          <div className="admin-modal-info">
            <span className="material-symbols-outlined" style={{fontSize:18}}>info</span>
            <p>Data baru akan segera muncul di leaderboard publik setelah Anda menekan tombol simpan.</p>
          </div>

          <button
            id="modal-save"
            type="submit"
            disabled={isPending}
            className="admin-btn-primary"
          >
            {isPending ? (
              <><span className="spinner border-white" style={{width:14,height:14}} /><span>Menyimpan...</span></>
            ) : (
              <><span className="material-symbols-outlined" style={{fontSize:18}}>save</span><span>Simpan Perubahan</span></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Debounced Bid Input ───────────────────────────────────────────────────────
function BidInput({ entry, onUpdate }: { entry: ScoreEntry; onUpdate: (id: number, val: number) => void }) {
  const maxBid = Math.max(0, entry.score);
  const currentBid = Math.min(entry.bid ?? 10, maxBid);

  const [localValue, setLocalValue] = useState(currentBid.toString());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with prop updates
  useEffect(() => {
    setLocalValue(currentBid.toString());
  }, [currentBid]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let num = parseInt(e.target.value, 10);
    if (isNaN(num)) {
      setLocalValue(e.target.value);
      return;
    }

    if (num < 0) num = 0;
    if (num > maxBid) num = maxBid;

    setLocalValue(num.toString());

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onUpdate(entry.id, num);
    }, 600);
  };

  return (
    <input
      type="number"
      value={localValue}
      onChange={handleChange}
      className="admin-bid-input"
      min="0"
      max={maxBid}
    />
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const isError = message.startsWith("❌");
  useEffect(() => { const t = setTimeout(onDone, isError ? 3500 : 2200); return () => clearTimeout(t); }, [onDone, isError]);
  return <div className={`toast ${isError ? "toast-error" : ""}`}>{message}</div>;
}

// ─── Admin Page ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<ScoreEntry | null>(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const {
    data: scores = [],
    isError: isScoreError,
    error: scoreError,
    isFetching: isScoreFetching,
    refetch: refetchScores,
  } = api.score.getAll.useQuery(
    undefined,
    {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    }
  );
  const utils = api.useUtils();

  const updateScore = api.score.update.useMutation({
    onSuccess: async () => {
      await utils.score.getAll.invalidate();
      setLoadingId(null);
    },
    onError: (err) => {
      setLoadingId(null);
      setToast(`❌ Gagal update skor: ${err.message || "Coba lagi."}`);
    },
  });

  const deleteScore = api.score.delete.useMutation({
    onSuccess: async () => {
      await utils.score.getAll.invalidate();
      setToast("✅ Kementerian dihapus.");
      setDeletingId(null);
    },
    onError: (err) => {
      setToast(`❌ Gagal hapus: ${err.message || "Coba lagi."}`);
      setDeletingId(null);
    },
  });

  const { data: biddingActive = false, refetch: refetchBidding } = api.score.isBiddingActive.useQuery();

  const toggleBidding = api.score.setBiddingActive.useMutation({
    onSuccess: async () => {
      await refetchBidding();
      setToast(`✅ Sesi bidding ${!biddingActive ? "diaktifkan" : "dinonaktifkan"}`);
    },
    onError: (err) => {
      setToast(`❌ Gagal mengubah sesi bidding: ${err.message}`);
    },
  });

  const updateBidMutation = api.score.updateBid.useMutation({
    onSuccess: async () => {
      await utils.score.getAll.invalidate();
    },
    onError: (err) => {
      setToast(`❌ Gagal update bid: ${err.message}`);
    },
  });

  const handleBidChange = (id: number, val: number) => {
    updateBidMutation.mutate({ id, bid: val });
  };

  const [winningId, setWinningId] = useState<number | null>(null);

  const declareWinner = api.score.declareBiddingWinner.useMutation({
    onSuccess: async (data) => {
      await utils.score.getAll.invalidate();
      setToast(`🎉 ${data.name} dinyatakan menang bidding (+${data.pointsWon} poin)!`);
      setWinningId(null);
    },
    onError: (err) => {
      setToast(`❌ Gagal menentukan pemenang: ${err.message}`);
      setWinningId(null);
    },
  });

  const handleDeclareWinner = (entry: ScoreEntry) => {
    if (!confirm(`Nyatakan "${entry.name}" sebagai pemenang bidding round? Skor akan bertambah +${entry.bid ?? 10} dan seluruh bid instansi lainnya akan direset ke 10.`)) return;
    setWinningId(entry.id);
    declareWinner.mutate({ id: entry.id });
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
  }, [status, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("admin-search")?.focus();
      }
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="spinner border-primary" style={{width:32,height:32}} />
      </div>
    );
  }

  function openAdd() { setEditEntry(null); setModalOpen(true); }
  function openEdit(e: ScoreEntry) { setEditEntry(e); setModalOpen(true); }
  function onSaved() { setModalOpen(false); setToast(editEntry ? "✅ Data diperbarui!" : "✅ Kementerian ditambahkan!"); }

  function handleDelete(entry: ScoreEntry) {
    if (!confirm(`Hapus "${entry.name}" dari daftar?`)) return;
    setDeletingId(entry.id);
    deleteScore.mutate({ id: entry.id });
  }

  function handleQuickScore(entry: ScoreEntry, delta: number) {
    setLoadingId(entry.id);
    updateScore.mutate({ id: entry.id, name: entry.name, score: entry.score + delta });
  }

  const filtered = scores.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const getInitials = (name: string) =>
    name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const getAvatarColor = (idx: number) => {
    const variants = [
      "bg-primary-container/20 text-primary-container",
      "bg-secondary-container text-on-secondary-container",
      "bg-tertiary-fixed/30 text-on-tertiary-fixed-variant",
      "bg-error-container text-on-error-container",
      "bg-primary-fixed text-on-primary-fixed-variant",
      "bg-secondary-fixed text-on-secondary-fixed-variant",
    ];
    return variants[idx % variants.length] ?? "bg-surface-container text-on-surface-variant";
  };

  const topScore = scores[0]?.score ?? 0;

  return (
    <div className="admin-root">
      {/* Background blobs */}
      <div className="blob blob-1" style={{opacity:0.06}} />
      <div className="blob blob-2" style={{opacity:0.06}} />

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className={`admin-sidebar ${sidebarOpen ? "admin-sidebar--open" : ""}`}>
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-brand-icon">
            <span className="material-symbols-outlined" style={{fontSize:20}}>admin_panel_settings</span>
          </div>
          <div>
            <h1 className="admin-sidebar-brand-title">Admin Panel</h1>
            <p className="admin-sidebar-brand-sub">Competition Control</p>
          </div>
          {/* Mobile close */}
          <button
            className="admin-sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup sidebar"
          >
            <span className="material-symbols-outlined" style={{fontSize:20}}>close</span>
          </button>
        </div>

        <nav className="admin-sidebar-nav">
          <a className="admin-sidebar-link admin-sidebar-link--active" href="#">
            <span className="material-symbols-outlined" style={{fontSize:20}}>leaderboard</span>
            <span>Rankings</span>
          </a>
          <a className="admin-sidebar-link" href="#">
            <span className="material-symbols-outlined" style={{fontSize:20}}>dashboard</span>
            <span>Dashboard</span>
          </a>
          <a className="admin-sidebar-link" href="#">
            <span className="material-symbols-outlined" style={{fontSize:20}}>sensors</span>
            <span>Live Control</span>
          </a>
          <a className="admin-sidebar-link" href="#">
            <span className="material-symbols-outlined" style={{fontSize:20}}>analytics</span>
            <span>Stats</span>
          </a>
          <a className="admin-sidebar-link" href="#">
            <span className="material-symbols-outlined" style={{fontSize:20}}>settings</span>
            <span>Settings</span>
          </a>
        </nav>

        <div className="admin-sidebar-footer">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-sidebar-view-public"
          >
            <span className="material-symbols-outlined" style={{fontSize:16}}>open_in_new</span>
            Lihat Halaman Publik
          </a>
          <button
            id="btn-logout"
            onClick={() => {
              setIsLoggingOut(true);
              void signOut({ callbackUrl: "/admin/login" });
            }}
            disabled={isLoggingOut}
            className="admin-sidebar-logout"
          >
            {isLoggingOut ? (
              <span className="spinner border-error mr-2" style={{width:14,height:14}} />
            ) : (
              <span className="material-symbols-outlined" style={{fontSize:18}}>logout</span>
            )}
            <span>{isLoggingOut ? "Logging out..." : "Logout"}</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <div className="admin-content">

        {/* Top Header Bar */}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            {/* Hamburger — mobile only */}
            <button
              className="admin-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka menu"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <h2 className="admin-topbar-title">Selamat datang, Admin</h2>
              <p className="admin-topbar-sub">
                Status: <span className="text-secondary font-bold">Online</span>
                {session?.user?.name && <> · <strong>{session.user.name}</strong></>}
              </p>
            </div>
          </div>

          <div className="admin-topbar-actions">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-topbar-btn-ghost"
            >
              <span className="material-symbols-outlined" style={{fontSize:16}}>open_in_new</span>
              <span className="hidden sm:inline">Halaman Publik</span>
            </a>
            <button
              onClick={() => {
                setIsLoggingOut(true);
                void signOut({ callbackUrl: "/admin/login" });
              }}
              disabled={isLoggingOut}
              className="admin-topbar-btn-danger"
            >
              {isLoggingOut ? (
                <span className="spinner border-white mr-2" style={{width:14,height:14}} />
              ) : (
                <span className="material-symbols-outlined" style={{fontSize:16}}>logout</span>
              )}
              <span className="hidden sm:inline">{isLoggingOut ? "Keluar..." : "Logout"}</span>
            </button>
            <div className="admin-topbar-avatar">
              {getInitials(session?.user?.name ?? "AD")}
            </div>
          </div>
        </header>

        <main className="admin-main">
          {/* Error Banner */}
          {isScoreError && (
            <div className="error-banner" role="alert">
              <div className="error-banner-icon">⚠️</div>
              <div className="error-banner-body">
                <p className="error-banner-title">Gagal memuat data peserta</p>
                <p className="error-banner-msg">{(scoreError as Error)?.message ?? "Tidak dapat terhubung ke database."}</p>
              </div>
              <button id="btn-admin-retry" className="error-banner-retry" onClick={() => void refetchScores()} disabled={isScoreFetching}>
                {isScoreFetching ? <span className="error-retry-spinner" /> : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                )}
                {isScoreFetching ? "Mencoba..." : "Coba Lagi"}
              </button>
            </div>
          )}

          {/* ── Stat Cards ───────────────────────────────────── */}
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-icon-wrap" style={{background:"var(--color-primary)/10"}}>
                <span className="material-symbols-outlined" style={{color:"var(--color-primary)"}}>groups</span>
              </div>
              <div>
                <p className="admin-stat-label">Total Peserta</p>
                <p className="admin-stat-value">{scores.length}</p>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-icon-wrap" style={{background:"var(--color-secondary-container)"}}>
                <span className="material-symbols-outlined" style={{color:"var(--color-secondary)"}}>military_tech</span>
              </div>
              <div>
                <p className="admin-stat-label">Skor Tertinggi</p>
                <p className="admin-stat-value">{topScore > 0 ? topScore.toLocaleString() : "—"}</p>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-icon-wrap" style={{background:"var(--color-tertiary-fixed)/30"}}>
                <span className="material-symbols-outlined" style={{color:"var(--color-tertiary)"}}>bar_chart</span>
              </div>
              <div>
                <p className="admin-stat-label">Rata-rata Skor</p>
                <p className="admin-stat-value">
                  {scores.length > 0
                    ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length).toLocaleString()
                    : "—"}
                </p>
              </div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-icon-wrap" style={{background:"var(--color-error-container)"}}>
                <span className="material-symbols-outlined" style={{color:"var(--color-error)"}}>sensors</span>
              </div>
              <div>
                <p className="admin-stat-label">Status</p>
                <p className="admin-stat-value" style={{fontSize:14, color:"var(--color-secondary)"}}>● Live</p>
              </div>
            </div>
          </div>

          {/* ── Bidding Session Switch Banner ── */}
          <div className="admin-bidding-banner mb-lg">
            <div className="flex items-center gap-3">
              <div className="admin-bidding-icon-wrap">
                <span className="material-symbols-outlined">gavel</span>
              </div>
              <div>
                <h3 className="admin-bidding-title">Sesi Taruhan (Bidding Session)</h3>
                <p className="admin-bidding-desc">
                  Aktifkan sesi taruhan poin untuk semua instansi. Taruhan default adalah 10 poin.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`admin-bidding-status-label ${biddingActive ? "admin-bidding-status-label--active" : ""}`}>
                {biddingActive ? "SESI AKTIF" : "SESI NONAKTIF"}
              </span>
              <button
                id="btn-toggle-bidding"
                onClick={() => toggleBidding.mutate({ active: !biddingActive })}
                disabled={toggleBidding.isPending}
                className={`admin-toggle-switch ${biddingActive ? "admin-toggle-switch--active" : ""} ${toggleBidding.isPending ? "opacity-50 cursor-wait" : ""}`}
                aria-label="Toggle Sesi Bidding"
              >
                {toggleBidding.isPending ? (
                  <span className="spinner border-white absolute inset-0 m-auto" style={{ width: 14, height: 14 }} />
                ) : (
                  <span className="admin-toggle-knob" />
                )}
              </button>
            </div>
          </div>

          {/* ── Control Bar ──────────────────────────────────── */}
          <div className="admin-control-bar">
            <div className="admin-search-wrap">
              <span className="material-symbols-outlined admin-search-icon">search</span>
              <input
                id="admin-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kementerian... (⌘K)"
                className="admin-search-input"
              />
              {search && (
                <button onClick={() => setSearch("")} className="admin-search-clear" aria-label="Hapus pencarian">
                  <span className="material-symbols-outlined" style={{fontSize:18}}>close</span>
                </button>
              )}
            </div>
            <button id="btn-add" onClick={openAdd} className="admin-btn-primary">
              <span className="material-symbols-outlined" style={{fontSize:18}}>add</span>
              <span>Tambah</span>
            </button>
          </div>

          {/* ── Leaderboard Table ─────────────────────────────── */}
          <div className="admin-table-card">
            <div className="admin-table-header">
              <div className="flex items-center gap-2">
                <h3 className="admin-table-title">Live Rankings</h3>
                <span className="admin-live-badge">
                  <span className="admin-live-dot" />
                  Live
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isScoreFetching && <span className="admin-syncing-badge">Syncing...</span>}
                <button
                  onClick={() => void refetchScores()}
                  disabled={isScoreFetching}
                  className={`admin-refresh-btn ${isScoreFetching ? "opacity-50 pointer-events-none" : ""}`}
                  title="Refresh data"
                >
                  <span className={`material-symbols-outlined ${isScoreFetching ? "animate-spin" : ""}`} style={{fontSize:18}}>refresh</span>
                </button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="admin-empty-state">
                <span className="material-symbols-outlined" style={{fontSize:48, opacity:0.3}}>info</span>
                <p>{search ? "Kementerian tidak ditemukan." : "Belum ada data. Klik Tambah Kementerian!"}</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="admin-table-desktop">
                  <table className="admin-table">
                    <thead>
                      <tr className="admin-table-head-row">
                        <th className="admin-th w-16 text-center">Rank</th>
                        <th className="admin-th">Peserta</th>
                        <th className="admin-th w-32 text-right">Skor</th>
                        {biddingActive && <th className="admin-th w-36 text-center">Bidding Poin</th>}
                        <th className="admin-th w-56 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((entry, idx) => {
                        const rank = scores.indexOf(entry) + 1;
                        const isTop3 = rank <= 3;
                        const isLoading = loadingId === entry.id;
                        const rankGrad =
                          rank === 1 ? "rank-gradient-1 text-on-tertiary-fixed" :
                          rank === 2 ? "rank-gradient-2 text-on-surface-variant" :
                          rank === 3 ? "rank-gradient-3 text-on-tertiary" : "";

                        return (
                          <tr key={entry.id} className="admin-table-row">
                            <td className="admin-td text-center">
                              {isTop3 ? (
                                <div className={`admin-rank-badge ${rankGrad}`}>
                                  <div className="absolute inset-0 shimmer opacity-40" />
                                  <span className="relative z-10">{rank}</span>
                                </div>
                              ) : (
                                <span className="font-bold text-outline text-sm">{rank}</span>
                              )}
                            </td>
                            <td className="admin-td">
                              <div className="flex items-center gap-3">
                                <div className={`admin-avatar ${getAvatarColor(idx)}`}>
                                  {getInitials(entry.name)}
                                </div>
                                <div>
                                  <p className="font-bold text-on-surface text-sm">{entry.name}</p>
                                  <p className="text-[10px] text-outline font-semibold uppercase tracking-wide">
                                    {new Date(entry.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="admin-td text-right">
                              <span className="text-xl font-extrabold text-primary">{entry.score.toLocaleString()}</span>
                            </td>
                            {biddingActive && (
                              <td className="admin-td text-center">
                                <div className="flex justify-center">
                                  <BidInput
                                    entry={entry as ScoreEntry}
                                    onUpdate={handleBidChange}
                                  />
                                </div>
                              </td>
                            )}
                            <td className="admin-td">
                              <div className="admin-row-actions">
                                <button id={`btn-plus-${entry.id}`} onClick={() => handleQuickScore(entry as ScoreEntry, 10)} disabled={isLoading} className="admin-action-btn admin-action-btn--green" title="+10">
                                  {isLoading ? <span className="spinner border-secondary" style={{width:12,height:12}} /> : "+10"}
                                </button>
                                <button id={`btn-minus-${entry.id}`} onClick={() => handleQuickScore(entry as ScoreEntry, -5)} disabled={isLoading} className="admin-action-btn admin-action-btn--red" title="-5">
                                  {isLoading ? <span className="spinner border-error" style={{width:12,height:12}} /> : "-5"}
                                </button>
                                {biddingActive && (
                                  <button
                                    id={`btn-winner-${entry.id}`}
                                    onClick={() => handleDeclareWinner(entry as ScoreEntry)}
                                    disabled={winningId === entry.id}
                                    className="admin-icon-btn admin-icon-btn--winner mr-1"
                                    title="Pemenang Bidding Round"
                                  >
                                    {winningId === entry.id ? (
                                      <span className="spinner border-primary" style={{width:12,height:12}} />
                                    ) : (
                                      <span className="material-symbols-outlined text-amber-500 font-extrabold" style={{fontSize:20}}>military_tech</span>
                                    )}
                                  </button>
                                )}
                                <div className="admin-action-divider" />
                                <button id={`btn-edit-${entry.id}`} onClick={() => openEdit(entry as ScoreEntry)} className="admin-icon-btn" title="Edit">
                                  <span className="material-symbols-outlined" style={{fontSize:18}}>edit</span>
                                </button>
                                <button
                                  id={`btn-delete-${entry.id}`}
                                  onClick={() => handleDelete(entry as ScoreEntry)}
                                  disabled={deletingId === entry.id}
                                  className="admin-icon-btn admin-icon-btn--danger"
                                  title="Hapus"
                                >
                                  {deletingId === entry.id ? (
                                    <span className="spinner border-error" style={{width:12,height:12}} />
                                  ) : (
                                    <span className="material-symbols-outlined" style={{fontSize:18}}>delete</span>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="admin-mobile-list">
                  {filtered.map((entry, idx) => {
                    const rank = scores.indexOf(entry) + 1;
                    const isLoading = loadingId === entry.id;
                    return (
                      <div key={entry.id} className="admin-mobile-card">
                        <div className="admin-mobile-card-top">
                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-primary text-lg w-6 text-center">{rank}</span>
                            <div className={`admin-avatar ${getAvatarColor(idx)}`}>{getInitials(entry.name)}</div>
                            <div>
                              <p className="font-bold text-on-surface text-sm">{entry.name}</p>
                              <p className="text-[10px] text-outline uppercase font-bold tracking-wide">Instansi Peserta</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-extrabold text-primary">{entry.score.toLocaleString()}</p>
                            <p className="text-[9px] text-outline font-bold uppercase tracking-widest">Skor</p>
                          </div>
                        </div>
                        {/* Mobile Bid input row */}
                        {biddingActive && (
                          <div className="admin-mobile-card-bid flex items-center justify-between border-t border-black/5 pt-2 mt-2 px-1">
                            <span className="text-[10px] font-extrabold text-outline uppercase tracking-wider">Bidding Poin</span>
                            <BidInput
                              entry={entry as ScoreEntry}
                              onUpdate={handleBidChange}
                            />
                          </div>
                        )}
                        <div className="admin-mobile-card-actions mt-2 border-t border-black/5 pt-2">
                          <button onClick={() => handleQuickScore(entry as ScoreEntry, 10)} disabled={isLoading} className="admin-action-btn admin-action-btn--green flex-1">
                            {isLoading ? <span className="spinner border-secondary" style={{width:12,height:12}} /> : "+10 Poin"}
                          </button>
                          <button onClick={() => handleQuickScore(entry as ScoreEntry, -5)} disabled={isLoading} className="admin-action-btn admin-action-btn--red flex-1">
                            {isLoading ? <span className="spinner border-error" style={{width:12,height:12}} /> : "-5 Poin"}
                          </button>
                          {biddingActive && (
                            <button
                              onClick={() => handleDeclareWinner(entry as ScoreEntry)}
                              disabled={winningId === entry.id}
                              className="admin-icon-btn admin-icon-btn--winner"
                              title="Pemenang Bidding"
                            >
                              {winningId === entry.id ? (
                                <span className="spinner border-primary" style={{width:12,height:12}} />
                              ) : (
                                <span className="material-symbols-outlined text-amber-500 font-extrabold" style={{fontSize:18}}>military_tech</span>
                              )}
                            </button>
                          )}
                          <button onClick={() => openEdit(entry as ScoreEntry)} className="admin-icon-btn">
                            <span className="material-symbols-outlined" style={{fontSize:18}}>edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(entry as ScoreEntry)}
                            disabled={deletingId === entry.id}
                            className="admin-icon-btn admin-icon-btn--danger"
                          >
                            {deletingId === entry.id ? (
                              <span className="spinner border-error" style={{width:12,height:12}} />
                            ) : (
                              <span className="material-symbols-outlined" style={{fontSize:18}}>delete</span>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {filtered.length > 0 && (
              <p className="admin-count-label">{filtered.length} dari {scores.length} kementerian</p>
            )}
          </div>
        </main>
      </div>

      <Modal open={modalOpen} entry={editEntry} onClose={() => setModalOpen(false)} onSaved={onSaved} />
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}
