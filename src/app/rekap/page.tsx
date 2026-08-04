"use client";

import { api } from "~/trpc/react";

export default function RekapPage() {
  const { data: winners, isLoading } = api.group.getWinners.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-4 md:p-12 relative overflow-hidden print:p-0 print:bg-white">
      {/* Decorative Blobs for screen */}
      <div className="blob blob-1 print:hidden"></div>
      <div className="blob blob-2 print:hidden"></div>
      
      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
          <div>
            <h1 className="text-headline-lg font-bold text-primary print:text-black">
              Rekap Juara Grup
            </h1>
            <p className="text-body-lg text-on-surface-variant print:text-gray-700 mt-2">
              Daftar skor tertinggi dari masing-masing grup.
            </p>
          </div>
          
          {/* Print Button (hidden when printing) */}
          <button
            onClick={() => window.print()}
            className="print:hidden flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0"
          >
            <span className="material-symbols-outlined">print</span>
            Cetak PDF
          </button>
        </div>

        {/* Winners Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4 print:block">
          {winners?.map((w, index) => (
            <div 
              key={w.id} 
              className="glass-card rounded-2xl p-6 flex flex-col gap-4 transition-transform hover:scale-[1.02] print:shadow-none print:border print:border-gray-200 print:bg-white print:break-inside-avoid print:mb-4"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-primary font-bold text-lg print:bg-gray-100 print:text-black">
                    {index + 1}
                  </div>
                  <h2 className="text-title-md font-bold text-on-surface print:text-black">
                    Grup {w.groupName}
                  </h2>
                </div>
                {w.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={w.logoUrl} 
                    alt="Logo" 
                    className="w-12 h-12 object-contain rounded-full border border-outline-variant"
                  />
                )}
              </div>

              <div className="mt-2 bg-surface-container-low p-4 rounded-xl flex justify-between items-center print:bg-gray-50">
                <div>
                  <p className="text-label-sm text-outline uppercase tracking-wider mb-1">
                    Pemenang
                  </p>
                  <p className="text-title-md font-bold text-primary print:text-black">
                    {w.winnerName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-label-sm text-outline uppercase tracking-wider mb-1">
                    Skor
                  </p>
                  <p className="text-headline-lg-mobile font-bold text-secondary print:text-black">
                    {w.score.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {winners?.length === 0 && (
            <div className="col-span-full text-center py-12 text-outline">
              Belum ada grup atau skor.
            </div>
          )}
        </div>

        {/* Print Footer */}
        <div className="hidden print:block mt-8 text-center text-sm text-gray-500">
          <p>Dicetak pada: {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>

      </div>
    </div>
  );
}
