import React from 'react';
import type { Contestant, Outlet } from '../types/index.ts';

interface MobileLeaderboardProps {
  outlet: Outlet;
  leaderboard: Contestant[];
  isLoading: boolean;
  onRefresh?: () => void;
  votedContestantId?: string;
}

export const MobileLeaderboard: React.FC<MobileLeaderboardProps> = ({
  outlet,
  leaderboard,
  isLoading,
  onRefresh,
  votedContestantId,
}) => {
  const topThree = leaderboard.slice(0, 3);
  const remaining = leaderboard.slice(3);

  // Reorder top 3 for visual podium: [Rank 2, Rank 1, Rank 3] if 3 available
  const podiumOrder = topThree.length === 3 ? [topThree[1], topThree[0], topThree[2]] : topThree;

  return (
    <div className="w-full max-w-md mx-auto px-4 py-3 space-y-5 animate-fade-in pb-12">
      {/* Title & Live Totals Bar */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="font-['Cinzel'] text-sm sm:text-base font-bold text-[#F7F0EA] tracking-wider uppercase">
            LIVE STANDINGS
          </h2>
          <p className="text-[11px] text-[#AFA39B]">
            {outlet.totalVotes} total verified votes recorded
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            aria-label="Refresh leaderboard"
            className="p-2 rounded-xl bg-[#342D2A] border border-[#4A3F39] text-[#D8B37A] hover:text-[#F6AC67] transition-colors cursor-pointer"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Top 3 Podium Spotlight */}
      {topThree.length > 0 && (
        <div className="pt-2 pb-1">
          <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end">
            {podiumOrder.map((contestant) => {
              const rank = contestant.rank || 1;
              const isFirst = rank === 1;
              const isSecond = rank === 2;
              const isThird = rank === 3;

              const badgeColor = isFirst
                ? 'bg-[#D8B37A] text-[#211D1C] border-[#F2D8A7]'
                : isSecond
                ? 'bg-[#AFA39B] text-[#211D1C] border-[#E0D8D3]'
                : 'bg-[#C87D4A] text-[#211D1C] border-[#F6AC67]';

              const ringBorder = isFirst
                ? 'border-2 border-[#D8B37A] shadow-[0_0_20px_rgba(216,179,122,0.3)]'
                : isSecond
                ? 'border border-[#AFA39B]/80'
                : 'border border-[#C87D4A]/80';

              return (
                <div
                  key={contestant.id}
                  className={`flex flex-col items-center text-center ${
                    isFirst ? '-translate-y-2' : ''
                  }`}
                >
                  {/* Avatar / Portrait with rank badge */}
                  <div className="relative mb-2">
                    <div
                      className={`relative rounded-2xl overflow-hidden bg-[#27211F] ${ringBorder} ${
                        isFirst ? 'w-20 h-24 sm:w-24 sm:h-28' : 'w-16 h-20 sm:w-20 sm:h-24'
                      }`}
                    >
                      <img
                        src={contestant.imageUrl}
                        alt={contestant.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80';
                        }}
                      />
                      {votedContestantId === contestant.id && (
                        <div className="absolute inset-0 bg-[#D8B37A]/25 border-2 border-[#D8B37A] flex items-center justify-center">
                          <span className="bg-[#211D1C]/90 text-[#D8B37A] text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">
                            Your Vote
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Numeric Rank Pill */}
                    <div
                      className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black tracking-wider uppercase border shadow-md ${badgeColor}`}
                    >
                      #{rank}
                    </div>
                  </div>

                  {/* Contestant info */}
                  <div className="w-full px-1 mt-1">
                    <span className="text-[10px] font-['Cinzel'] font-bold text-[#D8B37A]">
                      {contestant.numberDisplay}
                    </span>
                    <h3 className="font-semibold text-xs text-[#F7F0EA] truncate mt-0.5">
                      {contestant.name}
                    </h3>
                    <p className="text-[10px] text-[#F6AC67] truncate font-medium mt-0.5">
                      {contestant.instagram || (contestant.costume?.startsWith('@') ? contestant.costume : `@${contestant.costume}`)}
                    </p>
                    <div className="mt-1 inline-block px-2 py-0.5 rounded-md bg-[#342D2A] border border-[#4A3F39] text-[10px] sm:text-xs font-bold text-[#F6AC67]">
                      {contestant.votes} {contestant.votes === 1 ? 'vote' : 'votes'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ranks 4+ List */}
      <div className="space-y-2 pt-2">
        <h3 className="text-xs font-bold tracking-widest text-[#AFA39B] uppercase px-1">
          All Ranked Contestants
        </h3>

        {leaderboard.length === 0 ? (
          <div className="text-center py-8 bg-[#342D2A] rounded-2xl border border-[#4A3F39]/60 p-4">
            <p className="text-xs text-[#AFA39B]">No contestants registered yet.</p>
          </div>
        ) : (
          leaderboard.map((contestant) => {
            const isVoted = votedContestantId === contestant.id;
            return (
              <div
                key={contestant.id}
                className={`flex items-center justify-between p-3 rounded-2xl bg-[#342D2A] border transition-all ${
                  isVoted
                    ? 'border-[#D8B37A] ring-1 ring-[#D8B37A]/40'
                    : 'border-[#4A3F39]/50 hover:border-[#4A3F39]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Rank number */}
                  <div className="w-7 text-center font-['Cinzel'] font-bold text-sm text-[#AFA39B]">
                    #{contestant.rank}
                  </div>

                  {/* Thumbnail */}
                  <div className="relative w-11 h-13 rounded-xl overflow-hidden bg-[#27211F] flex-shrink-0">
                    <img
                      src={contestant.imageUrl}
                      alt={contestant.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80';
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-['Cinzel'] font-bold text-[#D8B37A]">
                        {contestant.numberDisplay}
                      </span>
                      <h4 className="font-semibold text-xs sm:text-sm text-[#F7F0EA] truncate">
                        {contestant.name}
                      </h4>
                      {isVoted && (
                        <span className="text-[9px] bg-[#D8B37A]/20 text-[#D8B37A] px-1.5 py-0.2 rounded font-bold uppercase">
                          Your Vote
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#F6AC67] truncate font-medium mt-0.5">
                      {contestant.instagram || (contestant.costume?.startsWith('@') ? contestant.costume : `@${contestant.costume}`)}
                    </p>
                  </div>
                </div>

                {/* Vote Count Badge */}
                <div className="flex-shrink-0 text-right pl-2">
                  <span className="font-['Cinzel'] font-bold text-sm sm:text-base text-[#F6AC67]">
                    {contestant.votes}
                  </span>
                  <span className="block text-[10px] text-[#AFA39B] uppercase font-medium">
                    {contestant.votes === 1 ? 'vote' : 'votes'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
