"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";

type ScoreEntry = { id: number; name: string; score: number; bid: number; groupId: number; logoUrl?: string | null; createdAt: Date; updatedAt: Date };

// ─── Modal tambah / edit ───────────────────────────────────────────────────────
function Modal({ open, entry, groups, activeGroupId, onClose, onSaved }: {
  open: boolean;
  entry: ScoreEntry | null;
  groups: { id: number; name: string }[];
  activeGroupId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [score, setScore] = useState("");
  const [groupId, setGroupId] = useState(activeGroupId);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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
      setGroupId(entry?.groupId ?? activeGroupId);
      setLogoUrl(entry?.logoUrl ?? null);
      setCropImageSrc(null);
      setError("");
    }
  }, [open, entry, activeGroupId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Nama kementerian tidak boleh kosong."); return; }
    const s = parseInt(score, 10);
    if (isNaN(s)) { setError("Skor harus berupa angka."); return; }
    if (entry) update.mutate({ id: entry.id, name: name.trim(), score: s, groupId, logoUrl });
    else create.mutate({ name: name.trim(), score: s, groupId, logoUrl });
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
          <div className="admin-field">
            <label className="admin-label" htmlFor="modal-group">GRUP KATEGORI</label>
            <div className="admin-input-wrap">
              <span className="material-symbols-outlined admin-input-icon">folder_shared</span>
              <select
                id="modal-group"
                value={groupId}
                onChange={(e) => setGroupId(parseInt(e.target.value, 10))}
                className="admin-input"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin-field">
            <label className="admin-label">LOGO INSTANSI (OPSIONAL)</label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <div className="relative w-12 h-12 rounded-xl border border-black/10 overflow-hidden bg-surface-container flex-shrink-0 flex items-center justify-center">
                  <img src={logoUrl} alt="Logo preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    title="Hapus logo"
                  >
                    <span className="material-symbols-outlined" style={{fontSize: 16}}>delete</span>
                  </button>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl border border-dashed border-outline-variant flex items-center justify-center text-outline flex-shrink-0">
                  <span className="material-symbols-outlined" style={{fontSize: 20}}>image</span>
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="hidden"
                  id="modal-logo-file"
                />
                <label
                  htmlFor="modal-logo-file"
                  className={`admin-action-btn cursor-pointer inline-flex items-center gap-1.5 ${uploading ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <span className="material-symbols-outlined" style={{fontSize:16}}>upload_file</span>
                  <span>{uploading ? "Mengunggah..." : logoUrl ? "Ganti Logo" : "Pilih Logo"}</span>
                </label>
              </div>
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
            disabled={isPending || uploading}
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

      {cropImageSrc && (
        <ImageCropperModal
          imageSrc={cropImageSrc}
          onCancel={() => setCropImageSrc(null)}
          onCrop={async (croppedFile) => {
            setUploading(true);
            setError("");
            setCropImageSrc(null);

            const formData = new FormData();
            formData.append("file", croppedFile);

            try {
              const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
              });

              if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Gagal mengunggah gambar");
              }

              const data = await res.json();
              setLogoUrl(data.url);
            } catch (err: any) {
              setError(err.message || "Terjadi kesalahan saat mengunggah");
            } finally {
              setUploading(false);
            }
          }}
        />
      )}
    </div>
  );
}

function ImageCropperModal({
  imageSrc,
  onCrop,
  onCancel,
}: {
  imageSrc: string;
  onCrop: (croppedFile: File) => void;
  onCancel: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    setIsDragging(true);
    dragStart.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    if (!touch) return;
    setPosition({
      x: touch.clientX - dragStart.current.x,
      y: touch.clientY - dragStart.current.y
    });
  };

  const handleSave = () => {
    const img = imgRef.current;
    if (!img) return;

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 256, 256);

    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    ctx.clip();

    const imgRect = img.getBoundingClientRect();
    const container = img.parentElement;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    const viewportSize = 240;
    const viewportLeft = containerRect.left + (containerRect.width - viewportSize) / 2;
    const viewportTop = containerRect.top + (containerRect.height - viewportSize) / 2;

    const xOffsetInViewport = imgRect.left - viewportLeft;
    const yOffsetInViewport = imgRect.top - viewportTop;

    const scaleToCanvas = 256 / viewportSize;

    ctx.drawImage(
      img,
      xOffsetInViewport * scaleToCanvas,
      yOffsetInViewport * scaleToCanvas,
      imgRect.width * scaleToCanvas,
      imgRect.height * scaleToCanvas
    );

    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], "logo-cropped.png", { type: "image/png" });
        onCrop(croppedFile);
      }
    }, "image/png");
  };

  return (
    <div className="admin-modal-backdrop !z-[100]">
      <div className="admin-modal-card max-w-[340px] p-4 text-center">
        <h3 className="admin-modal-title mb-2 text-base">Sesuaikan Logo</h3>
        <p className="text-outline text-xs mb-4">Geser gambar dan atur zoom agar pas di dalam lingkaran.</p>

        <div
          className="relative w-[280px] h-[280px] overflow-hidden bg-surface-container rounded-2xl mx-auto cursor-move select-none border border-black/5"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop area"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              margin: "auto",
            }}
            draggable={false}
          />
          {/* Circular mask overlay */}
          <div className="absolute inset-0 pointer-events-none border-[20px] border-black/50 rounded-2xl flex items-center justify-center">
            <div className="w-[240px] h-[240px] rounded-full border-2 border-dashed border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
          </div>
        </div>

        {/* Zoom slider control */}
        <div className="my-4 px-2">
          <div className="flex justify-between text-[10px] text-outline font-extrabold uppercase mb-1">
            <span>Zoom</span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        {/* Control buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="admin-action-btn flex-1 text-xs"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="admin-btn-primary flex-1 text-xs py-2 !h-auto flex justify-center items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>Terapkan</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Debounced Bid Input ───────────────────────────────────────────────────────
function BidInput({ entry, value, isDirty, onChange }: { entry: ScoreEntry; value: number; isDirty?: boolean; onChange: (val: number) => void }) {
  const maxBid = Math.max(0, entry.score);
  const currentBid = Math.min(value, maxBid);

  const [localValue, setLocalValue] = useState(currentBid.toString());
  const [isFocused, setIsFocused] = useState(false);

  // Sync with prop updates ONLY when not focused
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

// ─── Group Manager Modal ────────────────────────────────────────────────────────
function GroupManagerModal({
  open,
  groups,
  onClose,
  activeGroupId,
  setActiveGroupId,
}: {
  open: boolean;
  groups: { id: number; name: string }[];
  onClose: () => void;
  activeGroupId: number | null;
  setActiveGroupId: (id: number | null) => void;
}) {
  const [newGroupName, setNewGroupName] = useState("");
  const [error, setError] = useState("");
  const utils = api.useUtils();

  const createGroup = api.group.create.useMutation({
    onSuccess: async () => {
      await utils.group.getAll.invalidate();
      setNewGroupName("");
      setError("");
    },
    onError: (err) => setError(err.message || "Gagal membuat grup"),
  });

  const deleteGroup = api.group.delete.useMutation({
    onSuccess: async (deletedGroup) => {
      await utils.group.getAll.invalidate();
      await utils.score.getAll.invalidate();
      // If the active group was deleted, switch active group to another one
      if (activeGroupId === deletedGroup.id) {
        const remaining = groups.filter((g) => g.id !== deletedGroup.id);
        if (remaining.length > 0) {
          setActiveGroupId(remaining[0]!.id);
        } else {
          setActiveGroupId(null);
        }
      }
    },
    onError: (err) => setError(err.message || "Gagal menghapus grup"),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    createGroup.mutate({ name: newGroupName.trim() });
  };

  const handleDelete = (id: number, name: string) => {
    if (
      !confirm(
        `⚠️ Hapus "${name}"?\nPENTING: Menghapus grup ini akan menghapus semua instansi kementerian di dalamnya secara permanen!`
      )
    ) {
      return;
    }
    deleteGroup.mutate({ id });
  };

  if (!open) return null;

  return (
    <div className="admin-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal-card max-w-[420px]">
        <div className="admin-modal-header">
          <h3 className="admin-modal-title">Kelola Grup Klasemen</h3>
          <button className="admin-modal-close" onClick={onClose} aria-label="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Form Tambah Grup */}
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              type="text"
              placeholder="Nama Grup Baru (misal: Grup C)"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="admin-input flex-1"
              disabled={createGroup.isPending}
            />
            <button
              type="submit"
              disabled={createGroup.isPending || !newGroupName.trim()}
              className="px-4 py-2 bg-amber-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 hover:bg-amber-600 disabled:opacity-50 transition-all"
            >
              {createGroup.isPending ? (
                <span className="spinner border-white" style={{ width: 12, height: 12 }} />
              ) : (
                <span className="material-symbols-outlined text-[16px]">add</span>
              )}
              <span>Tambah</span>
            </button>
          </form>

          {error && (
            <div className="text-xs text-error font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Daftar Grup */}
          <div className="border border-black/5 rounded-2xl overflow-hidden bg-black/5 max-h-[220px] overflow-y-auto">
            {groups.length === 0 ? (
              <p className="p-4 text-xs text-outline text-center font-bold">Belum ada grup terdaftar</p>
            ) : (
              <div className="divide-y divide-black/5">
                {groups.map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-3 bg-white">
                    <span className="text-sm font-bold text-on-surface">{g.name}</span>
                    <button
                      onClick={() => handleDelete(g.id, g.name)}
                      disabled={deleteGroup.isPending}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-error hover:bg-error/10 disabled:opacity-50 transition-all"
                      title="Hapus Grup"
                    >
                      {deleteGroup.isPending ? (
                        <span className="spinner border-error" style={{ width: 12, height: 12 }} />
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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

// ─── Admin Page ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [modalOpen, setModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<ScoreEntry | null>(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [sidebarGroupsExpanded, setSidebarGroupsExpanded] = useState(false);
  const { data: groups = [] } = api.group.getAll.useQuery();
  const [initialized, setInitialized] = useState(false);

  const [draftBids, setDraftBids] = useState<Record<number, number>>({});

  useEffect(() => {
    setDraftBids({});
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
      // Synchronize URL query parameter with default group
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("groupId", defaultId.toString());
        window.history.replaceState(null, "", url.toString());
      }
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

  const { data: biddingActive = false, refetch: refetchBidding } = api.score.isBiddingActive.useQuery(
    { groupId: activeGroupId ?? 0 },
    { enabled: activeGroupId !== null }
  );

  const toggleBidding = api.score.setBiddingActive.useMutation({
    onSuccess: async () => {
      await refetchBidding();
      await utils.group.getAll.invalidate();
      setToast(`✅ Sesi bidding ${!biddingActive ? "diaktifkan" : "dinonaktifkan"}`);
    },
    onError: (err) => {
      setToast(`❌ Gagal mengubah sesi bidding: ${err.message}`);
    },
  });

  useEffect(() => {
    if (biddingActive) {
      const activeGroupName = groups.find((g) => g.id === activeGroupId)?.name ?? "";
      document.title = `⚠️ [BIDDING AKTIF: ${activeGroupName}] - Admin Panel`;
      const interval = setInterval(() => {
        document.title = document.title.startsWith("⚠️")
          ? `🚨 [LIVE BIDDING: ${activeGroupName}]`
          : `⚠️ [BIDDING AKTIF: ${activeGroupName}] - Admin Panel`;
      }, 1000);
      return () => {
        clearInterval(interval);
        document.title = "Admin Panel";
      };
    } else {
      document.title = "Admin Panel";
    }
  }, [biddingActive, activeGroupId, groups]);

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
    },
    onError: (err) => {
      setToast(`❌ Gagal menentukan pemenang: ${err.message}`);
      setWinningId(null);
    },
  });

  const handleDeclareWinner = (entry: ScoreEntry) => {
    if (hasUnsavedBids) {
      setToast("⚠️ Simpan perubahan taruhan terlebih dahulu sebelum menentukan pemenang!");
      return;
    }
    if (!confirm(`Nyatakan "${entry.name}" sebagai pemenang bidding round? Skor akan bertambah +${entry.bid ?? 10} dan seluruh bid instansi lainnya akan direset ke 10.`)) return;
    setWinningId(entry.id);
    declareWinner.mutate({ id: entry.id });
  };

  const resetGroupScores = api.score.resetGroupScores.useMutation({
    onSuccess: async () => {
      setToast("✅ Skor grup berhasil di-reset");
      await utils.score.getAll.invalidate();
    },
    onError: (err) => {
      setToast(`❌ Gagal reset skor: ${err.message}`);
    },
  });

  const handleResetScores = (scoreVal: number) => {
    if (activeGroupId === null) return;
    const groupName = groups.find((g) => g.id === activeGroupId)?.name ?? "";
    if (
      !confirm(
        `APAKAH ANDA YAKIN?\nSemua skor kementerian dalam grup "${groupName}" akan di-reset menjadi ${scoreVal}!`
      )
    )
      return;
    resetGroupScores.mutate({ groupId: activeGroupId, scoreValue: scoreVal });
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
    updateScore.mutate({ id: entry.id, name: entry.name, score: entry.score + delta, groupId: entry.groupId });
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

        <div className="admin-sidebar-section-title">Pilih Grup Klasemen</div>
        <nav className="admin-sidebar-nav !gap-3">
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
                {groups.find((g) => g.id === activeGroupId)?.biddingActive && (
                  <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse shrink-0">
                    Bid On
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 ml-auto">
                {!groups.find((g) => g.id === activeGroupId)?.biddingActive && groups.some((g) => g.biddingActive) && (
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" title="Ada sesi bidding aktif di grup lain!" />
                )}
                <span className="material-symbols-outlined text-[18px] text-outline">
                  {sidebarGroupsExpanded ? "expand_less" : "expand_more"}
                </span>
              </div>
            </button>

            {sidebarGroupsExpanded && (
              <div className="mt-2 bg-black/5 border border-black/5 rounded-xl overflow-hidden divide-y divide-black/5 animate-fadeIn max-h-[220px] overflow-y-auto">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      handleGroupChange(g.id);
                      setSidebarOpen(false); // Close mobile sidebar
                      setSidebarGroupsExpanded(false); // Collapse list
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
                    {g.biddingActive && (
                      <span className={`${activeGroupId === g.id ? "bg-white text-red-600" : "bg-red-500 text-white"} text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse shrink-0`}>
                        Bid On
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="admin-sidebar-divider" />

          <button
            onClick={() => setGroupModalOpen(true)}
            className="admin-sidebar-link text-amber-500 hover:text-amber-600 hover:bg-amber-50/50"
            style={{ fontWeight: 700 }}
          >
            <span className="material-symbols-outlined" style={{fontSize:20}}>folder_managed</span>
            <span>Kelola Grup</span>
          </button>
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
      <div className={`admin-content ${biddingActive ? "pt-[102px]" : "pt-[60px]"}`}>
        {biddingActive && (
          <div className="bg-gradient-to-r from-red-600 via-amber-500 to-red-600 text-white font-black text-xs py-2.5 px-4 flex items-center justify-between shadow-lg fixed top-0 left-0 w-full z-[100] animate-pulse">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] animate-spin">warning</span>
              <span>
                PERINGATAN: Sesi Bidding untuk <strong>{groups.find((g) => g.id === activeGroupId)?.name}</strong> sedang aktif!
              </span>
            </div>
            <button
              onClick={() => toggleBidding.mutate({ groupId: activeGroupId ?? 0, active: false })}
              disabled={toggleBidding.isPending}
              className="bg-white text-red-600 hover:bg-red-50 px-3 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wide transition-all shadow-sm border border-red-600/10 flex items-center gap-1.5 shrink-0"
            >
              {toggleBidding.isPending ? (
                <span className="spinner border-red-600" style={{ width: 10, height: 10 }} />
              ) : (
                <span className="material-symbols-outlined text-[14px]">cancel</span>
              )}
              <span>Matikan Sekarang</span>
            </button>
          </div>
        )}

        {/* Top Header Bar */}
        <header className="admin-topbar" style={{ top: biddingActive ? "42px" : "0" }}>
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
            <div className="admin-topbar-avatar">
              {getInitials(session?.user?.name ?? "AD")}
            </div>
          </div>
        </header>

        <main className="admin-main">
          {/* Active Group Indicator Heading */}
          <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-2xl mb-1">
            <div className="flex items-center gap-2 text-amber-800">
              <span className="material-symbols-outlined text-[20px] font-extrabold text-amber-600 animate-pulse">folder_shared</span>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700/70">Grup Klasemen Aktif</p>
                <h3 className="text-base font-black text-amber-900 leading-tight">
                  {groups.find((g) => g.id === activeGroupId)?.name ?? "Menghubungkan grup..."}
                </h3>
              </div>
            </div>
            <span className="bg-amber-500 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
              Mode Kontrol
            </span>
          </div>

          {/* Error Banner */}
          {isScoreError && (
            <div className="error-banner" role="alert">
              <div className="error-banner-icon">⚠️</div>
              <div className="error-banner-body">
                <p className="error-banner-title">Gagal memuat data peserta</p>
                <p className="error-banner-msg">{(scoreError as any)?.message ?? "Tidak dapat terhubung ke database."}</p>
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
                onClick={() => {
                  if (activeGroupId !== null) {
                    toggleBidding.mutate({ groupId: activeGroupId, active: !biddingActive });
                  }
                }}
                disabled={toggleBidding.isPending || activeGroupId === null}
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
            {activeGroupId !== null && (
              <div className="flex items-center gap-2 mr-2">
                <button
                  onClick={() => handleResetScores(0)}
                  disabled={resetGroupScores.isPending}
                  className="admin-action-btn admin-action-btn--red flex items-center gap-1.5 !text-xs !py-2 !px-3"
                  title="Reset Semua Skor di Grup ini ke 0"
                >
                  {resetGroupScores.isPending ? (
                    <span className="spinner border-error" style={{ width: 12, height: 12 }} />
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                  )}
                  <span>Reset ke 0</span>
                </button>
                <button
                  onClick={() => handleResetScores(50)}
                  disabled={resetGroupScores.isPending}
                  className="admin-action-btn flex items-center gap-1.5 !text-xs !py-2 !px-3"
                  title="Reset Semua Skor di Grup ini ke 50"
                  style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
                >
                  {resetGroupScores.isPending ? (
                    <span className="spinner border-primary" style={{ width: 12, height: 12 }} />
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                  )}
                  <span>Reset ke 50</span>
                </button>
              </div>
            )}
            <button
              id="btn-add"
              onClick={openAdd}
              disabled={groups.length === 0}
              className={`admin-btn-primary ${groups.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              title={groups.length === 0 ? "Buat grup terlebih dahulu di menu Kelola Grup" : "Tambah Peserta"}
            >
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
                        const rank = scores.findIndex((s) => s.score === entry.score) + 1;
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
                                <div className={`admin-avatar overflow-hidden ${entry.logoUrl ? "bg-white border" : getAvatarColor(idx)}`}>
                                  {entry.logoUrl ? (
                                    <img src={entry.logoUrl} alt={entry.name} className="w-full h-full object-cover" />
                                  ) : (
                                    getInitials(entry.name)
                                  )}
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
                                        <span className="w-2.5 h-2.5 bg-amber-500 rounded-full flex-shrink-0 animate-pulse" title="Perubahan belum disimpan" />
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-outline text-xs font-semibold">—</span>
                                  )}
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
                                    onClick={() => {
                                      if (hasUnsavedBids) {
                                        setToast("Simpan perubahan taruhan terlebih dahulu");
                                      } else {
                                        handleDeclareWinner(entry as ScoreEntry);
                                      }
                                    }}
                                    disabled={winningId === entry.id || entry.score <= 0}
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
                              <span>Simpan ({changedBids.length})</span>
                            </button>
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="admin-mobile-list">
                  {filtered.map((entry, idx) => {
                    const rank = scores.findIndex((s) => s.score === entry.score) + 1;
                    const isLoading = loadingId === entry.id;
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
                        {biddingActive && entry.score > 0 && (
                          <div className="admin-mobile-card-bid flex items-center justify-between border-t border-black/5 pt-2 mt-2 px-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-extrabold text-outline uppercase tracking-wider">Bidding Poin</span>
                              {draftBids[entry.id] !== undefined && draftBids[entry.id] !== Math.min(entry.bid ?? 10, entry.score) && (
                                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" title="Belum disimpan" />
                              )}
                            </div>
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
                        <div className="admin-mobile-card-actions mt-2 border-t border-black/5 pt-2">
                          <button onClick={() => handleQuickScore(entry as ScoreEntry, 10)} disabled={isLoading} className="admin-action-btn admin-action-btn--green flex-1">
                            {isLoading ? <span className="spinner border-secondary" style={{width:12,height:12}} /> : "+10 Poin"}
                          </button>
                          <button onClick={() => handleQuickScore(entry as ScoreEntry, -5)} disabled={isLoading} className="admin-action-btn admin-action-btn--red flex-1">
                            {isLoading ? <span className="spinner border-error" style={{width:12,height:12}} /> : "-5 Poin"}
                          </button>
                          {biddingActive && (
                            <button
                              onClick={() => {
                                if (hasUnsavedBids) {
                                  setToast("Simpan perubahan taruhan terlebih dahulu");
                                } else {
                                  handleDeclareWinner(entry as ScoreEntry);
                                }
                              }}
                              disabled={winningId === entry.id || entry.score <= 0}
                              className="admin-icon-btn admin-icon-btn--winner"
                              title={hasUnsavedBids ? "Simpan perubahan taruhan terlebih dahulu" : "Pemenang Bidding"}
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
                  {biddingActive && hasUnsavedBids && (
                    <div className="admin-mobile-save-banner fixed bottom-4 left-4 right-4 z-50 md:hidden">
                      <button
                        onClick={handleSaveAllBids}
                        disabled={updateMultipleBids.isPending}
                        className="w-full admin-btn-primary flex items-center justify-center gap-2 py-3 shadow-lg rounded-xl"
                      >
                        {updateMultipleBids.isPending ? (
                          <span className="spinner border-white" style={{ width: 14, height: 14 }} />
                        ) : (
                          <span className="material-symbols-outlined text-[18px]">save</span>
                        )}
                        <span>Simpan Perubahan Taruhan ({changedBids.length})</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {filtered.length > 0 && (
              <p className="admin-count-label">{filtered.length} dari {scores.length} kementerian</p>
            )}
          </div>
        </main>
      </div>

      <Modal
        open={modalOpen}
        entry={editEntry}
        groups={groups}
        activeGroupId={activeGroupId ?? 0}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
      />
      <GroupManagerModal
        open={groupModalOpen}
        groups={groups}
        activeGroupId={activeGroupId}
        setActiveGroupId={handleGroupChange}
        onClose={() => setGroupModalOpen(false)}
      />
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  );
}
