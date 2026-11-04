import React from 'react';
import type { Contestant } from '../types/index.ts';

interface ContestantCardProps {
  contestant: Contestant;
  hasVoted: boolean;
  isVotedForThis: boolean;
  votingActive: boolean;
  onVoteClick: (contestant: Contestant) => void;
  onPhotoClick: (contestant: Contestant) => void;
}

export const ContestantCard: React.FC<ContestantCardProps> = ({
  contestant,
  hasVoted,
  isVotedForThis,
  votingActive,
  onVoteClick,
  onPhotoClick,
}) => {
  return (
    <article
      className={`group relative flex flex-col bg-[#342D2A] rounded-2xl sm:rounded-3xl border overflow-hidden transition-all duration-300 ${
        isVotedForThis
          ? 'border-[#D8B37A] ring-1 ring-[#D8B37A]/50 shadow-[0_0_20px_rgba(216,179,122,0.2)]'
          : 'border-[#4A3F39]/60 hover:border-[#D8B37A]/40 hover:shadow-xl'
      }`}
    >
      {/* Photo with numeric badge overlay & click to expand */}
      <div
        onClick={() => onPhotoClick(contestant)}
        className="relative w-full aspect-[4/5] bg-[#27211F] overflow-hidden cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label={`Preview photo of ${contestant.name}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPhotoClick(contestant);
          }
        }}
      >
        <img
          src={contestant.imageUrl}
          alt={contestant.name}
          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            // Fallback placeholder image if network failure
            (e.currentTarget as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80';
          }}
        />

        {/* Subtle Dark Gradient Overlay for contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#211D1C]/80 via-transparent to-black/30 pointer-events-none" />

        {/* Numeric Badge (Top Left) */}
        <div className="absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-lg bg-[#211D1C]/85 backdrop-blur-md border border-[#D8B37A]/40 shadow-md">
          <span className="font-['Cinzel'] text-xs sm:text-sm font-bold text-[#D8B37A] tracking-wider">
            {contestant.numberDisplay}
          </span>
        </div>

        {/* Expand icon (Top Right) */}
        <div className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-[#211D1C]/75 backdrop-blur-md flex items-center justify-center text-[#F7F0EA]/80 group-hover:text-[#F6AC67] transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </div>

        {/* If voted for this contestant banner */}
        {isVotedForThis && (
          <div className="absolute bottom-2 left-2 right-2 z-10 py-1 px-2 rounded-lg bg-[#D8B37A] text-[#211D1C] text-[10px] sm:text-xs font-black tracking-widest uppercase flex items-center justify-center gap-1.5 shadow-lg">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
            YOUR PICK
          </div>
        )}
      </div>

      {/* Card Content & Details */}
      <div className="p-3 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          <h2 className="font-semibold text-sm sm:text-base text-[#F7F0EA] line-clamp-1 group-hover:text-[#F6AC67] transition-colors">
            {contestant.name}
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-[#D8B37A] font-medium mt-1 truncate">
            <svg className="w-3.5 h-3.5 flex-shrink-0 text-[#F6AC67]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
            <span className="truncate">{contestant.instagram || (contestant.costume?.startsWith('@') ? contestant.costume : `@${contestant.costume}`)}</span>
          </div>
        </div>

        {/* Action Button */}
        <div>
          {isVotedForThis ? (
            <button
              disabled
              className="w-full py-2.5 px-3 rounded-xl bg-[#3E3531] border border-[#D8B37A]/50 text-[#D8B37A] text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-default"
            >
              <svg className="w-4 h-4 text-[#F6AC67]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              VOTED
            </button>
          ) : hasVoted ? (
            <button
              disabled
              className="w-full py-2.5 px-3 rounded-xl bg-[#2A2422] text-[#6E635C] text-xs font-semibold tracking-wider uppercase cursor-not-allowed border border-[#3A322F]"
            >
              VOTE LOCKED
            </button>
          ) : !votingActive ? (
            <button
              disabled
              className="w-full py-2.5 px-3 rounded-xl bg-[#2A2422] text-[#8C7E77] text-xs font-medium tracking-wider uppercase cursor-not-allowed border border-[#3A322F]"
            >
              CLOSED
            </button>
          ) : (
            <button
              onClick={() => onVoteClick(contestant)}
              className="w-full py-2.5 px-3 rounded-xl bg-[#F6AC67] hover:bg-[#F29D4E] active:scale-[0.98] text-[#211D1C] text-xs font-extrabold tracking-widest uppercase transition-all duration-150 shadow-md hover:shadow-[0_4px_16px_rgba(246,172,103,0.35)] cursor-pointer"
            >
              VOTE
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
