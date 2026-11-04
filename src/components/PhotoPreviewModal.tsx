import React from 'react';
import type { Contestant } from '../types/index.ts';

interface PhotoPreviewModalProps {
  contestant: Contestant | null;
  hasVoted: boolean;
  isVotedForThis: boolean;
  votingActive: boolean;
  onVoteClick: (contestant: Contestant) => void;
  onClose: () => void;
}

export const PhotoPreviewModal: React.FC<PhotoPreviewModalProps> = ({
  contestant,
  hasVoted,
  isVotedForThis,
  votingActive,
  onVoteClick,
  onClose,
}) => {
  if (!contestant) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/95 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[92vh] flex flex-col bg-[#342D2A] border border-[#4A3F39] rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top close button */}
        <button
          onClick={onClose}
          aria-label="Close photo preview"
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/70 backdrop-blur-md text-[#F7F0EA] flex items-center justify-center hover:bg-[#F6AC67] hover:text-[#211D1C] transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Large Portrait Image */}
        <div className="relative w-full aspect-[3/4] max-h-[62vh] bg-[#211D1C] overflow-hidden">
          <img
            src={contestant.imageUrl}
            alt={contestant.name}
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#342D2A] via-transparent to-black/30 pointer-events-none" />

          {/* Floating Number Badge */}
          <div className="absolute top-3 left-3 px-3 py-1 rounded-xl bg-[#211D1C]/90 backdrop-blur-md border border-[#D8B37A]/50 shadow-lg">
            <span className="font-['Cinzel'] text-sm font-bold text-[#D8B37A] tracking-wider">
              {contestant.numberDisplay}
            </span>
          </div>
        </div>

        {/* Content details and bottom bar */}
        <div className="p-4 sm:p-5 flex flex-col gap-3 bg-[#342D2A]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[#D8B37A] tracking-widest uppercase">
                Halloween Contestant
              </span>
              <span className="text-xs text-[#AFA39B]">
                {contestant.votes} {contestant.votes === 1 ? 'vote' : 'votes'}
              </span>
            </div>
            <h3 id="photo-preview-title" className="font-bold text-lg text-[#F7F0EA] mt-0.5">
              {contestant.name}
            </h3>
            <p className="text-xs sm:text-sm text-[#F6AC67] font-semibold mt-0.5 flex items-center gap-1.5">
              <span>{contestant.instagram || (contestant.costume?.startsWith('@') ? contestant.costume : `@${contestant.costume}`)}</span>
            </p>
          </div>

          {contestant.description && (
            <p className="text-xs text-[#AFA39B] leading-relaxed line-clamp-3">
              {contestant.description}
            </p>
          )}

          {/* Action Button */}
          <div className="pt-1">
            {isVotedForThis ? (
              <div className="w-full py-2.5 rounded-xl bg-[#211D1C] border border-[#D8B37A] text-[#D8B37A] text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-[#F6AC67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                YOU VOTED FOR THIS CONTESTANT
              </div>
            ) : hasVoted ? (
              <div className="w-full py-2.5 rounded-xl bg-[#2A2422] text-[#AFA39B] text-xs font-semibold tracking-wider uppercase text-center border border-[#3A322F]">
                SUDAH VOTE DI KATEGORI INI
              </div>
            ) : !votingActive ? (
              <div className="w-full py-2.5 rounded-xl bg-[#2A2422] text-[#8C7E77] text-xs font-medium tracking-wider uppercase text-center border border-[#3A322F]">
                VOTING CURRENTLY CLOSED
              </div>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  onVoteClick(contestant);
                }}
                className="w-full py-3 rounded-2xl bg-[#F6AC67] hover:bg-[#F29D4E] active:scale-[0.98] text-[#211D1C] text-xs font-extrabold tracking-widest uppercase transition-all duration-150 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>VOTE FOR {contestant.numberDisplay}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
