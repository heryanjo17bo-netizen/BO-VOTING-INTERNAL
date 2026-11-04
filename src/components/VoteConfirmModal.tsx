import React from 'react';
import type { Contestant } from '../types/index.ts';

interface VoteConfirmModalProps {
  contestant: Contestant | null;
  outletName: string;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const VoteConfirmModal: React.FC<VoteConfirmModalProps> = ({
  contestant,
  outletName,
  isSubmitting,
  onConfirm,
  onCancel,
}) => {
  if (!contestant) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-vote-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-sm bg-[#342D2A] border border-[#4A3F39] rounded-3xl p-5 shadow-2xl flex flex-col items-center text-center">
        {/* Black Owl mini seal */}
        <div className="w-10 h-10 mb-2 flex items-center justify-center">
          <img
            src="/assets/aistudio/BO_LOGO_cc0ca4aa.png"
            alt="Black Owl"
            className="w-10 h-10 object-contain drop-shadow"
          />
        </div>

        <h3 id="confirm-vote-title" className="font-['Cinzel'] text-lg font-bold text-[#F7F0EA] tracking-wider uppercase mb-1">
          CONFIRM YOUR VOTE?
        </h3>
        <p className="text-xs text-[#AFA39B] mb-4">
          Halloween Best Costume Night at {outletName}
        </p>

        {/* Contestant Highlight Card */}
        <div className="w-full bg-[#211D1C] rounded-2xl border border-[#4A3F39]/60 p-3 mb-4 flex items-center gap-3.5 text-left">
          <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-[#27211F] flex-shrink-0">
            <img
              src={contestant.imageUrl}
              alt={contestant.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-['Cinzel'] font-bold text-[#D8B37A]">
              {contestant.numberDisplay}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold text-[#D8B37A] tracking-wider uppercase block">
              Contestant {contestant.numberDisplay}
            </span>
            <h4 className="font-semibold text-sm text-[#F7F0EA] truncate mt-0.5">
              {contestant.name}
            </h4>
            <p className="text-xs text-[#F6AC67] truncate font-medium mt-0.5">
              {contestant.instagram || (contestant.costume?.startsWith('@') ? contestant.costume : `@${contestant.costume}`)}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-[#AFA39B] mb-5 leading-relaxed px-2">
          Setiap perangkat (HP) berhak memberikan <span className="text-[#F6AC67] font-semibold">1 vote untuk {outletName}</span>. Pilihan tidak dapat diubah setelah dikonfirmasi.
        </p>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="w-full py-3 rounded-2xl bg-[#F6AC67] hover:bg-[#F29D4E] text-[#211D1C] font-extrabold text-xs tracking-widest uppercase transition-all duration-150 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>RECORDING VOTE...</span>
              </>
            ) : (
              <span>CAST VOTE NOW</span>
            )}
          </button>

          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-2xl bg-transparent hover:bg-[#2A2422] text-[#AFA39B] hover:text-[#F7F0EA] text-xs font-semibold tracking-wider transition-colors cursor-pointer"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};
