"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

type ScoreEntry = {
  id: number;
  name: string;
  score: number;
  bid: number;
  groupId: number;
  logoUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Debounced Bid Input ───────────────────────────────────────────────────────
function BidInput({
  entry,
  value,
  isDirty,
  onChange,
}: {
  entry: ScoreEntry;
  value: number;
  isDirty?: boolean;
  onChange: (val: number) => void;
}) {
  const maxBid = Math.max(0, entry.score);
  const currentBid = Math.min(value, maxBid);

  const [localValue, setLocalValue] = useState(currentBid.toString());
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(currentBid.toString());
    }
  }, [currentBid, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let num = parseInt(e.target.value, 10);
    if (isNaN(num)) {
      setLocalValue(e.target.value);
      return;
    }
    if (num < 0) num = 0;
    if (num > maxBid) num = maxBid;
    setLocalValue(num.toString());
  };

  const handleBlur = () => {
    setIsFocused(false);
    let num = parseInt(localValue, 10);
    if (isNaN(num)) num = 10;
    const clamped = Math.max(0, Math.min(num, maxBid));
    setLocalValue(clamped.toString());

    if (clamped !== value) {
      onChange(clamped);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="number"
      value={localValue}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`admin-bid-input ${isDirty ? "border-amber-400 bg-amber-500/5 text-amber-700 font-bold" : ""}`}
      min="0"
      max={maxBid}
    />
  );
}

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

// ─── Competition Modals ───────────────────────────────────────────────────────
function StartCompetitionModal({
  open,
  groupName,
  onClose,
  onStart,
  isPending,
}: {
  open: boolean;
  groupName: string;
  onClose: () => void;
  onStart: (totalSoal: number) => void;
  isPending: boolean;
}) {
  const [totalSoal, setTotalSoal] = useState("5");
  if (!open) return null;

  return (
    <div className="admin-modal-backdrop !z-[100]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal-card max-w-sm">
        <div className="admin-modal-header">
          <h3 className="admin-modal-title flex items-center gap-2">
            <span>🏁</span> Start Lomba Baru
          </h3>
          <button className="admin-modal-close" onClick={onClose} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseInt(totalSoal, 10);
            if (n > 0) onStart(n);
          }}
          className="admin-modal-form"
        >
          <p className="text-xs text-outline font-semibold">
            Mulai sesi lomba untuk grup: <strong className="text-amber-700">{groupName}</strong>
          </p>
          <div className="admin-field">
            <label className="admin-label">JUMLAH SOAL</label>
            <div className="admin-input-wrap">
              <span className="material-symbols-outlined admin-input-icon">quiz</span>
              <input
                type="number"
                min="1"
                max="50"
                value={totalSoal}
                onChange={(e) => setTotalSoal(e.target.value)}
                className="admin-input"
                placeholder="Jumlah soal (e.g. 5)"
              />
            </div>
          </div>
          <button type="submit" disabled={isPending || !totalSoal} className="admin-btn-primary w-full justify-center">
            {isPending ? (
              <><span className="spinner border-white" style={{ width: 14, height: 14 }} /><span>Memulai...</span></>
            ) : (
              <><span className="material-symbols-outlined">play_arrow</span><span>Mulai Lomba</span></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function ResolveNormalModal({
  open,
  roundNumber,
  scores,
  answersMap,
  correctPoints,
  wrongPoints,
  onClose,
  onConfirm,
  isPending,
}: {
  open: boolean;
  roundNumber: number;
  scores: ScoreEntry[];
  answersMap: Record<number, "correct" | "wrong" | "skip">;
  correctPoints: number;
  wrongPoints: number;
  onClose: () => void;
  onConfirm: (correctIds: number[], wrongIds: number[]) => void;
  isPending: boolean;
}) {
  if (!open) return null;

  const correctList = scores.filter((s) => answersMap[s.id] === "correct");
  const wrongList = scores.filter((s) => answersMap[s.id] === "wrong");
  const skipList = scores.filter((s) => !answersMap[s.id] || answersMap[s.id] === "skip");

  return (
    <div className="admin-modal-backdrop !z-[100]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal-card max-w-lg w-full p-0 overflow-hidden rounded-2xl bg-surface border border-outline-variant/30">
        <div className="p-4 border-b border-black/5 bg-emerald-500/10 flex items-center justify-between">
          <h3 className="font-extrabold text-on-surface text-base flex items-center gap-2">
            <span>✅</span> Selesaikan Soal {roundNumber} (Biasa)
          </h3>
          <button className="admin-modal-close" onClick={onClose} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800">
              <p className="font-black text-lg text-emerald-600">{correctList.length}</p>
              <p className="font-extrabold text-[10px] uppercase">✅ Benar ({correctPoints >= 0 ? `+${correctPoints}` : correctPoints})</p>
            </div>
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-800">
              <p className="font-black text-lg text-red-600">{wrongList.length}</p>
              <p className="font-extrabold text-[10px] uppercase">❌ Salah ({wrongPoints >= 0 ? `+${wrongPoints}` : wrongPoints})</p>
            </div>
            <div className="p-2.5 rounded-xl bg-black/5 border border-black/10 text-outline">
              <p className="font-black text-lg text-on-surface">{skipList.length}</p>
              <p className="font-extrabold text-[10px] uppercase">➖ Tidak Jawab (0)</p>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            {[...scores].sort((a, b) => a.id - b.id).map((s) => {
              const ans = answersMap[s.id] || "skip";
              const badge =
                ans === "correct"
                  ? "bg-emerald-500 text-white font-black"
                  : ans === "wrong"
                  ? "bg-red-500 text-white font-black"
                  : "bg-black/10 text-outline font-bold";
              const pts = ans === "correct" ? (correctPoints >= 0 ? `+${correctPoints}` : correctPoints) : ans === "wrong" ? (wrongPoints >= 0 ? `+${wrongPoints}` : wrongPoints) : "0";

              return (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-black/5">
                  <span className="font-bold text-on-surface truncate">{s.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${badge}`}>
                      {ans === "correct" ? "BENAR" : ans === "wrong" ? "SALAH" : "TIDAK JAWAB"}
                    </span>
                    <span className={`font-black w-10 text-right text-xs ${ans === "correct" ? "text-emerald-600" : ans === "wrong" ? "text-red-600" : "text-outline"}`}>
                      {pts}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-black/5 bg-surface-container/20 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="admin-action-btn text-xs px-4 py-2">
            Batal
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onConfirm(correctList.map((c) => c.id), wrongList.map((w) => w.id))}
            className="admin-btn-primary text-xs !py-2 !px-4 flex items-center gap-1.5"
          >
            {isPending ? (
              <><span className="spinner border-white" style={{ width: 12, height: 12 }} /><span>Memproses...</span></>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">check_circle</span><span>Konfirmasi & Simpan</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function BiddingWinnerModal({
  open,
  scores,
  groupName,
  hasUnsavedBids,
  draftBids,
  onClose,
  onSaveAllBids,
  onSelectWinner,
  onSelectNoWinner,
  isPending,
}: {
  open: boolean;
  scores: ScoreEntry[];
  groupName: string;
  hasUnsavedBids: boolean;
  draftBids: Record<number, number>;
  onClose: () => void;
  onSaveAllBids: () => void;
  onSelectWinner: (entry: ScoreEntry) => void;
  onSelectNoWinner: () => void;
  isPending: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="admin-modal-backdrop !z-[100]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="admin-modal-card max-w-2xl w-full max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl bg-surface border border-outline-variant/30">
        <div className="p-5 border-b border-black/5 bg-gradient-to-r from-amber-500/10 via-surface to-amber-500/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[22px]">gavel</span>
            </div>
            <div>
              <h3 className="font-extrabold text-on-surface text-base leading-snug">Penyelesaian Ronde Bidding</h3>
              <p className="text-xs text-outline font-semibold">Grup: <strong className="text-amber-700">{groupName}</strong></p>
            </div>
          </div>
          <button className="admin-modal-close" onClick={onClose} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {hasUnsavedBids && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-400/40 rounded-xl flex items-start justify-between gap-3 text-amber-900 text-xs">
              <div className="flex gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0">warning</span>
                <div>
                  <p className="font-bold">Ada perubahan taruhan yang belum disimpan!</p>
                  <p className="opacity-90">Simpan perubahan taruhan terlebih dahulu agar perhitungan poin akurat.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onSaveAllBids}
                className="bg-amber-500 text-white font-extrabold px-3 py-1.5 rounded-lg shrink-0 text-xs hover:bg-amber-600 transition-colors shadow-sm"
              >
                Simpan Sekarang
              </button>
            </div>
          )}

          <div className="p-4 rounded-xl border-2 border-red-200 bg-red-50/50 hover:bg-red-50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center flex-shrink-0 font-bold">
                  ❌
                </div>
                <div>
                  <h4 className="font-black text-red-900 text-sm">Tidak Ada Pemenang (Jawaban Salah Semua)</h4>
                  <p className="text-xs text-red-700/80 mt-0.5 leading-relaxed">
                    Semua peserta dalam grup ini akan dipotong poinnya sesuai taruhan (bid) masing-masing, dan taruhan akan direset ke 10.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={hasUnsavedBids || isPending}
                onClick={onSelectNoWinner}
                className={`admin-action-btn admin-action-btn--red shrink-0 !py-2 !px-3 font-extrabold text-xs flex items-center gap-1 ${hasUnsavedBids || isPending ? "opacity-50 pointer-events-none" : ""}`}
              >
                {isPending ? (
                  <span className="spinner border-error" style={{ width: 12, height: 12 }} />
                ) : (
                  <span className="material-symbols-outlined text-[16px]">do_not_disturb_on</span>
                )}
                <span>Potong Poin Semua</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 my-2">
            <div className="h-px bg-black/10 flex-1" />
            <span className="text-[10px] font-black uppercase tracking-wider text-outline">ATAU PILIH INSTANSI PEMENANG</span>
            <div className="h-px bg-black/10 flex-1" />
          </div>

          <div className="space-y-2">
            {scores.length === 0 ? (
              <p className="text-xs text-outline text-center py-4">Belum ada peserta di grup ini.</p>
            ) : (
              [...scores].sort((a, b) => a.id - b.id).map((entry, idx) => {
                const isEligible = entry.score > 0;
                const effectiveBid = isEligible
                  ? (draftBids[entry.id] !== undefined ? draftBids[entry.id]! : Math.min(entry.bid ?? 10, entry.score))
                  : 0;
                const isDisabled = hasUnsavedBids || isPending || !isEligible;

                return (
                  <div
                    key={entry.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-colors ${!isEligible ? "bg-surface-container/20 border-black/5 opacity-60" : "bg-white border-black/10 hover:border-amber-400"}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shrink-0 ${entry.logoUrl ? "bg-white border" : getAvatarColor(idx)}`}>
                        {entry.logoUrl ? (
                          <img src={entry.logoUrl} alt={entry.name} className="w-full h-full object-cover" />
                        ) : (
                          getInitials(entry.name)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-on-surface text-xs md:text-sm leading-snug break-words">{entry.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-outline font-semibold mt-0.5">
                          <span>Skor: <strong>{entry.score} pts</strong></span>
                          <span>•</span>
                          <span className="text-amber-700 font-extrabold">
                            Bid: {isEligible ? `${effectiveBid} pts` : "0 pts (Bebas Potong)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => onSelectWinner(entry)}
                      className={`admin-action-btn flex items-center gap-1 text-xs shrink-0 !py-2 !px-3.5 font-extrabold ${isDisabled ? "opacity-40 cursor-not-allowed text-outline" : "text-amber-600 border-amber-300 hover:bg-amber-50 shadow-sm"}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">military_tech</span>
                      <span>{isEligible ? `Menangkan (+${effectiveBid})` : "Poin ≤ 0"}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="p-4 border-t border-black/5 bg-surface-container/20 flex justify-end">
          <button type="button" onClick={onClose} className="admin-action-btn text-xs px-4 py-2">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function CompetitionHistoryModal({
  open,
  groupId,
  groupName,
  onClose,
}: {
  open: boolean;
  groupId: number;
  groupName: string;
  onClose: () => void;
}) {
  const { data: history = [], isLoading } = api.competition.getHistory.useQuery(
    { groupId },
    { enabled: open }
  );

  if (!open) return null;

  return (
    <div className="admin-modal-backdrop !z-[100]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal-card max-w-2xl w-full max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-surface border border-outline-variant/30">
        <div className="p-4 border-b border-black/5 bg-amber-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">equalizer</span>
            <div>
              <h3 className="font-extrabold text-on-surface text-base leading-tight">Riwayat Lomba</h3>
              <p className="text-xs text-outline font-semibold">Grup: <strong className="text-amber-800">{groupName}</strong></p>
            </div>
          </div>
          <button className="admin-modal-close" onClick={onClose} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {isLoading ? (
            <div className="py-10 text-center">
              <span className="spinner border-primary mx-auto" style={{ width: 24, height: 24 }} />
              <p className="text-xs text-outline mt-2 font-bold">Memuat riwayat...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-outline text-xs font-bold">
              <span className="material-symbols-outlined text-[40px] opacity-30 block mb-2">history</span>
              Belum ada riwayat lomba untuk grup ini.
            </div>
          ) : (
            history.map((comp, idx) => (
              <div key={comp.id} className="border border-black/10 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="p-3 bg-surface-container/30 border-b border-black/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-amber-700 text-sm">Lomba #{history.length - idx}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${comp.status === 'completed' ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-700 border border-amber-500/20 animate-pulse'}`}>
                      {comp.status === 'completed' ? 'Selesai' : 'Sedang Berjalan'}
                    </span>
                  </div>
                  <div className="text-[10px] text-outline font-semibold">
                    Total: {comp.totalSoal} Soal · {new Date(comp.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className="divide-y divide-black/5">
                  {comp.rounds.map((round) => (
                    <div key={round.id} className="p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <div className="flex items-center gap-2">
                          <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                            Soal {round.soalNumber}
                          </span>
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${round.isBidding ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                            {round.isBidding ? 'Mode Bidding' : 'Soal Biasa'}
                          </span>
                        </div>
                        {round.isBidding && (
                          <div className="text-[11px] text-outline font-semibold">
                            {round.winnerName ? (
                              <span>Pemenang: <strong className="text-emerald-700">🏆 {round.winnerName}</strong></span>
                            ) : (
                              <span className="text-red-600 font-bold">❌ Tidak Ada Pemenang</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11px]">
                        {round.entries.map((entry) => {
                          const isPos = entry.pointChange > 0;
                          const isNeg = entry.pointChange < 0;
                          const resBadge =
                            entry.result === 'correct' ? '✅ Benar' :
                            entry.result === 'wrong' ? '❌ Salah' :
                            entry.result === 'win' ? '🏆 Menang' :
                            entry.result === 'lose' ? '❌ Kalah' :
                            entry.result === 'no_contest' ? '❌ Salah Semua' : '➖ Tidak Jawab';

                          return (
                            <div key={entry.id} className="flex items-center justify-between p-1.5 rounded bg-surface-container/20 border border-black/5">
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-semibold text-on-surface truncate">{entry.name}</span>
                                <span className="text-[9px] text-outline font-medium">({resBadge})</span>
                              </div>
                              <span className={`font-black ml-2 shrink-0 ${isPos ? 'text-emerald-600' : isNeg ? 'text-red-600' : 'text-outline'}`}>
                                {isPos ? `+${entry.pointChange}` : entry.pointChange}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-black/5 bg-surface-container/20 flex justify-end">
          <button type="button" onClick={onClose} className="admin-action-btn text-xs px-4 py-1.5">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const isError = message.startsWith("❌");
  useEffect(() => { const t = setTimeout(onDone, isError ? 3500 : 2200); return () => clearTimeout(t); }, [onDone, isError]);
  return <div className={`toast ${isError ? "toast-error" : ""}`}>{message}</div>;
}

// ─── Dedicated Lomba Control Page ─────────────────────────────────────────────
export default function AdminLombaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [biddingModalOpen, setBiddingModalOpen] = useState(false);
  const [startCompModalOpen, setStartCompModalOpen] = useState(false);
  const [resolveNormalModalOpen, setResolveNormalModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const [answersMap, setAnswersMap] = useState<Record<number, "correct" | "wrong" | "skip">>({});
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [activeCorrectPoints, setActiveCorrectPoints] = useState(10);
  const [activeWrongPoints, setActiveWrongPoints] = useState(-5);
  const [draftCorrectPoints, setDraftCorrectPoints] = useState(10);
  const [draftWrongPoints, setDraftWrongPoints] = useState(-5);

  useEffect(() => {
    const savedCorrect = localStorage.getItem("correctPoints");
    const savedWrong = localStorage.getItem("wrongPoints");
    if (savedCorrect !== null) {
      setActiveCorrectPoints(parseInt(savedCorrect, 10));
      setDraftCorrectPoints(parseInt(savedCorrect, 10));
    }
    if (savedWrong !== null) {
      setActiveWrongPoints(parseInt(savedWrong, 10));
      setDraftWrongPoints(parseInt(savedWrong, 10));
    }
  }, []);

  const handleSavePoints = () => {
    setActiveCorrectPoints(draftCorrectPoints);
    setActiveWrongPoints(draftWrongPoints);
    localStorage.setItem("correctPoints", draftCorrectPoints.toString());
    localStorage.setItem("wrongPoints", draftWrongPoints.toString());
    setToast("✅ Poin soal berhasil diperbarui!");
  };
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [sidebarGroupsExpanded, setSidebarGroupsExpanded] = useState(false);
  const { data: groups = [] } = api.group.getAll.useQuery();
  const [initialized, setInitialized] = useState(false);

  const [draftBids, setDraftBids] = useState<Record<number, number>>({});

  useEffect(() => {
    setDraftBids({});
    setAnswersMap({});
  }, [activeGroupId]);

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
      const defaultId = groups[0]!.id;
      setActiveGroupId(defaultId);
      setInitialized(true);
    }
  }, [groups, searchParams, initialized]);

  const handleGroupChange = (id: number | null) => {
    setActiveGroupId(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id !== null) {
        url.searchParams.set("groupId", id.toString());
      } else {
        url.searchParams.delete("groupId");
      }
      window.history.pushState(null, "", url.toString());
    }
  };

  const {
    data: scores = [],
    isError: isScoreError,
    error: scoreError,
    isFetching: isScoreFetching,
    refetch: refetchScores,
  } = api.score.getAll.useQuery(
    { groupId: activeGroupId ?? 0 },
    {
      enabled: activeGroupId !== null,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    }
  );
  const utils = api.useUtils();

  const updateScore = api.score.update.useMutation({
    onSuccess: async () => {
      await utils.score.getAll.invalidate();
    },
    onError: (err) => {
      setToast(`❌ Gagal update skor: ${err.message}`);
    },
  });

  const handleAnswerClick = (entry: ScoreEntry, newAns: "correct" | "wrong" | "skip") => {
    const prevAns = answersMap[entry.id] || "skip";
    if (prevAns === newAns) return;

    const prevDelta = prevAns === "correct" ? activeCorrectPoints : prevAns === "wrong" ? activeWrongPoints : 0;
    const newDelta = newAns === "correct" ? activeCorrectPoints : newAns === "wrong" ? activeWrongPoints : 0;
    const diff = newDelta - prevDelta;

    setAnswersMap((prev) => ({ ...prev, [entry.id]: newAns }));

    if (diff !== 0) {
      updateScore.mutate({
        id: entry.id,
        name: entry.name,
        score: entry.score + diff,
        groupId: entry.groupId,
      });
    }
  };

  // ── Competition Queries & Mutations ─────────────────────────────────────────
  const { data: activeCompetition, refetch: refetchActiveComp } = api.competition.getActive.useQuery(
    { groupId: activeGroupId ?? 0 },
    { enabled: activeGroupId !== null }
  );

  const activeRound = activeCompetition?.rounds.find((r) => r.status === "active") ?? null;

  const startCompetition = api.competition.startCompetition.useMutation({
    onSuccess: async () => {
      setToast("🏁 Sesi lomba berhasil dimulai!");
      setStartCompModalOpen(false);
      await refetchActiveComp();
      await utils.score.getAll.invalidate();
    },
    onError: (err) => setToast(`❌ Gagal memulai lomba: ${err.message}`),
  });

  const startNextRound = api.competition.startNextRound.useMutation({
    onSuccess: async () => {
      setToast("➡️ Soal berikutnya dimulai");
      setAnswersMap({});
      await refetchActiveComp();
      await utils.score.getAll.invalidate();
    },
    onError: (err) => setToast(`❌ Gagal ke soal berikutnya: ${err.message}`),
  });

  const toggleRoundBidding = api.competition.toggleRoundBidding.useMutation({
    onSuccess: async () => {
      await refetchActiveComp();
      await utils.score.getAll.invalidate();
    },
    onError: (err) => setToast(`❌ Gagal mengubah mode soal: ${err.message}`),
  });

  const resolveNormalRound = api.competition.resolveNormalRound.useMutation({
    onSuccess: async (data) => {
      setToast(`✅ Soal ${activeRound?.soalNumber ?? 1} selesai: ${data.correctCount} benar, ${data.wrongCount} salah`);
      setResolveNormalModalOpen(false);
      setAnswersMap({});
      await refetchActiveComp();
      await utils.score.getAll.invalidate();
    },
    onError: (err) => setToast(`❌ Gagal menyelesaikan soal: ${err.message}`),
  });

  const resolveBiddingRound = api.competition.resolveBiddingRound.useMutation({
    onSuccess: async (data) => {
      if (data.hasWinner) {
        setToast(`🎉 ${data.winnerName} dinyatakan menang bidding round!`);
      } else {
        setToast("⚠️ Soal Bidding selesai: Tidak ada pemenang, poin semua peserta dipotong.");
      }
      setBiddingModalOpen(false);
      setWinningId(null);
      await refetchActiveComp();
      await utils.score.getAll.invalidate();
    },
    onError: (err) => {
      setToast(`❌ Gagal memproses bidding round: ${err.message}`);
      setWinningId(null);
    },
  });

  const endCompetition = api.competition.endCompetition.useMutation({
    onSuccess: async () => {
      setToast("🏁 Sesi Lomba telah diakhiri. Riwayat tersimpan.");
      await refetchActiveComp();
      await utils.score.getAll.invalidate();
    },
    onError: (err) => setToast(`❌ Gagal mengakhiri lomba: ${err.message}`),
  });

  const { data: rawBiddingActive = false, refetch: refetchBidding } = api.score.isBiddingActive.useQuery(
    { groupId: activeGroupId ?? 0 },
    { enabled: activeGroupId !== null }
  );

  const biddingActive = rawBiddingActive || (activeRound?.isBidding === true);

  const updateMultipleBids = api.score.updateMultipleBids.useMutation({
    onSuccess: async () => {
      setToast("✅ Poin bidding berhasil diperbarui");
      setDraftBids({});
      await utils.score.getAll.invalidate();
    },
    onError: (err) => {
      setToast(`❌ Gagal memperbarui bidding: ${err.message}`);
    },
  });

  const handleSaveAllBids = () => {
    const payload = Object.entries(draftBids).map(([idStr, val]) => ({
      id: parseInt(idStr, 10),
      bid: val,
    }));
    if (payload.length > 0) {
      updateMultipleBids.mutate(payload);
    }
  };

  const changedBids = Object.entries(draftBids).filter(([idStr, val]) => {
    const id = parseInt(idStr, 10);
    const original = scores.find((s) => s.id === id);
    if (!original) return false;
    const dbVal = Math.min(original.bid ?? 10, original.score);
    return val !== dbVal;
  });

  const hasUnsavedBids = changedBids.length > 0;
  const [winningId, setWinningId] = useState<number | null>(null);

  const declareWinner = api.score.declareBiddingWinner.useMutation({
    onSuccess: async (data) => {
      await utils.score.getAll.invalidate();
      setToast(`🎉 ${data.name} dinyatakan menang bidding (+${data.pointsWon} poin)!`);
      setWinningId(null);
      setBiddingModalOpen(false);
    },
    onError: (err) => {
      setToast(`❌ Gagal menentukan pemenang: ${err.message}`);
      setWinningId(null);
    },
  });

  const declareNoWinner = api.score.declareBiddingNoWinner.useMutation({
    onSuccess: async () => {
      await utils.score.getAll.invalidate();
      setToast("⚠️ Ronde Bidding selesai: Tidak ada pemenang, poin semua peserta dipotong.");
      setBiddingModalOpen(false);
    },
    onError: (err) => {
      setToast(`❌ Gagal memproses ronde bidding: ${err.message}`);
    },
  });

  const handleSelectNoWinner = () => {
    if (activeGroupId === null) return;
    if (hasUnsavedBids) {
      setToast("⚠️ Simpan perubahan taruhan terlebih dahulu!");
      return;
    }
    if (
      !confirm(
        "Konfirmasi: Tidak ada pemenang untuk ronde ini (jawaban salah semua)?\nSemua peserta akan dipotong poin sesuai taruhan masing-masing."
      )
    )
      return;

    if (activeRound && activeRound.isBidding) {
      resolveBiddingRound.mutate({ roundId: activeRound.id, winnerId: null });
    } else {
      declareNoWinner.mutate({ groupId: activeGroupId });
    }
  };

  const handleDeclareWinner = (entry: ScoreEntry) => {
    if (hasUnsavedBids) {
      setToast("⚠️ Simpan perubahan taruhan terlebih dahulu sebelum menentukan pemenang!");
      return;
    }
    if (!confirm(`Nyatakan "${entry.name}" sebagai pemenang bidding round? Skor akan bertambah +${entry.bid ?? 10} dan seluruh bid instansi lainnya akan direset ke 10.`)) return;

    if (activeRound && activeRound.isBidding) {
      setWinningId(entry.id);
      resolveBiddingRound.mutate({ roundId: activeRound.id, winnerId: entry.id });
    } else {
      setWinningId(entry.id);
      declareWinner.mutate({ id: entry.id });
    }
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

  const staticScores = [...scores].sort((a, b) => a.id - b.id);
  const filtered = staticScores.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="admin-root">
      {/* Background blobs */}
      <div className="blob blob-1" style={{ opacity: 0.06 }} />
      <div className="blob blob-2" style={{ opacity: 0.06 }} />

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
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>sports_esports</span>
          </div>
          <div>
            <h1 className="admin-sidebar-brand-title">Control Arena</h1>
            <p className="admin-sidebar-brand-sub">Sesi Lomba Live</p>
          </div>
          <button
            className="admin-sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup sidebar"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        <div className="admin-sidebar-section-title">Navigasi Admin</div>
        <nav className="admin-sidebar-nav !gap-2">
          <button
            onClick={() => router.push(`/admin?groupId=${activeGroupId}`)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-black/5 transition-all text-left"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">dashboard</span>
            <span>Dashboard Data & Skor</span>
          </button>

          <button
            onClick={() => {}}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-black bg-amber-500 text-white shadow-sm transition-all text-left"
          >
            <span className="material-symbols-outlined text-[18px]">sports_esports</span>
            <span>Arena Lomba (Live)</span>
          </button>

          <div className="admin-sidebar-divider my-2" />

          <div className="admin-sidebar-section-title">Pilih Grup Lomba</div>
          <div className="px-2">
            <button
              onClick={() => setSidebarGroupsExpanded(!sidebarGroupsExpanded)}
              className="w-full flex items-center justify-between bg-black/5 hover:bg-black/10 border border-black/5 px-3 py-2.5 rounded-xl text-xs font-bold text-on-surface-variant transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">folder_shared</span>
                <span className="truncate">
                  {groups.find((g) => g.id === activeGroupId)?.name ?? "Pilih Grup"}
                </span>
              </div>
              <span className="material-symbols-outlined text-[18px] text-outline">
                {sidebarGroupsExpanded ? "expand_less" : "expand_more"}
              </span>
            </button>

            {sidebarGroupsExpanded && (
              <div className="mt-2 bg-black/5 border border-black/5 rounded-xl overflow-hidden divide-y divide-black/5 animate-fadeIn max-h-[220px] overflow-y-auto">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      handleGroupChange(g.id);
                      setSidebarOpen(false);
                      setSidebarGroupsExpanded(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                      activeGroupId === g.id
                        ? "bg-amber-500 text-white"
                        : "bg-white hover:bg-black/5 text-on-surface-variant"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">
                        {activeGroupId === g.id ? "folder_open" : "folder"}
                      </span>
                      <span>{g.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="admin-sidebar-footer">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-sidebar-view-public"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
            Lihat Halaman Publik
          </a>
          <button
            onClick={() => {
              setIsLoggingOut(true);
              void signOut({ callbackUrl: "/admin/login" });
            }}
            disabled={isLoggingOut}
            className="admin-sidebar-logout"
          >
            {isLoggingOut ? (
              <span className="spinner border-error mr-2" style={{ width: 14, height: 14 }} />
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
            )}
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <div className="admin-content pt-[60px]">
        {/* Top Header Bar */}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button className="admin-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Buka menu">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <h2 className="admin-topbar-title">Arena Control Lomba</h2>
              <p className="admin-topbar-sub">
                Kelola Soal Biasa & Soal Bidding Real-Time
                {session?.user?.name && <> · <strong>{session.user.name}</strong></>}
              </p>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <button
              onClick={() => router.push(`/admin?groupId=${activeGroupId}`)}
              className="admin-action-btn flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Kembali ke Admin</span>
            </button>
          </div>
        </header>

        <main className="admin-main">
          {/* Active Group Banner */}
          <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-2xl mb-4">
            <div className="flex items-center gap-2 text-amber-800">
              <span className="material-symbols-outlined text-[22px] font-extrabold text-amber-600">sports_esports</span>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700/70">Arena Lomba Grup</p>
                <h3 className="text-base font-black text-amber-900 leading-tight">
                  {groups.find((g) => g.id === activeGroupId)?.name ?? "Menghubungkan grup..."}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.open(`/admin/riwayat?groupId=${activeGroupId}`, "_blank")}
                className="admin-action-btn flex items-center gap-1.5 !text-xs !py-1.5 !px-3 text-amber-700 border-amber-300 hover:bg-amber-50 bg-white font-extrabold"
              >
                <span className="material-symbols-outlined text-[18px]">history</span>
                <span>Riwayat Lomba (New Window)</span>
              </button>
            </div>
          </div>

          {/* ── Active Competition Control Banner ── */}
          {activeCompetition ? (
            <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-surface border-2 border-amber-500/40 rounded-2xl p-5 mb-lg shadow-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-xl shrink-0 shadow-md">
                    {activeCompetition.currentSoal}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-on-surface text-lg">
                        LOMBA AKTIF — Soal {activeCompetition.currentSoal} dari {activeCompetition.totalSoal}
                      </h3>
                      <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                        LIVE
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-44 h-2.5 bg-black/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${Math.round((activeCompetition.currentSoal / activeCompetition.totalSoal) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-extrabold text-amber-800">
                        {Math.round((activeCompetition.currentSoal / activeCompetition.totalSoal) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mode Toggle */}
                {activeRound && (
                  <div className="flex items-center bg-white/90 backdrop-blur border border-black/10 rounded-xl p-1 shadow-inner self-start md:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        if (activeRound.isBidding) {
                          toggleRoundBidding.mutate({ roundId: activeRound.id, isBidding: false });
                        }
                      }}
                      disabled={toggleRoundBidding.isPending}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                        !activeRound.isBidding
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-outline hover:bg-black/5"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">edit_note</span>
                      <span>Soal Biasa (+10/-5)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!activeRound.isBidding) {
                          toggleRoundBidding.mutate({ roundId: activeRound.id, isBidding: true });
                        }
                      }}
                      disabled={toggleRoundBidding.isPending}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                        activeRound.isBidding
                          ? "bg-amber-600 text-white shadow-sm animate-pulse"
                          : "text-outline hover:bg-black/5"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">gavel</span>
                      <span>Soal Bidding (Taruhan)</span>
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {activeRound ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeRound.isBidding) {
                          if (hasUnsavedBids) {
                            setToast("⚠️ Simpan perubahan taruhan terlebih dahulu!");
                            return;
                          }
                          setBiddingModalOpen(true);
                        } else {
                          setResolveNormalModalOpen(true);
                        }
                      }}
                      className="admin-btn-primary !py-2.5 !px-4 text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md border-0 font-extrabold"
                    >
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>Selesaikan Soal {activeCompetition.currentSoal}</span>
                    </button>
                  ) : activeCompetition.currentSoal < activeCompetition.totalSoal ? (
                    <button
                      type="button"
                      onClick={() => startNextRound.mutate({ competitionId: activeCompetition.id })}
                      disabled={startNextRound.isPending}
                      className="admin-btn-primary !py-2.5 !px-4 text-xs flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-md border-0 font-extrabold"
                    >
                      {startNextRound.isPending ? (
                        <span className="spinner border-white" style={{ width: 12, height: 12 }} />
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">skip_next</span>
                      )}
                      <span>Mulai Soal {activeCompetition.currentSoal + 1}</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Apakah Anda yakin ingin mengakhiri sesi lomba ini? Data riwayat akan tersimpan.")) {
                        endCompetition.mutate({ competitionId: activeCompetition.id });
                      }
                    }}
                    disabled={endCompetition.isPending}
                    className="admin-action-btn admin-action-btn--red !py-2 !px-3 text-xs flex items-center gap-1 font-extrabold"
                  >
                    {endCompetition.isPending ? (
                      <span className="spinner border-error" style={{ width: 12, height: 12 }} />
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">stop_circle</span>
                    )}
                    <span>Akhiri Lomba</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white border border-black/10 rounded-2xl mb-lg">
              <span className="material-symbols-outlined text-[48px] text-amber-500/40 block mb-2">sports_esports</span>
              <h3 className="font-extrabold text-on-surface text-base">Belum Ada Lomba Berjalan</h3>
              <p className="text-xs text-outline mt-1 mb-4">Mulai lomba baru untuk mengelola soal biasa & soal bidding per ronde.</p>
              <button
                type="button"
                onClick={() => setStartCompModalOpen(true)}
                className="admin-btn-primary !bg-amber-600 hover:!bg-amber-700 !text-white inline-flex items-center gap-2 py-2.5 px-5 text-xs shadow-md"
              >
                <span className="material-symbols-outlined text-[18px]">flag</span>
                <span>Start Lomba Sekarang</span>
              </button>
            </div>
          )}

          {/* ── Table & Inputs ── */}
          <div className="admin-table-card">
            <div className="admin-table-header flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-center gap-2">
                <h3 className="admin-table-title">Daftar Instansi & Status Jawaban</h3>
                <span className="admin-live-badge">
                  <span className="admin-live-dot" />
                  Live
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {activeRound && !activeRound.isBidding && (
                  <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs shadow-sm">
                    <span className="font-bold text-on-surface">Poin Soal:</span>
                    <label className="flex items-center gap-1 text-emerald-600 font-bold">
                      Benar
                      <input 
                        type="number" 
                        value={draftCorrectPoints} 
                        onChange={(e) => setDraftCorrectPoints(parseInt(e.target.value) || 0)} 
                        className="w-14 px-1 py-0.5 text-center border border-emerald-300 rounded outline-none focus:border-emerald-500 bg-white"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-red-600 font-bold ml-2">
                      Salah
                      <input 
                        type="number" 
                        value={draftWrongPoints} 
                        onChange={(e) => setDraftWrongPoints(parseInt(e.target.value) || 0)} 
                        className="w-14 px-1 py-0.5 text-center border border-red-300 rounded outline-none focus:border-red-500 bg-white"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleSavePoints}
                      className="ml-2 bg-primary hover:bg-primary/90 text-on-primary px-3 py-1 rounded font-bold transition-colors shadow-sm text-[10px] uppercase tracking-wide"
                    >
                      Simpan
                    </button>
                  </div>
                )}
                <div className="admin-search-wrap max-w-xs">
                  <span className="material-symbols-outlined admin-search-icon">search</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari..."
                    className="admin-search-input !py-1 text-xs"
                  />
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="admin-empty-state">
                <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>info</span>
                <p>Belum ada peserta di grup ini.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="admin-table-desktop">
                  <table className="admin-table">
                    <thead>
                      <tr className="admin-table-head-row">
                        <th className="admin-th w-16 text-center">Rank</th>
                        <th className="admin-th">Peserta</th>
                        <th className="admin-th w-32 text-right">Skor Saat Ini</th>
                        {activeRound && !activeRound.isBidding && (
                          <th className="admin-th w-64 text-center">Status Jawaban (Soal {activeRound.soalNumber})</th>
                        )}
                        {biddingActive && <th className="admin-th w-40 text-center">Bidding Poin</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((entry, idx) => {
                        const rank = scores.findIndex((s) => s.id === entry.id) + 1;
                        const isTop3 = rank <= 3;
                        const rankGrad =
                          rank === 1 ? "rank-gradient-1 text-on-tertiary-fixed" :
                          rank === 2 ? "rank-gradient-2 text-on-surface-variant" :
                          rank === 3 ? "rank-gradient-3 text-on-tertiary" : "";

                        return (
                          <tr key={entry.id} className="admin-table-row">
                            <td className="admin-td text-center">
                              {isTop3 ? (
                                <div className={`admin-rank-badge ${rankGrad}`}>
                                  <span className="relative z-10">{rank}</span>
                                </div>
                              ) : (
                                <span className="font-bold text-outline text-sm">{rank}</span>
                              )}
                            </td>
                            <td className="admin-td">
                              <div className="flex items-center gap-3">
                                <div className={`admin-avatar overflow-hidden ${entry.logoUrl ? "bg-white border" : getAvatarColor(idx)}`}>
                                  {entry.logoUrl ? (
                                    <img src={entry.logoUrl} alt={entry.name} className="w-full h-full object-cover" />
                                  ) : (
                                    getInitials(entry.name)
                                  )}
                                </div>
                                <span className="font-bold text-on-surface text-sm">{entry.name}</span>
                              </div>
                            </td>
                            <td className="admin-td text-right">
                              <span className="text-xl font-extrabold text-primary">{entry.score.toLocaleString()}</span>
                            </td>

                            {/* 3-State Answer Selector for Normal Round */}
                            {activeRound && !activeRound.isBidding && (
                              <td className="admin-td text-center">
                                <div className="flex items-center justify-center gap-1 bg-black/5 p-1 rounded-xl">
                                  <button
                                    type="button"
                                    onClick={() => handleAnswerClick(entry as ScoreEntry, "correct")}
                                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                                      answersMap[entry.id] === "correct"
                                        ? "bg-emerald-500 text-white shadow-sm scale-105"
                                        : "text-emerald-700 hover:bg-emerald-500/10"
                                    }`}
                                  >
                                    <span>✅</span>
                                    <span className="text-[11px]">Benar ({activeCorrectPoints >= 0 ? `+${activeCorrectPoints}` : activeCorrectPoints})</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleAnswerClick(entry as ScoreEntry, "wrong")}
                                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                                      answersMap[entry.id] === "wrong"
                                        ? "bg-red-500 text-white shadow-sm scale-105"
                                        : "text-red-700 hover:bg-red-500/10"
                                    }`}
                                  >
                                    <span>❌</span>
                                    <span className="text-[11px]">Salah ({activeWrongPoints >= 0 ? `+${activeWrongPoints}` : activeWrongPoints})</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleAnswerClick(entry as ScoreEntry, "skip")}
                                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                                      !answersMap[entry.id] || answersMap[entry.id] === "skip"
                                        ? "bg-gray-700 text-white shadow-sm scale-105"
                                        : "text-outline hover:bg-black/10"
                                    }`}
                                  >
                                    <span>➖</span>
                                    <span className="text-[11px]">Tidak Jawab (0)</span>
                                  </button>
                                </div>
                              </td>
                            )}

                            {/* Bid Input for Bidding Round */}
                            {biddingActive && (
                              <td className="admin-td text-center">
                                <div className="flex justify-center">
                                  {entry.score > 0 ? (
                                    <div className="flex items-center gap-1.5 justify-center">
                                      <BidInput
                                        entry={entry as ScoreEntry}
                                        value={draftBids[entry.id] !== undefined ? draftBids[entry.id]! : Math.min(entry.bid ?? 10, entry.score)}
                                        isDirty={draftBids[entry.id] !== undefined && draftBids[entry.id] !== Math.min(entry.bid ?? 10, entry.score)}
                                        onChange={(newVal) => {
                                          setDraftBids((prev) => ({
                                            ...prev,
                                            [entry.id]: newVal,
                                          }));
                                        }}
                                      />
                                      {draftBids[entry.id] !== undefined && draftBids[entry.id] !== Math.min(entry.bid ?? 10, entry.score) && (
                                        <span className="w-2.5 h-2.5 bg-amber-500 rounded-full flex-shrink-0 animate-pulse" title="Belum disimpan" />
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-outline text-xs font-semibold">—</span>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    {biddingActive && hasUnsavedBids && (
                      <tfoot>
                        <tr className="border-t border-black/10 bg-surface-container/30">
                          <td colSpan={3}></td>
                          <td className="admin-td text-center p-2">
                            <button
                              onClick={handleSaveAllBids}
                              disabled={updateMultipleBids.isPending}
                              className="admin-btn-primary !py-1.5 !px-3 !h-auto text-xs flex items-center gap-1 mx-auto shadow-md"
                            >
                              {updateMultipleBids.isPending ? (
                                <span className="spinner border-white" style={{ width: 12, height: 12 }} />
                              ) : (
                                <span className="material-symbols-outlined text-[16px]">save</span>
                              )}
                              <span>Simpan Taruhan ({changedBids.length})</span>
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Mobile Card List */}
                <div className="admin-mobile-list">
                  {filtered.map((entry, idx) => {
                    const rank = scores.findIndex((s) => s.id === entry.id) + 1;
                    return (
                      <div key={entry.id} className="admin-mobile-card">
                        <div className="admin-mobile-card-top">
                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-primary text-lg w-6 text-center">{rank}</span>
                            <div className={`admin-avatar overflow-hidden ${entry.logoUrl ? "bg-white border" : getAvatarColor(idx)}`}>
                              {entry.logoUrl ? (
                                <img src={entry.logoUrl} alt={entry.name} className="w-full h-full object-cover" />
                              ) : (
                                getInitials(entry.name)
                              )}
                            </div>
                            <p className="font-bold text-on-surface text-sm">{entry.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-extrabold text-primary">{entry.score.toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Mobile Answer Selector */}
                        {activeRound && !activeRound.isBidding && (
                          <div className="flex items-center justify-between border-t border-black/5 pt-2 mt-2 px-1">
                            <span className="text-[10px] font-extrabold text-outline uppercase tracking-wider">
                              Jawaban Soal {activeRound.soalNumber}
                            </span>
                            <div className="flex items-center justify-center gap-1 bg-black/5 p-1 rounded-xl">
                              <button
                                type="button"
                                onClick={() => handleAnswerClick(entry as ScoreEntry, "correct")}
                                className={`px-2 py-0.5 rounded-lg text-xs font-black transition-all flex items-center gap-0.5 ${
                                  answersMap[entry.id] === "correct" ? "bg-emerald-500 text-white shadow-sm" : "text-emerald-700"
                                }`}
                              >
                                <span>✅</span>
                                <span className="text-[10px]">+10</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAnswerClick(entry as ScoreEntry, "wrong")}
                                className={`px-2 py-0.5 rounded-lg text-xs font-black transition-all flex items-center gap-0.5 ${
                                  answersMap[entry.id] === "wrong" ? "bg-red-500 text-white shadow-sm" : "text-red-700"
                                }`}
                              >
                                <span>❌</span>
                                <span className="text-[10px]">-5</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAnswerClick(entry as ScoreEntry, "skip")}
                                className={`px-2 py-0.5 rounded-lg text-xs font-black transition-all flex items-center gap-0.5 ${
                                  !answersMap[entry.id] || answersMap[entry.id] === "skip" ? "bg-gray-700 text-white shadow-sm" : "text-outline"
                                }`}
                              >
                                <span>➖</span>
                                <span className="text-[10px]">0</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Mobile Bid input row */}
                        {biddingActive && entry.score > 0 && (
                          <div className="admin-mobile-card-bid flex items-center justify-between border-t border-black/5 pt-2 mt-2 px-1">
                            <span className="text-[10px] font-extrabold text-outline uppercase tracking-wider">Bidding Poin</span>
                            <BidInput
                              entry={entry as ScoreEntry}
                              value={draftBids[entry.id] !== undefined ? draftBids[entry.id]! : Math.min(entry.bid ?? 10, entry.score)}
                              isDirty={draftBids[entry.id] !== undefined && draftBids[entry.id] !== Math.min(entry.bid ?? 10, entry.score)}
                              onChange={(newVal) => {
                                setDraftBids((prev) => ({
                                  ...prev,
                                  [entry.id]: newVal,
                                }));
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      <BiddingWinnerModal
        open={biddingModalOpen}
        scores={scores}
        groupName={groups.find((g) => g.id === activeGroupId)?.name ?? ""}
        hasUnsavedBids={hasUnsavedBids}
        draftBids={draftBids}
        onClose={() => setBiddingModalOpen(false)}
        onSaveAllBids={handleSaveAllBids}
        onSelectWinner={(entry) => handleDeclareWinner(entry)}
        onSelectNoWinner={handleSelectNoWinner}
        isPending={declareWinner.isPending || declareNoWinner.isPending || resolveBiddingRound.isPending}
      />
      <StartCompetitionModal
        open={startCompModalOpen}
        groupName={groups.find((g) => g.id === activeGroupId)?.name ?? ""}
        onClose={() => setStartCompModalOpen(false)}
        onStart={(total) => {
          if (activeGroupId !== null) {
            startCompetition.mutate({ groupId: activeGroupId, totalSoal: total });
          }
        }}
        isPending={startCompetition.isPending}
      />
      <ResolveNormalModal
        open={resolveNormalModalOpen}
        roundNumber={activeRound?.soalNumber ?? 1}
        scores={scores}
        answersMap={answersMap}
        correctPoints={activeCorrectPoints}
        wrongPoints={activeWrongPoints}
        onClose={() => setResolveNormalModalOpen(false)}
        onConfirm={(correctIds, wrongIds) => {
          if (activeRound) {
            resolveNormalRound.mutate({ roundId: activeRound.id, correctIds, wrongIds, correctPoints: activeCorrectPoints, wrongPoints: activeWrongPoints });
          }
        }}
        isPending={resolveNormalRound.isPending}
      />
      <CompetitionHistoryModal
        open={historyModalOpen}
        groupId={activeGroupId ?? 0}
        groupName={groups.find((g) => g.id === activeGroupId)?.name ?? ""}
        onClose={() => setHistoryModalOpen(false)}
      />
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}
