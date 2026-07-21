"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScoreEntry {
  id: number;
  name: string;
  score: number;
  bid?: number;
  logoUrl?: string | null;
}

interface Delta {
  id: string;
  value: number; // positive = up, negative = down
  ts: number;
}

// ─── Delta badge ──────────────────────────────────────────────────────────────
function DeltaBadge({ delta }: { delta: Delta }) {
  const isUp = delta.value > 0;
  return (
    <span
      key={delta.id}
      className={`text-label-sm font-bold delta-up absolute -top-3 right-6 z-20 ${
        isUp ? "text-secondary" : "text-error"
      }`}
    >
      {isUp ? "+" : ""}
      {delta.value}
    </span>
  );
}

// ─── Score cell with delta animation ─────────────────────────────────────────
function ScoreCell({
  entry,
  isTop3,
}: {
  entry: ScoreEntry;
  isTop3: boolean;
}) {
  const prevScoreRef = useRef<number | null>(null);
  const [deltas, setDeltas] = useState<Delta[]>([]);

  useEffect(() => {
    if (prevScoreRef.current !== null && prevScoreRef.current !== entry.score) {
      const diff = entry.score - prevScoreRef.current;
      const id = `${Date.now()}-${Math.random()}`;
      setDeltas((d) => [...d, { id, value: diff, ts: Date.now() }]);
      
      // remove badge after animation (2s matching CSS float-up)
      setTimeout(() => {
        setDeltas((d) => d.filter((x) => x.id !== id));
      }, 2000);
    }
    prevScoreRef.current = entry.score;
  }, [entry.score]);

  return (
    <div className="relative flex flex-col items-end pr-2 justify-center h-full">
      {deltas.map((d) => (
        <DeltaBadge key={d.id} delta={d} />
      ))}
      <span className={`text-headline-lg-mobile md:text-title-md font-bold ${isTop3 ? "text-primary" : "text-on-surface"}`}>
        {entry.score.toLocaleString()}
      </span>
    </div>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-md py-sm w-24">
        <div className="w-10 h-10 rounded-full bg-surface-container-high" />
      </td>
      <td className="px-md py-sm">
        <div className="flex items-center gap-md">
          <div className="w-12 h-12 rounded-full bg-surface-container-high" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-surface-container-high rounded" />
            <div className="h-3 w-48 bg-surface-container-low rounded" />
          </div>
        </div>
      </td>
      <td className="px-md py-sm">
        <div className="w-full max-w-[200px] h-2 bg-surface-container-low rounded-full" />
      </td>
      <td className="px-md py-sm text-right">
        <div className="h-6 w-12 bg-surface-container-high rounded ml-auto" />
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PublicPage() {
  const searchParams = useSearchParams();
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const { data: groups = [] } = api.group.getAll.useQuery();

  useEffect(() => {
    const paramId = searchParams.get("groupId");
    if (paramId) {
      const id = parseInt(paramId, 10);
      if (!isNaN(id)) {
        setActiveGroupId(id);
        return;
      }
    }
    if (groups.length > 0 && activeGroupId === null) {
      setActiveGroupId(groups[0]!.id);
    }
  }, [groups, searchParams, activeGroupId]);

  const {
    data: scores,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = api.score.getAll.useQuery(
    { groupId: activeGroupId ?? 0 },
    {
      enabled: activeGroupId !== null,
      refetchInterval: 10_000,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    }
  );

  const { data: biddingActive = false, refetch: refetchBidding } = api.score.isBiddingActive.useQuery(
    { groupId: activeGroupId ?? 0 },
    { enabled: activeGroupId !== null }
  );

  // Listen for real-time updates via Server-Sent Events (SSE)
  useEffect(() => {
    if (activeGroupId === null) return;
    const eventSource = new EventSource("/api/scores/stream");

    eventSource.onmessage = (event) => {
      const dataStr = event.data as string;
      if (dataStr === "update") {
        void refetch();
        void refetchBidding();
      } else if (dataStr.startsWith("update:")) {
        const [_, evGroupId] = dataStr.split(":");
        if (evGroupId && parseInt(evGroupId, 10) === activeGroupId) {
          void refetch();
          void refetchBidding();
        }
      }
    };

    return () => {
      eventSource.close();
    };
  }, [refetch, refetchBidding, activeGroupId]);

  const safeScores: ScoreEntry[] = scores ?? [];
  const topScore = safeScores[0]?.score ?? 0;

  // Initials generator helper
  const getInitials = (name: string) => {
    return name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  // Avatar bg class mapping
  const getAvatarColor = (idx: number) => {
    return "bg-surface-container-highest text-on-surface-variant";
  };

  return (
    <div className="text-on-background min-h-screen pb-xl relative">
      {/* Atmospheric Background Blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />

      {/* Top Navigation */}
      <header className="fixed top-0 w-full z-50 bg-white/10 backdrop-blur-xl border-b border-white/20 shadow-sm px-lg h-16 flex justify-between items-center">
        <div className="flex items-center gap-sm">
          <span className="font-extrabold text-title-md tracking-tighter text-primary">
            LOMBA CEPAT TEPAT
          </span>
        </div>
        <nav className="hidden md:flex gap-lg items-center">
          <a className="text-primary font-bold border-b-2 border-primary pb-1 text-sm font-semibold" href="#">
            Live
          </a>
          <a
            className="text-on-surface-variant font-medium hover:bg-primary-container/10 transition-colors px-2.5 py-1 rounded-lg text-sm"
            href="/rankings"
            target="_blank"
            rel="noopener noreferrer"
          >
            Rankings
          </a>
        </nav>
        <div className="flex items-center gap-md">
          <span className="hidden md:flex items-center gap-xs px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-label-sm font-bold pulse-live text-xs">
            <span className="material-symbols-outlined text-[14px]">sensors</span> LIVE
          </span>
          <button
            onClick={() => void refetch()}
            className="bg-primary text-on-primary px-4 py-1.5 rounded-xl font-bold transition-all scale-95 active:scale-90 text-xs"
          >
            {isFetching ? "RELOADING..." : "REFRESH"}
          </button>
        </div>
      </header>

      <main className="mt-24 max-w-container-max mx-auto px-gutter">
        {/* Group select dropdown */}
        {groups.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-black/5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-black/5 px-4 py-2.5 rounded-2xl text-xs font-bold text-on-surface-variant">
                <span className="material-symbols-outlined text-[16px] text-primary">folder_shared</span>
                <span className="text-[11px] uppercase tracking-wider text-outline font-extrabold mr-1">Pilih Grup:</span>
                <select
                  value={activeGroupId ?? ""}
                  onChange={(e) => setActiveGroupId(parseInt(e.target.value, 10))}
                  className="bg-transparent border-none outline-none font-bold text-on-surface cursor-pointer text-xs pr-2"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id} className="text-on-surface font-semibold bg-white">
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeGroupId !== null && (
              <a
                href={`/rankings?groupId=${activeGroupId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-indigo-600/10"
              >
                <span className="material-symbols-outlined text-[16px]">tv</span>
                <span>Buka Layar Rankings ({groups.find((g) => g.id === activeGroupId)?.name})</span>
              </a>
            )}
          </div>
        )}
        
        {/* ── Error Banner ────────────────────────────────────────────── */}
        {isError && (
          <div className="error-banner" role="alert">
            <div className="error-banner-icon">⚠️</div>
            <div className="error-banner-body">
              <p className="error-banner-title">Gagal memuat data</p>
              <p className="error-banner-msg">
                {(error as any)?.message ?? "Tidak dapat terhubung ke server. Periksa koneksi atau database."}
              </p>
            </div>
            <button
              id="btn-retry"
              className="error-banner-retry"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <span className="error-retry-spinner" />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              )}
              {isFetching ? "Mencoba..." : "Coba Lagi"}
            </button>
          </div>
        )}

        {/* Bento Stats Layout */}
        <section id="stats" className="grid grid-cols-1 md:grid-cols-12 gap-gutter mb-lg">
          <div className="md:col-span-8 glass-card p-md rounded-[24px] flex flex-col justify-between overflow-hidden relative min-h-[160px]">
            <div className="z-10">
              <h2 className="text-on-surface-variant font-semibold text-sm mb-1 uppercase tracking-wider">Competition Overview</h2>
              <p className="font-extrabold text-2xl text-primary">
                Final Lomba Cepat Tepat {groups.find((g) => g.id === activeGroupId)?.name ? `· ${groups.find((g) => g.id === activeGroupId)?.name}` : ""}
              </p>
            </div>
            <div className="flex items-end justify-between z-10 mt-md">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Current Status</span>
                <span className="flex items-center gap-2 text-secondary font-bold text-sm">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
                  Live Round 3
                </span>
              </div>
              <div className="flex -space-x-3 overflow-hidden">
                {safeScores.slice(0, 3).map((entry, idx) => (
                  <div 
                    key={entry.id}
                    className={`w-10 h-10 rounded-full border-2 border-white flex items-center justify-center font-bold text-xs shadow-sm ${getAvatarColor(idx)}`}
                  >
                    {getInitials(entry.name)}
                  </div>
                ))}
                {safeScores.length > 3 && (
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-surface-container-highest flex items-center justify-center text-on-surface-variant font-bold text-xs shadow-sm">
                    +{safeScores.length - 3}
                  </div>
                )}
              </div>
            </div>
            {/* Trophy Icon Watermark */}
            <div className="absolute -right-6 -bottom-6 opacity-[0.04]">
              <span className="material-symbols-outlined text-[180px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                emoji_events
              </span>
            </div>
          </div>

          <div className="md:col-span-4 grid grid-cols-1 gap-gutter">
            <div className="glass-card p-md rounded-[24px] flex items-center gap-md">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary">groups</span>
              </div>
              <div>
                <p className="text-[10px] text-outline uppercase font-bold tracking-wider">Instansi Peserta</p>
                <p className="text-2xl font-extrabold text-on-background">{safeScores.length}</p>
              </div>
            </div>
            <div className="glass-card p-md rounded-[24px] flex items-center gap-md">
              <div className="w-12 h-12 rounded-2xl bg-tertiary-fixed/30 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-tertiary">military_tech</span>
              </div>
              <div>
                <p className="text-[10px] text-outline uppercase font-bold tracking-wider">Skor Tertinggi</p>
                <p className="text-2xl font-extrabold text-on-background">
                  {topScore > 0 ? topScore.toLocaleString() : "—"}{" "}
                  {topScore > 0 && <span className="text-xs text-secondary font-bold font-sans">MAX</span>}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Leaderboard Glass Table */}
        <section id="rankings" className="glass-card rounded-[32px] overflow-hidden border border-white/40 shadow-xl">
          {/* Section Header */}
          <div className="p-md border-b border-outline-variant/30 flex justify-between items-center bg-white/20">
            <div className="flex items-center gap-sm">
              <h3 className="font-bold text-lg md:text-xl text-on-surface">Live Leaderboard</h3>
              <span className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 bg-secondary-container/60 text-on-secondary-container rounded-full text-[10px] font-bold uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping inline-block" />
                Live
              </span>
            </div>
            <button
              onClick={() => void refetch()}
              className="p-2 hover:bg-surface-container rounded-lg transition-colors flex items-center justify-center text-on-surface-variant"
              title="Refresh manual"
            >
              <span className={`material-symbols-outlined text-xl ${isFetching ? "animate-spin" : ""}`}>refresh</span>
            </button>
          </div>

          {/* ── MOBILE CARD LIST (< md) ── */}
          <div className="lb-mobile-list md:hidden">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="lb-card animate-pulse">
                  <div className="lb-card-rank">
                    <div className="w-9 h-9 rounded-full bg-surface-container-high" />
                  </div>
                  <div className="lb-card-avatar bg-surface-container-high" />
                  <div className="lb-card-body flex-1 space-y-2">
                    <div className="h-3.5 w-32 bg-surface-container-high rounded" />
                    <div className="h-2 w-full bg-surface-container-low rounded-full" />
                  </div>
                  <div className="h-6 w-10 bg-surface-container-high rounded ml-2" />
                </div>
              ))
            ) : safeScores.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-sm py-xl text-outline font-medium">
                <span className="material-symbols-outlined text-[48px] opacity-40">emoji_events</span>
                <p>Belum ada data peserta</p>
              </div>
            ) : (
              safeScores.map((entry, idx) => {
                const rank = safeScores.findIndex((s) => s.score === entry.score) + 1;
                const isTop3 = rank <= 3;
                const barPct = Math.max(4, (entry.score / Math.max(topScore, 1)) * 100);
                const rankGradientClass =
                  rank === 1 ? "rank-gradient-1 text-on-tertiary-fixed" :
                  rank === 2 ? "rank-gradient-2 text-on-surface-variant" :
                  rank === 3 ? "rank-gradient-3 text-on-tertiary" : "";
                const cardAccent =
                  rank === 1 ? "lb-card--gold" :
                  rank === 2 ? "lb-card--silver" :
                  rank === 3 ? "lb-card--bronze" : "";

                return (
                  <div key={entry.id} className={`lb-card ${isTop3 ? "lb-card--top" : ""} ${cardAccent}`}>
                    {/* Rank badge */}
                    <div className="lb-card-rank">
                      {isTop3 ? (
                        <div className={`w-9 h-9 rounded-full ${rankGradientClass} flex items-center justify-center shadow-md relative overflow-hidden font-bold text-sm flex-shrink-0`}>
                          <div className="absolute inset-0 shimmer opacity-40" />
                          <span className="relative z-10">{rank}</span>
                        </div>
                      ) : (
                        <span className="w-9 h-9 flex items-center justify-center font-bold text-outline text-sm">{rank}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className={`lb-card-avatar overflow-hidden ${entry.logoUrl ? "bg-white border" : getAvatarColor(idx)}`}>
                      {entry.logoUrl ? (
                        <img src={entry.logoUrl} alt={entry.name} className="w-full h-full object-cover" />
                      ) : (
                        getInitials(entry.name)
                      )}
                    </div>

                    {/* Name + progress bar */}
                    <div className="lb-card-body">
                      <div className="flex items-center gap-1.5 justify-between">
                        <p className="lb-card-name">{entry.name}</p>
                        {biddingActive && entry.score > 0 && (
                          <span className="bg-amber-100 text-amber-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-amber-200 flex-shrink-0">
                            Bid: {Math.min(entry.bid ?? 10, entry.score)}
                          </span>
                        )}
                      </div>
                      <p className="lb-card-sublabel">Instansi Peserta</p>
                      <div className="lb-card-bar-wrap">
                        <div
                          className="lb-card-bar bg-primary progress-bar-glow transition-all duration-1000"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Score */}
                    <div className="lb-card-score">
                      <ScoreCell entry={entry} isTop3={isTop3} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── DESKTOP TABLE (≥ md) ── */}
          <div className="lb-desktop-table overflow-x-auto overflow-y-auto max-h-[765px] custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="sticky top-0 z-30 bg-surface-container/95 backdrop-blur border-b border-outline-variant/10">
                <tr className="text-outline uppercase text-[11px] font-bold tracking-[0.2em]">
                  <th className="px-md py-sm w-24 text-center">Rank</th>
                  <th className="px-md py-sm">Participant</th>
                  <th className="px-md py-sm w-60">Consistency</th>
                  {biddingActive && <th className="px-md py-sm w-32 text-center">Bid</th>}
                  <th className="px-md py-sm text-right w-32 pr-8">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : safeScores.length === 0 ? (
                  <tr>
                    <td colSpan={biddingActive ? 5 : 4} className="py-xl text-center text-outline font-medium">
                      <div className="flex flex-col items-center justify-center gap-sm">
                        <span className="material-symbols-outlined text-[48px] opacity-40">emoji_events</span>
                        <p>Belum ada data peserta</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  safeScores.map((entry, idx) => {
                    const rank = safeScores.findIndex((s) => s.score === entry.score) + 1;
                    const isTop3 = rank <= 3;
                    const barPct = Math.max(4, (entry.score / Math.max(topScore, 1)) * 100);
                    const rankGradientClass =
                      rank === 1 ? "rank-gradient-1 text-on-tertiary-fixed" :
                      rank === 2 ? "rank-gradient-2 text-on-surface-variant" :
                      rank === 3 ? "rank-gradient-3 text-on-tertiary" : "";

                    return (
                      <tr key={entry.id} className="group hover:bg-white/30 transition-all cursor-pointer">
                        <td className="px-md py-sm w-24">
                          <div className="flex justify-center">
                            {isTop3 ? (
                              <div className={`w-10 h-10 rounded-full ${rankGradientClass} flex items-center justify-center shadow-md relative overflow-hidden font-bold text-sm`}>
                                <div className="absolute inset-0 shimmer opacity-50" />
                                <span className="relative z-10">{rank}</span>
                              </div>
                            ) : (
                              <span className="font-bold text-outline text-sm">{rank}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-md py-sm">
                          <div className="flex items-center gap-md">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm flex-shrink-0 overflow-hidden ${entry.logoUrl ? "bg-white" : getAvatarColor(idx)}`}>
                              {entry.logoUrl ? (
                                <img src={entry.logoUrl} alt={entry.name} className="w-full h-full object-cover" />
                              ) : (
                                getInitials(entry.name)
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-on-surface text-sm md:text-base">{entry.name}</p>
                              <p className="text-xs text-outline font-semibold uppercase tracking-wider">Instansi Peserta</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-md py-sm">
                          <div className="w-full max-w-[200px] h-2 bg-surface-container rounded-full overflow-hidden relative">
                            <div
                              className="absolute top-0 left-0 h-full bg-primary progress-bar-glow transition-all duration-1000"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </td>
                        {biddingActive && (
                          <td className="px-md py-sm text-center">
                            {entry.score > 0 ? (
                              <span className="bg-amber-100 text-amber-800 font-extrabold text-xs px-2.5 py-1 rounded-full border border-amber-200">
                                {Math.min(entry.bid ?? 10, entry.score)}
                              </span>
                            ) : (
                              <span className="text-outline text-xs font-semibold">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-md py-sm text-right pr-8">
                          <ScoreCell entry={entry} isTop3={isTop3} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-lg pt-lg border-t border-outline-variant/20">
        <div className="max-w-container-max mx-auto px-gutter flex flex-col md:flex-row justify-between items-center gap-md pb-8">
          <div className="text-center md:text-left">
            <p className="text-label-sm text-outline text-xs">© {new Date().getFullYear()} Lomba Cepat Tepat National Committee.</p>
            <p className="text-[10px] text-outline/60 mt-1 uppercase tracking-widest font-bold">Precision - Speed - Knowledge</p>
          </div>
          <div className="flex items-center gap-lg text-xs font-semibold">
            <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy Policy</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors border-l border-outline-variant/30 pl-lg" href="#">Terms of Service</a>
            <a className="flex items-center gap-xs text-primary font-bold hover:underline border-l border-outline-variant/30 pl-lg" href="/admin" target="_blank" rel="noopener noreferrer">
              <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
              Admin Login
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
