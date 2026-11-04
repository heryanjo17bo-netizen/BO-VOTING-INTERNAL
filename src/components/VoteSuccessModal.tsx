import React from 'react';
import type { Contestant } from '../types/index.ts';

interface VoteSuccessModalProps {
  contestant: Contestant | null;
  currentOutletCode?: 'BOHO' | 'BOALL';
  hasVotedOther?: boolean;
  onViewLeaderboard: () => void;
  onClose: () => void;
  onSwitchOutlet?: () => void;
  otherOutletName?: string;
}

export const VoteSuccessModal: React.FC<VoteSuccessModalProps> = ({
  contestant,
  currentOutletCode,
  hasVotedOther,
  onViewLeaderboard,
  onClose,
  onSwitchOutlet,
  otherOutletName,
}) => {
  const isBoho = currentOutletCode === 'BOHO';
  const currentCategoryName = isBoho ? 'Black Owl Head Office' : 'Black Owl All Outlet';
  const nextCategoryName = isBoho ? 'Black Owl All Outlet' : 'Black Owl Head Office';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vote-success-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
    >
      <div className="w-full max-w-sm bg-[#342D2A] border border-[#D8B37A]/50 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
        {/* Subtle gold gradient radial background */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#D8B37A]/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-[#F6AC67]/15 rounded-full blur-2xl pointer-events-none" />

        {/* Animated Gold Checkmark */}
        <div className="w-16 h-16 rounded-full bg-[#211D1C] border-2 border-[#D8B37A] flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(216,179,122,0.35)] animate-bounce-short">
          <svg
            className="w-8 h-8 text-[#F6AC67]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h3 id="vote-success-title" className="font-['Cinzel'] text-lg font-extrabold text-[#F7F0EA] tracking-wider uppercase mb-0.5">
          VOTE {isBoho ? 'HEAD OFFICE' : 'ALL OUTLET'} BERHASIL!
        </h3>
        <p className="text-[11px] font-semibold text-[#D8B37A] tracking-widest uppercase mb-3">
          1 SUARA TELAH TERCATAT
        </p>

        {contestant && (
          <div className="w-full bg-[#211D1C] rounded-2xl border border-[#4A3F39]/60 p-3 mb-4 flex items-center gap-3 text-left">
            <img
              src={contestant.imageUrl}
              alt={contestant.name}
              className="w-14 h-18 rounded-xl object-cover bg-[#27211F] flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-[#D8B37A] tracking-wider uppercase block">
                {contestant.numberDisplay} • {currentCategoryName}
              </span>
              <h4 className="font-semibold text-sm text-[#F7F0EA] truncate">
                {contestant.name}
              </h4>
              <p className="text-xs text-[#F6AC67] truncate font-medium mt-0.5">
                {contestant.instagram || (contestant.costume?.startsWith('@') ? contestant.costume : `@${contestant.costume}`)}
              </p>
            </div>
          </div>
        )}

        {/* Next Step Callout: 1 HP 1 Vote HO + 1 Vote All Outlet */}
        {!hasVotedOther && onSwitchOutlet ? (
          <div className="w-full p-3 rounded-2xl bg-[#2A2422] border border-[#F6AC67]/40 mb-4 text-left">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#F6AC67] animate-ping" />
              <span className="text-[11px] font-extrabold text-[#F6AC67] tracking-wider uppercase">
                1 HP BISA VOTE 2 KALI
              </span>
            </div>
            <p className="text-xs text-[#F7F0EA] leading-relaxed">
              Anda sudah vote di <strong>{isBoho ? 'Head Office' : 'All Outlet'}</strong>. Sekarang gunakan 1 vote lagi untuk kategori <strong>{nextCategoryName}</strong>!
            </p>
          </div>
        ) : (
          <div className="w-full p-3 rounded-2xl bg-[#2A2422] border border-emerald-600/40 mb-4 text-center">
            <p className="text-xs text-emerald-300 font-semibold">
              ✓ Anda telah menggunakan 2 hak vote di HP ini (1 di Head Office & 1 di Black Owl All Outlet). Terima kasih!
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          {!hasVotedOther && onSwitchOutlet ? (
            <button
              onClick={onSwitchOutlet}
              className="w-full py-3 rounded-2xl bg-[#F6AC67] hover:bg-[#F29D4E] text-[#211D1C] font-extrabold text-xs tracking-widest uppercase transition-all duration-150 shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <span>VOTE DI {nextCategoryName.toUpperCase()} SEKARANG</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          ) : null}

          <button
            onClick={onViewLeaderboard}
            className={`w-full py-2.5 rounded-2xl text-xs font-bold tracking-wider uppercase transition-colors shadow flex items-center justify-center gap-2 cursor-pointer ${
              hasVotedOther
                ? 'bg-[#F6AC67] hover:bg-[#F29D4E] text-[#211D1C]'
                : 'bg-[#2A2422] hover:bg-[#3E3531] text-[#D8B37A] hover:text-[#F6AC67] border border-[#D8B37A]/40'
            }`}
          >
            <span>LIHAT LIVE LEADERBOARD</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 rounded-2xl bg-transparent hover:bg-[#2A2422] text-[#AFA39B] hover:text-[#F7F0EA] text-xs font-semibold tracking-wider transition-colors cursor-pointer"
          >
            KEMBALI KE DAFTAR KONTESTAN
          </button>
        </div>
      </div>
    </div>
  );
};
