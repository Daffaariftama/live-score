"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

export default function AdminRiwayatPage() {
  const { status } = useSession();
  const router = useRouter();
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
    const url = new URL(window.location.href);
    url.searchParams.set("groupId", id.toString());
    window.history.pushState(null, "", url.toString());
  };

  const [toast, setToast] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const utils = api.useUtils();

  const { data: history = [], isLoading, refetch: refetchHistory } = api.competition.getHistory.useQuery(
    { groupId: activeGroupId ?? 0 },
    { enabled: activeGroupId !== null }
  );

  const deleteCompetition = api.competition.deleteCompetition.useMutation({
    onSuccess: async () => {
      setToast("✅ Sesi lomba berhasil dihapus");
      setDeletingId(null);
      await refetchHistory();
    },
    onError: (err) => {
      setToast(`❌ Gagal menghapus sesi: ${err.message}`);
      setDeletingId(null);
    },
  });

  const handleDeleteSession = (compId: number, sessionNum: number) => {
    if (!confirm(`Konfirmasi: Apakah Anda yakin ingin menghapus permanen Sesi Lomba #${sessionNum} beserta seluruh log riwayat soalnya?`)) return;
    setDeletingId(compId);
    deleteCompetition.mutate({ competitionId: compId });
  };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/admin/login");
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="spinner border-primary" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const activeGroupName = groups.find((g) => g.id === activeGroupId)?.name ?? "Pilih Grup";

  return (
    <div className="min-h-screen bg-surface text-on-surface p-4 md:p-8">
      {/* Header Bar */}
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-black/10 p-6 rounded-2xl shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <span className="material-symbols-outlined text-[24px]">analytics</span>
              <span className="text-xs font-black uppercase tracking-wider">Laporan & Auditing Live Score</span>
            </div>
            <h1 className="text-2xl font-black text-on-surface">Riwayat Detail Lomba per Soal</h1>
            <p className="text-xs text-outline font-semibold mt-1">
              Breakdown per nomor soal, status jawaban, nilai taruhan, perubahan poin (Δ), dan akumulasi poin berjalan.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Group Filter Selector */}
            <div className="flex items-center gap-2 bg-surface-container/30 border border-black/10 px-3 py-2 rounded-xl text-xs">
              <span className="material-symbols-outlined text-[18px] text-primary">folder_shared</span>
              <select
                value={activeGroupId ?? 0}
                onChange={(e) => handleGroupChange(parseInt(e.target.value, 10))}
                className="bg-transparent font-extrabold text-on-surface focus:outline-none cursor-pointer"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => window.print()}
              className="admin-action-btn flex items-center gap-1.5 text-xs px-4 py-2 bg-white"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Cetak / Print</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="p-16 text-center bg-white border border-black/10 rounded-2xl">
            <span className="spinner border-primary mx-auto" style={{ width: 32, height: 32 }} />
            <p className="text-xs text-outline font-bold mt-3">Memuat data riwayat lengkap...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="p-16 text-center bg-white border border-black/10 rounded-2xl">
            <span className="material-symbols-outlined text-[56px] text-outline/30 block mb-3">history_toggle_off</span>
            <h3 className="font-extrabold text-base">Belum Ada Riwayat Lomba</h3>
            <p className="text-xs text-outline mt-1">Sesi lomba untuk grup {activeGroupName} belum pernah dilaksanakan.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {history.map((comp, compIdx) => {
              const runningScores: Record<number, number> = {};

              // Final round entries to determine the Winner of this session
              const lastRound = comp.rounds[comp.rounds.length - 1];
              const winner = lastRound && lastRound.entries.length > 0
                ? [...lastRound.entries].sort((a, b) => (b.scoreAfter ?? 0) - (a.scoreAfter ?? 0))[0]
                : null;

              return (
                <div key={comp.id} className="bg-white border-2 border-black/10 rounded-2xl overflow-hidden shadow-sm space-y-4 p-6">
                  {/* Session Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-black/10 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white font-black text-base flex items-center justify-center shadow-sm">
                        #{history.length - compIdx}
                      </div>
                      <div>
                        <h2 className="font-black text-lg text-on-surface">Sesi Lomba #{history.length - compIdx}</h2>
                        <p className="text-xs text-outline font-semibold">
                          Grup: <strong className="text-amber-800">{activeGroupName}</strong> · Total Soal: <strong>{comp.totalSoal}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 text-xs font-bold">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${comp.status === "completed" ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20" : "bg-amber-500/10 text-amber-700 border border-amber-500/20 animate-pulse"}`}>
                        {comp.status === "completed" ? "✅ LOMBA SELESAI" : "⚡ SEDANG BERJALAN"}
                      </span>
                      <span className="text-outline">
                        {new Date(comp.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeleteSession(comp.id, history.length - compIdx)}
                        disabled={deletingId === comp.id}
                        className="admin-action-btn admin-action-btn--red font-extrabold text-xs px-3 py-1 ml-2 flex items-center gap-1 shrink-0"
                        title="Hapus Sesi Lomba"
                      >
                        {deletingId === comp.id ? (
                          <span className="spinner border-error" style={{ width: 12, height: 12 }} />
                        ) : (
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        )}
                        <span>Hapus Sesi</span>
                      </button>
                    </div>
                  </div>

                  {/* ── Winner / Pemenang Sesi Banner ── */}
                  {winner && (
                    <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white font-black text-xl flex items-center justify-center shadow-sm shrink-0">
                          🏆
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-amber-900 tracking-wider">PEMENANG SESI LOMBA INI</p>
                          <h4 className="font-extrabold text-base text-on-surface">{winner.name}</h4>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-outline font-bold uppercase">SKOR AKHIR</p>
                        <p className="font-black text-lg text-primary">{winner.scoreAfter} pts</p>
                      </div>
                    </div>
                  )}

                  {/* Rounds Breakdown */}
                  <div className="space-y-6">
                    {comp.rounds.map((round) => {
                      // Update running totals for each entry in this round
                      round.entries.forEach((e) => {
                        runningScores[e.scoreId] = (runningScores[e.scoreId] ?? 0) + e.pointChange;
                      });

                      return (
                        <div key={round.id} className="border border-black/10 rounded-xl overflow-hidden bg-surface-container/10">
                          {/* Round Header */}
                          <div className="p-4 bg-surface-container/30 border-b border-black/10 flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <span className="bg-amber-500 text-white font-black text-xs px-3 py-1 rounded-lg">
                                SOAL #{round.soalNumber}
                              </span>
                              <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full ${round.isBidding ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-blue-100 text-blue-800 border border-blue-300"}`}>
                                {round.isBidding ? "⚡ Mode Bidding (Taruhan)" : "📝 Mode Soal Biasa (+10/-5)"}
                              </span>
                            </div>

                            {round.isBidding && (
                              <div className="text-xs font-extrabold">
                                {round.winnerName ? (
                                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                                    🏆 Pemenang: <strong>{round.winnerName}</strong>
                                  </span>
                                ) : (
                                  <span className="text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-lg">
                                    ❌ Tidak Ada Pemenang (Salah Semua)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Round Entries Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="bg-black/5 text-outline uppercase font-black text-[10px] tracking-wider border-b border-black/10">
                                  <th className="py-2.5 px-4 w-12 text-center">#</th>
                                  <th className="py-2.5 px-4">Instansi Peserta</th>
                                  <th className="py-2.5 px-4 text-center">Status Jawaban</th>
                                  {round.isBidding && <th className="py-2.5 px-4 text-center">Nilai Taruhan (Bid)</th>}
                                  <th className="py-2.5 px-4 text-right">Perubahan Poin (Δ)</th>
                                  <th className="py-2.5 px-4 text-right">Akumulasi Poin (Running Total)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-black/5 bg-white">
                                {[...round.entries].sort((a, b) => a.scoreId - b.scoreId).map((entry, idx) => {
                                  const isPos = entry.pointChange > 0;
                                  const isNeg = entry.pointChange < 0;

                                  const resultBadge =
                                    entry.result === "correct" ? (
                                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">✅ Benar (+10)</span>
                                    ) : entry.result === "wrong" ? (
                                      <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full text-[10px]">❌ Salah (-5)</span>
                                    ) : entry.result === "win" ? (
                                      <span className="bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-full text-[10px]">🏆 Menang Bidding</span>
                                    ) : entry.result === "lose" ? (
                                      <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full text-[10px]">❌ Kalah Bidding</span>
                                    ) : entry.result === "no_contest" ? (
                                      <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full text-[10px]">❌ Salah Semua</span>
                                    ) : entry.result === "ineligible" ? (
                                      <span className="bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-full text-[10px]">⛔ Poin ≤ 0 (Bebas Potong)</span>
                                    ) : (
                                      <span className="bg-black/5 text-outline font-bold px-2 py-0.5 rounded-full text-[10px]">➖ Tidak Jawab (0)</span>
                                    );

                                  const finalScore = (entry as any).scoreAfter !== undefined && (entry as any).scoreAfter !== null
                                    ? (entry as any).scoreAfter
                                    : Math.max(0, runningScores[entry.scoreId] ?? 0);

                                  return (
                                    <tr key={entry.id} className="hover:bg-amber-50/30 transition-colors">
                                      <td className="py-2.5 px-4 text-center font-extrabold text-outline">{idx + 1}</td>
                                      <td className="py-2.5 px-4 font-bold text-on-surface">{entry.name}</td>
                                      <td className="py-2.5 px-4 text-center">{resultBadge}</td>
                                      {round.isBidding && (
                                        <td className="py-2.5 px-4 text-center font-bold text-amber-700">
                                          {entry.bidAmount > 0 ? `${entry.bidAmount} pts` : "—"}
                                        </td>
                                      )}
                                      <td className={`py-2.5 px-4 text-right font-black text-sm ${isPos ? "text-emerald-600" : isNeg ? "text-red-600" : "text-outline"}`}>
                                        {isPos ? `+${entry.pointChange}` : entry.pointChange}
                                      </td>
                                      <td className="py-2.5 px-4 text-right font-black text-primary text-sm">
                                        {finalScore} pts
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
