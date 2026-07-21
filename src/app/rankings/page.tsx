"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";

interface ScoreEntry {
  id: number;
  name: string;
  score: number;
  logoUrl?: string | null;
}

interface Delta {
  id: string;
  value: number;
  ts: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// Unified dark purple-charcoal color palette for all avatars
function getAvatarColor() {
  return "#2a273b";
}

// ─── Live delta badge ─────────────────────────────────────────────────────────
function DeltaFlash({ delta }: { delta: Delta }) {
  return (
    <span
      className={`fs-delta ${delta.value > 0 ? "fs-delta--up" : "fs-delta--down"}`}
    >
      {delta.value > 0 ? "+" : ""}{delta.value}
    </span>
  );
}

// ─── Score cell ───────────────────────────────────────────────────────────────
function ScoreCell({ entry, rank }: { entry: ScoreEntry; rank: number }) {
  const prevRef = useRef<number | null>(null);
  const [deltas, setDeltas] = useState<Delta[]>([]);

  useEffect(() => {
    if (prevRef.current !== null && prevRef.current !== entry.score) {
      const id = `${Date.now()}-${Math.random()}`;
      setDeltas((d) => [...d, { id, value: entry.score - prevRef.current!, ts: Date.now() }]);
      setTimeout(() => setDeltas((d) => d.filter((x) => x.id !== id)), 2500);
    }
    prevRef.current = entry.score;
  }, [entry.score]);

  const isTop3 = rank <= 3;

  return (
    <div className="fs-score-wrap">
      {deltas.map((d) => <DeltaFlash key={d.id} delta={d} />)}
      <span className={`fs-score ${isTop3 ? "fs-score--top" : ""}`}>
        {entry.score.toLocaleString()}
      </span>
      <span className="fs-score-label">PTS</span>
    </div>
  );
}



// ─── Main Rankings Page ───────────────────────────────────────────────────────
export default function RankingsPage() {
  const searchParams = useSearchParams();
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const { data: groups = [] } = api.group.getAll.useQuery();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (groups.length > 0 && !initialized) {
      const paramId = searchParams.get("groupId");
      if (paramId) {
        const id = parseInt(paramId, 10);
        if (!isNaN(id)) {
          setActiveGroupId(id);
          setInitialized(true);
          return;
        }
      }
      setActiveGroupId(groups[0]!.id);
      setInitialized(true);
    }
  }, [groups, searchParams, initialized]);

  const handleGroupChange = (id: number) => {
    setActiveGroupId(id);
    // Update the browser URL query parameter seamlessly
    const url = new URL(window.location.href);
    url.searchParams.set("groupId", id.toString());
    window.history.pushState(null, "", url.toString());
  };

  const { data: scores = [], isLoading, refetch } = api.score.getAll.useQuery(
    { groupId: activeGroupId ?? 0 },
    {
      enabled: activeGroupId !== null,
      refetchInterval: 10_000,
    }
  );

  const [now, setNow] = useState(() => new Date());
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const prevScoresRef = useRef<Map<number, number>>(new Map());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      void document.exitFullscreen();
    }
  };

  const { data: biddingActive = false, refetch: refetchBidding } = api.score.isBiddingActive.useQuery(
    { groupId: activeGroupId ?? 0 },
    { enabled: activeGroupId !== null }
  );
  const [celebration, setCelebration] = useState<{ name: string; points: number } | null>(null);

  const triggerCelebration = (name: string, points: number) => {
    setCelebration({ name, points });
    setTimeout(() => {
      setCelebration(null);
    }, 6000);
  };

  // SSE real-time
  useEffect(() => {
    if (activeGroupId === null) return;
    const es = new EventSource("/api/scores/stream");
    es.onmessage = (e) => {
      const dataStr = e.data as string;
      if (dataStr === "update") {
        void refetch();
        void refetchBidding();
      } else if (dataStr.startsWith("update:")) {
        const [_, evGroupId] = dataStr.split(":");
        if (evGroupId && parseInt(evGroupId, 10) === activeGroupId) {
          void refetch();
          void refetchBidding();
        }
      } else if (dataStr.startsWith("winner:")) {
        const [_, evGroupId, winnerName, winPoints] = dataStr.split(":");
        if (evGroupId && parseInt(evGroupId, 10) === activeGroupId && winnerName && winPoints) {
          void refetch();
          void refetchBidding();
          triggerCelebration(winnerName, parseInt(winPoints, 10));
        }
      }
    };
    return () => es.close();
  }, [refetch, refetchBidding, activeGroupId]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Detect score changes → flash row
  useEffect(() => {
    const newFlash = new Set<number>();
    scores.forEach((s) => {
      const prev = prevScoresRef.current.get(s.id);
      if (prev !== undefined && prev !== s.score) newFlash.add(s.id);
      prevScoresRef.current.set(s.id, s.score);
    });
    if (newFlash.size > 0) {
      setFlashIds(newFlash);
      setTimeout(() => setFlashIds(new Set()), 1500);
    }
  }, [scores]);

  const topScore = scores[0]?.score ?? 0;

  return (
    <div className="fs-root text-on-background min-h-screen relative">
      <div className="fs-grid-lines" aria-hidden="true" />

      {/* ── MAIN CONTENT ───────────────────────────────────────────────── */}
      <main className="fs-main">
        {isLoading ? (
          <div className="fs-loading">
            <div className="fs-spinner" />
            <p>Memuat data...</p>
          </div>
        ) : scores.length === 0 ? (
          <div className="fs-empty">
            <span className="material-symbols-outlined" style={{ fontSize: 64, opacity: 0.3 }}>emoji_events</span>
            <p>Belum ada peserta terdaftar</p>
          </div>
        ) : (
          <div className="fs-layout">

            {/* LEFT PANEL: Mascot, Brand title, Podium top 3 & Commentator box */}
            <div className="fs-podium-section">
              {/* Branding Header Block */}
              <div className="fs-brand-block">
                <div className="flex items-center gap-3 w-full">
                  <img src="/api/mascot" alt="Mascot" className="fs-mascot" />
                  <div className="flex-1 min-w-0">
                    <h1 className="fs-brand-title truncate">LOMBA CEPAT TEPAT</h1>
                    <p className="fs-brand-subtitle">
                      Leaderboard {groups.find((g) => g.id === activeGroupId)?.name ? `· ${groups.find((g) => g.id === activeGroupId)?.name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={toggleFullscreen}
                      className="fs-brand-back-btn"
                      title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                        {isFullscreen ? "fullscreen_exit" : "fullscreen"}
                      </span>
                    </button>
                    <a href="/" className="fs-brand-back-btn" title="Kembali ke halaman utama">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Leader Spotlight */}
              {scores.length > 0 && scores[0] && !scores.every((s) => s.score === scores[0]!.score) && (
                <div className="fs-podium-wrapper">
                  <p className="fs-section-label">🏆 Pimpinan Klasemen</p>
                  <div className="flex flex-col items-center justify-center py-6 px-4">
                    <div className="relative flex flex-col items-center">
                      <span className="text-[32px] absolute -top-8 animate-bounce">👑</span>
                      <div className={`w-28 h-28 rounded-full border-4 border-amber-400 shadow-xl overflow-hidden flex items-center justify-center flex-shrink-0 bg-white`}>
                        {scores[0].logoUrl ? (
                          <img src={scores[0].logoUrl} alt={scores[0].name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-3xl font-extrabold text-slate-800">{getInitials(scores[0].name)}</span>
                        )}
                      </div>
                      <span className="absolute -bottom-3 bg-amber-500 text-white font-extrabold px-3 py-1 rounded-full text-xs shadow-md border-2 border-white">
                        Rank #1
                      </span>
                    </div>

                    <div className="text-center mt-6">
                      <p className="font-extrabold text-on-surface text-lg leading-snug max-w-[240px] mx-auto break-words">{scores[0].name}</p>
                      <p className="text-2xl font-black text-amber-500 mt-2">{scores[0].score.toLocaleString()} PTS</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Commentator Box Space */}
              <div className="fs-commentator-wrapper">
                <p className="fs-section-label">🎤 Komentator</p>
                <div className="fs-commentator-space" />
              </div>
            </div>

            {/* RIGHT PANEL: Full ranking list */}
            <div className="fs-list-section">
              <div className="flex items-center justify-between px-md py-sm border-b border-black/5 bg-white/20">
                <div className="flex items-center gap-3">
                  <p className="fs-section-label !p-0">📋 Ranking Lengkap</p>
                  {groups.length > 0 && (
                    <div className="fs-group-dropdown-wrap">
                      <span className="material-symbols-outlined fs-group-icon">folder_shared</span>
                      <select
                        value={activeGroupId ?? ""}
                        onChange={(e) => handleGroupChange(parseInt(e.target.value, 10))}
                        className="fs-group-dropdown"
                      >
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <span className="fs-clock-inline">
                  {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
              
              <div className="fs-list">
                {scores.slice(0, 10).map((entry, idx) => {
                  const rank = scores.findIndex((s) => s.score === entry.score) + 1;
                  const isTop3 = rank <= 3;
                  const barPct = Math.max(3, (entry.score / Math.max(topScore, 1)) * 100);
                  const isFlashing = flashIds.has(entry.id);

                  const rankColors: Record<number, string> = {
                    1: "linear-gradient(135deg,#ffd700,#fbbf24)",
                    2: "linear-gradient(135deg,#c0c0c0,#9ca3af)",
                    3: "linear-gradient(135deg,#cd7f32,#d97706)",
                  };

                  return (
                    <div
                      key={entry.id}
                      className={`fs-row ${isTop3 ? "fs-row--top" : ""} ${isFlashing ? "fs-row--flash" : ""}`}
                    >
                      {/* Rank */}
                      <div className="fs-row-rank">
                        {isTop3 ? (
                          <div
                            className="fs-rank-badge"
                            style={{ background: rankColors[rank] }}
                          >
                            <div className="absolute inset-0 shimmer opacity-40 rounded-full" />
                            <span className="relative z-10">{rank}</span>
                          </div>
                        ) : (
                          <span className="fs-rank-num">{rank}</span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div
                        className="fs-row-avatar overflow-hidden flex items-center justify-center border border-white/10"
                        style={{ background: entry.logoUrl ? "#ffffff" : getAvatarColor() }}
                      >
                        {entry.logoUrl ? (
                          <img src={entry.logoUrl} alt={entry.name} className="w-full h-full object-cover" />
                        ) : (
                          getInitials(entry.name)
                        )}
                      </div>

                      {/* Name + bar */}
                      <div className="fs-row-body">
                        <div className="flex items-center gap-2 justify-between">
                          <p className="fs-row-name truncate">{entry.name}</p>
                          {biddingActive && entry.score > 0 && (
                            <span className="bg-amber-100 text-amber-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-amber-200 flex-shrink-0">
                              Bid: {Math.min(entry.bid ?? 10, entry.score)}
                            </span>
                          )}
                        </div>
                        <div className="fs-row-bar-wrap">
                          <div
                            className="fs-row-bar"
                            style={{
                              width: `${barPct}%`,
                              background: isTop3 ? rankColors[rank] : "#f1b307", // Warm Yellow/Gold Palette
                              boxShadow: isTop3 ? `0 0 8px ${rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : '#cd7f32'}88` : "none",
                            }}
                          />
                        </div>
                      </div>

                      {/* Score */}
                      <ScoreCell entry={entry} rank={rank} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>



      {/* ── VISUAL CELEBRATION OVERLAY ── */}
      {celebration && (
        <div className="fs-winner-overlay">
          {/* Confetti Particles (Generated dynamically via inline classes) */}
          <div className="fs-confetti-container">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className={`fs-confetti fs-confetti--${(i % 5) + 1}`}
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${3 + Math.random() * 3}s`,
                  transform: `scale(${0.5 + Math.random()})`,
                }}
              />
            ))}
          </div>

          {/* Winner Card Container */}
          <div className="fs-winner-card">
            <div className="fs-winner-header-icon">
              <span className="material-symbols-outlined text-[48px] animate-bounce">emoji_events</span>
            </div>
            
            <div className="fs-winner-mascot-wrap">
              <img src="/api/mascot" alt="Mascot Bee" className="fs-winner-mascot animate-pulse" />
            </div>

            <p className="fs-winner-tag">ROUND COMPLETED</p>
            <h2 className="fs-winner-title">BIDDING WINNER</h2>

            <div className="fs-winner-avatar-wrap">
              <div className="fs-winner-avatar">
                {getInitials(celebration.name)}
              </div>
            </div>

            <h3 className="fs-winner-name">{celebration.name}</h3>
            
            <div className="fs-winner-points">
              <span className="material-symbols-outlined text-[20px] text-amber-500">add_circle</span>
              <span>{celebration.points} POIN TARUHAN</span>
            </div>

            <div className="fs-winner-footer">
              <span className="spinner border-amber-500 mr-2" style={{ width: 12, height: 12 }} />
              <span>Memulai ronde baru dalam beberapa saat...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
