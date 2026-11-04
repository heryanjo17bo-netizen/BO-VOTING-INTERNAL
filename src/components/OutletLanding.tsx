import React, { useEffect, useState } from 'react';
import type { Outlet } from '../types/index.ts';
import { fetchOutlets, getLocalVoterState, type LocalVoterState } from '../utils/api.ts';

interface OutletLandingProps {
  onSelectOutlet: (code: string, route: 'vote' | 'leaderboard' | 'display') => void;
  onOpenAdmin: () => void;
  voterState?: LocalVoterState;
}

export const OutletLanding: React.FC<OutletLandingProps> = ({
  onSelectOutlet,
  onOpenAdmin,
  voterState: propVoterState,
}) => {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [voterState, setVoterState] = useState<LocalVoterState>(() => propVoterState || getLocalVoterState());

  useEffect(() => {
    if (propVoterState) {
      setVoterState(propVoterState);
    } else {
      setVoterState(getLocalVoterState());
    }
  }, [propVoterState]);

  useEffect(() => {
    fetchOutlets()
      .then((data) => setOutlets(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const hasVotedBoho = Boolean(voterState.BOHO?.hasVoted);
  const hasVotedBoall = Boolean(voterState.BOALL?.hasVoted);

  return (
    <div className="min-h-screen bg-[#211D1C] text-[#F7F0EA] flex flex-col justify-between selection:bg-[#F6AC67]/30">
      {/* Background cinematic glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[400px] bg-gradient-to-b from-[#D8B37A]/15 via-[#F6AC67]/5 to-transparent blur-3xl pointer-events-none" />

      {/* Main Container */}
      <main className="relative z-10 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-14 flex-1 flex flex-col items-center text-center">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <img
            src="/assets/aistudio/BO_LOGO_cc0ca4aa.png"
            alt="Black Owl Logo"
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-[0_4px_25px_rgba(216,179,122,0.4)] mb-3 hover:scale-105 transition-transform"
          />
          <h1
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            className="tracking-[0.25em] text-2xl sm:text-4xl font-black text-[#F7F0EA] uppercase"
          >
            BLACK OWL
          </h1>
          <p className="tracking-[0.35em] text-xs sm:text-sm font-bold text-[#D8B37A] uppercase mt-1">
            HALLOWEEN BEST COSTUME VOTING NIGHT
          </p>

          <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#342D2A] border border-[#4A3F39] text-xs text-[#AFA39B]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Head Office & All Outlet Live Ballot</span>
          </div>
        </div>

        {/* Dual Voting Rule Banner */}
        <div className="w-full max-w-2xl bg-[#2A2422] border border-[#D8B37A]/40 rounded-2xl p-3.5 sm:p-4 mb-8 shadow-xl text-left">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#342D2A] border border-[#D8B37A]/50 flex items-center justify-center text-[#F6AC67] flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-[#F7F0EA] tracking-wide uppercase">
                ATURAN VOTING: 1 HP BISA VOTE 2 KALI
              </h2>
              <p className="text-xs text-[#AFA39B] mt-0.5 leading-relaxed">
                Setiap 1 HP berhak memberikan <strong>1 Vote di Head Office</strong> dan <strong>1 Vote di Black Owl All Outlet</strong>. Setelah vote di Head Office, Anda dapat lanjut memilih di All Outlet.
              </p>
              {/* Device Progress Pill Indicators */}
              <div className="mt-3 pt-2.5 border-t border-[#4A3F39]/50 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-[#AFA39B] font-medium">Status HP Anda:</span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                  hasVotedBoho
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                    : 'bg-[#342D2A] text-[#D8B37A] border-[#D8B37A]/40'
                }`}>
                  {hasVotedBoho ? '✓ Head Office (Voted)' : '○ Head Office (1 Vote Tersedia)'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border ${
                  hasVotedBoall
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                    : 'bg-[#342D2A] text-[#D8B37A] border-[#D8B37A]/40'
                }`}>
                  {hasVotedBoall ? '✓ All Outlet (Voted)' : '○ All Outlet (1 Vote Tersedia)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Outlets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl text-left">
          {loading ? (
            <div className="col-span-full py-12 text-center text-[#AFA39B] flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#D8B37A] border-t-transparent rounded-full animate-spin" />
              <span>Memuat kategori outlet...</span>
            </div>
          ) : (
            outlets.map((outlet) => {
              const isBoho = outlet.code === 'BOHO';
              const voted = isBoho ? hasVotedBoho : hasVotedBoall;
              const votedInfo = isBoho ? voterState.BOHO : voterState.BOALL;

              return (
                <div
                  key={outlet.code}
                  className={`bg-[#342D2A] rounded-3xl border p-5 shadow-xl transition-all duration-200 flex flex-col justify-between group ${
                    voted
                      ? 'border-[#D8B37A]/50 bg-gradient-to-b from-[#342D2A] to-[#2B2421]'
                      : 'border-[#4A3F39]/60 hover:border-[#D8B37A]/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-['Cinzel'] font-black text-xs text-[#D8B37A] tracking-wider">
                        {outlet.code}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                            voted
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : 'bg-[#2A2422] text-[#F6AC67] border-[#D8B37A]/40'
                          }`}
                        >
                          {voted ? '✓ Sudah Vote' : '1 Vote Tersedia'}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                            outlet.votingActive
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : 'bg-rose-950 text-rose-300 border-rose-800'
                          }`}
                        >
                          {outlet.votingActive ? 'Live' : 'Closed'}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-['Cinzel'] font-bold text-lg text-[#F7F0EA] group-hover:text-[#F6AC67] transition-colors">
                      {outlet.name}
                    </h3>
                    <p className="text-xs text-[#AFA39B] mt-0.5">
                      {outlet.city}
                    </p>

                    {/* Voted badge info */}
                    {voted && votedInfo?.votedContestant ? (
                      <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-[#211D1C]/80 border border-emerald-800/50 flex items-center gap-2 text-xs text-emerald-300">
                        <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="truncate">
                          Pilihan: <strong>{votedInfo.votedContestant.numberDisplay} - {votedInfo.votedContestant.name}</strong>
                        </span>
                      </div>
                    ) : null}

                    <div className="mt-3 flex items-center justify-between text-[11px] text-[#AFA39B] bg-[#211D1C] rounded-xl p-2 px-3 border border-[#4A3F39]/40">
                      <span>Total Event Votes:</span>
                      <span className="font-['Cinzel'] font-bold text-[#F6AC67]">
                        {outlet.totalVotes}
                      </span>
                    </div>
                  </div>

                  {/* Outlet Access Buttons */}
                  <div className="mt-4 pt-3 border-t border-[#4A3F39]/50 flex flex-col gap-2">
                    <button
                      onClick={() => onSelectOutlet(outlet.code, 'vote')}
                      className={`w-full py-2.5 rounded-xl font-extrabold text-xs tracking-wider uppercase transition-colors shadow flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] ${
                        voted
                          ? 'bg-[#2A2422] hover:bg-[#3E3531] text-[#D8B37A] border border-[#D8B37A]/50'
                          : 'bg-[#F6AC67] hover:bg-[#F29D4E] text-[#211D1C]'
                      }`}
                    >
                      <span>{voted ? `Lihat Pilihan & Daftar (${outlet.shortName})` : `Vote di ${outlet.shortName} Sekarang`}</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onSelectOutlet(outlet.code, 'leaderboard')}
                        className="py-1.5 px-2 rounded-lg bg-[#2A2422] hover:bg-[#3E3531] text-[#D8B37A] hover:text-[#F6AC67] text-[11px] font-semibold text-center border border-[#4A3F39] cursor-pointer"
                      >
                        Standings
                      </button>
                      <button
                        onClick={() => onSelectOutlet(outlet.code, 'display')}
                        className="py-1.5 px-2 rounded-lg bg-[#2A2422] hover:bg-[#3E3531] text-[#D8B37A] hover:text-[#F6AC67] text-[11px] font-semibold text-center border border-[#4A3F39] cursor-pointer"
                      >
                        16:9 LED View
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Admin Portal Shortcut */}
        <div className="mt-12 flex flex-col items-center">
          <button
            onClick={onOpenAdmin}
            className="py-2.5 px-5 rounded-2xl bg-[#2A2422] hover:bg-[#342D2A] border border-[#4A3F39] hover:border-[#D8B37A]/50 text-xs font-bold text-[#AFA39B] hover:text-[#D8B37A] tracking-wider uppercase shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-[#D8B37A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Staff Portal (Staff Login Required)</span>
          </button>
          <span className="text-[10px] text-[#AFA39B]/50 mt-1">
            Restricted to Black Owl venue managers and stage operators
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center text-xs text-[#AFA39B] border-t border-[#342D2A] bg-[#211D1C]">
        BLACK OWL INDONESIA • HALLOWEEN BEST COSTUME NIGHT 2026 • 1 HP = 1 VOTE HEAD OFFICE & 1 VOTE ALL OUTLET
      </footer>
    </div>
  );
};
