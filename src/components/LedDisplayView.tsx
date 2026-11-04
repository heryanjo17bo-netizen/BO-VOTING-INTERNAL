import React, { useEffect, useState, useMemo } from 'react';
import QRCode from 'qrcode';
import type { Contestant, Outlet, OutletCode } from '../types/index.ts';
import { fetchLeaderboard, subscribeToOutletEvents } from '../utils/api.ts';

interface LedDisplayViewProps {
  outletCode: OutletCode;
}

const PAGE_SIZE = 4; // Number of lower contestants (#4+) per page in the bottom grid
const PAGINATION_INTERVAL_MS = 8000; // Auto-advance page every 8 seconds

export const LedDisplayView: React.FC<LedDisplayViewProps> = ({ outletCode }) => {
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [leaderboard, setLeaderboard] = useState<Contestant[]>([]);
  const [totalVotes, setTotalVotes] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(0);

  const loadData = async () => {
    try {
      const data = await fetchLeaderboard(outletCode);
      setOutlet(data.outlet);
      setLeaderboard(data.leaderboard);
      setTotalVotes(data.totalVotes);
      setLastUpdated(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setIsConnected(true);
    } catch (err: any) {
      console.error('Failed to load LED leaderboard:', err);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    loadData();

    // Generate QR code for the guest voting URL
    const votingUrl = `${window.location.origin}/vote/${outletCode}`;
    QRCode.toDataURL(votingUrl, {
      margin: 1,
      width: 260,
      color: {
        dark: '#211D1C',
        light: '#F6AC67',
      },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('Failed to generate venue QR code:', err));

    // Subscribe to real-time SSE updates with connection monitoring
    const unsubscribe = subscribeToOutletEvents(
      outletCode,
      () => {
        loadData();
      },
      (connected) => {
        setIsConnected(connected);
      }
    );

    // Fallback polling every 5s to ensure continuous sync
    const interval = setInterval(loadData, 5000);

    // Keyboard 'F' key for venue fullscreen toggle
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [outletCode]);

  const topThree = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);
  const lowerRankings = useMemo(() => leaderboard.slice(3), [leaderboard]); // #4 onwards

  const totalPages = Math.max(1, Math.ceil(lowerRankings.length / PAGE_SIZE));

  // Auto-pagination ticker for lower rankings (#4+)
  useEffect(() => {
    if (totalPages <= 1) {
      setCurrentPage(0);
      return;
    }
    const timer = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, PAGINATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [totalPages]);

  const displayedLowerContestants = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return lowerRankings.slice(start, start + PAGE_SIZE);
  }, [lowerRankings, currentPage]);

  const first = topThree[0];
  const second = topThree[1];
  const third = topThree[2];

  const handleDoubleTap = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div
      onDoubleClick={handleDoubleTap}
      className="relative w-screen min-h-screen bg-[#171413] text-[#F7F0EA] flex flex-col justify-between overflow-hidden selection:bg-transparent cursor-default font-['Inter',sans-serif]"
    >
      {/* Background Cinematic Aura */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90vw] h-[450px] bg-gradient-to-b from-[#D8B37A]/12 via-[#F6AC67]/6 to-transparent blur-3xl pointer-events-none" />

      {/* Top Reconnecting Alert Banner */}
      {!isConnected && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-rose-950/95 border-b border-rose-500 text-rose-200 py-2.5 px-6 flex items-center justify-center gap-3 text-sm font-bold tracking-widest uppercase shadow-2xl animate-pulse">
          <svg className="w-5 h-5 text-rose-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>RECONNECTING TO VENUE REAL-TIME STREAM...</span>
        </div>
      )}

      {/* 1. Cinematic Header Bar */}
      <header className="relative z-10 px-8 py-5 border-b border-[#342D2A]/90 bg-[#1D1918]/80 backdrop-blur-md flex items-center justify-between">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-5">
          <img
            src="/assets/aistudio/BO_LOGO_cc0ca4aa.png"
            alt="Black Owl"
            className="w-16 h-16 object-contain drop-shadow-[0_0_20px_rgba(216,179,122,0.45)]"
          />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-['Cinzel'] tracking-[0.25em] text-3xl font-black text-[#F7F0EA] uppercase">
                BEST COSTUME
              </h1>
              <span className="w-2 h-2 rounded-full bg-[#D8B37A]"></span>
              <span className="font-['Cinzel'] text-2xl font-bold text-[#D8B37A] tracking-wider uppercase">
                {outlet?.name || outletCode}
              </span>
            </div>
            <p className="text-xs font-bold tracking-[0.35em] text-[#F6AC67] uppercase mt-0.5">
              HALLOWEEN NIGHT • LIVE LEADERBOARD
            </p>
          </div>
        </div>

        {/* Right: Metrics & Live Status */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#2A2422] border border-[#4A3F39]">
            <span
              className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
              }`}
            />
            <span
              className={`text-xs font-black tracking-widest uppercase ${
                isConnected ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isConnected ? 'LIVE FEED' : 'RECONNECTING'}
            </span>
            <span className="text-xs text-[#AFA39B] ml-2 font-mono">
              {lastUpdated || '--:--:--'}
            </span>
          </div>

          <div className="px-6 py-2.5 rounded-2xl bg-[#342D2A] border border-[#D8B37A]/50 shadow-xl text-right">
            <span className="text-[10px] font-bold text-[#AFA39B] uppercase tracking-wider block">
              TOTAL EVENT VOTES
            </span>
            <span className="font-['Cinzel'] text-2xl font-black text-[#F6AC67]">
              {totalVotes.toLocaleString()}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Stage: Top 3 Podium (Top) + Auto-Paginating Lower Grid (Bottom) */}
      <main className="flex-1 max-w-[1840px] w-full mx-auto px-8 py-5 flex flex-col justify-between gap-5">
        {/* SECTION A: PODIUM TOP 3 CARDS (#2, #1, #3) */}
        <section className="flex-1 flex flex-col justify-center">
          <div className="grid grid-cols-3 gap-6 lg:gap-10 items-end max-w-5xl mx-auto w-full pt-1">
            {/* #2 PLACE (Left) */}
            {second ? (
              <div className="flex flex-col items-center text-center transition-all duration-500">
                <div className="relative mb-3 group">
                  <div className="w-44 h-60 xl:w-48 xl:h-64 rounded-3xl overflow-hidden bg-[#27211F] border-2 border-[#AFA39B] shadow-2xl">
                    <img
                      src={second.imageUrl}
                      alt={second.name}
                      className="w-full h-full object-cover object-top"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80';
                      }}
                    />
                  </div>
                  {/* Rank Crown Pill */}
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#AFA39B] text-[#211D1C] font-black text-xs uppercase tracking-wider shadow-lg border border-[#E0D8D3]">
                    #2 PLACE
                  </div>
                </div>

                <div className="w-full bg-[#2A2422]/95 border border-[#4A3F39] rounded-2xl p-3.5 shadow-xl">
                  <span className="font-['Cinzel'] text-xs font-bold text-[#D8B37A]">
                    {second.numberDisplay}
                  </span>
                  <h3 className="font-bold text-lg text-[#F7F0EA] truncate mt-0.5">
                    {second.name}
                  </h3>
                  <p className="text-xs text-[#F6AC67] truncate font-medium mt-0.5">
                    {second.instagram || (second.costume?.startsWith('@') ? second.costume : `@${second.costume}`)}
                  </p>
                  <div className="mt-2.5 py-1.5 px-4 rounded-xl bg-[#342D2A] border border-[#4A3F39] text-[#F6AC67] font-['Cinzel'] font-black text-base lg:text-lg shadow">
                    {second.votes} {second.votes === 1 ? 'VOTE' : 'VOTES'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-60 flex items-center justify-center text-xs text-[#AFA39B]">
                Awaiting 2nd contender...
              </div>
            )}

            {/* #1 PLACE (Center - Elevated & Crowned) */}
            {first ? (
              <div className="flex flex-col items-center text-center -translate-y-3 transition-all duration-500">
                {/* 1st Place Champion Badge */}
                <div className="mb-2.5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#D8B37A] via-[#F6AC67] to-[#D8B37A] text-[#211D1C] text-xs font-black uppercase tracking-widest shadow-[0_0_25px_rgba(216,179,122,0.6)]">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  1ST PLACE LEADER
                </div>

                <div className="relative mb-3 group">
                  <div className="w-56 h-76 xl:w-60 xl:h-80 rounded-3xl overflow-hidden bg-[#27211F] border-4 border-[#D8B37A] shadow-[0_0_40px_rgba(216,179,122,0.45)]">
                    <img
                      src={first.imageUrl}
                      alt={first.name}
                      className="w-full h-full object-cover object-top"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80';
                      }}
                    />
                  </div>
                </div>

                <div className="w-full bg-[#342D2A] border-2 border-[#D8B37A] rounded-2xl p-4 shadow-2xl">
                  <span className="font-['Cinzel'] text-sm font-extrabold text-[#D8B37A]">
                    {first.numberDisplay}
                  </span>
                  <h3 className="font-extrabold text-xl lg:text-2xl text-[#F7F0EA] truncate mt-0.5">
                    {first.name}
                  </h3>
                  <p className="text-sm text-[#F6AC67] truncate font-semibold mt-0.5">
                    {first.instagram || (first.costume?.startsWith('@') ? first.costume : `@${first.costume}`)}
                  </p>
                  <div className="mt-2.5 py-2 px-5 rounded-xl bg-[#211D1C] border border-[#D8B37A]/60 text-[#F6AC67] font-['Cinzel'] font-black text-xl lg:text-2xl shadow-inner">
                    {first.votes} {first.votes === 1 ? 'VOTE' : 'VOTES'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-76 flex items-center justify-center text-xs text-[#AFA39B]">
                Awaiting leader...
              </div>
            )}

            {/* #3 PLACE (Right) */}
            {third ? (
              <div className="flex flex-col items-center text-center transition-all duration-500">
                <div className="relative mb-3 group">
                  <div className="w-44 h-60 xl:w-48 xl:h-64 rounded-3xl overflow-hidden bg-[#27211F] border-2 border-[#C87D4A] shadow-2xl">
                    <img
                      src={third.imageUrl}
                      alt={third.name}
                      className="w-full h-full object-cover object-top"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80';
                      }}
                    />
                  </div>
                  {/* Rank Crown Pill */}
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#C87D4A] text-[#211D1C] font-black text-xs uppercase tracking-wider shadow-lg border border-[#F6AC67]">
                    #3 PLACE
                  </div>
                </div>

                <div className="w-full bg-[#2A2422]/95 border border-[#4A3F39] rounded-2xl p-3.5 shadow-xl">
                  <span className="font-['Cinzel'] text-xs font-bold text-[#D8B37A]">
                    {third.numberDisplay}
                  </span>
                  <h3 className="font-bold text-lg text-[#F7F0EA] truncate mt-0.5">
                    {third.name}
                  </h3>
                  <p className="text-xs text-[#F6AC67] truncate font-medium mt-0.5">
                    {third.instagram || (third.costume?.startsWith('@') ? third.costume : `@${third.costume}`)}
                  </p>
                  <div className="mt-2.5 py-1.5 px-4 rounded-xl bg-[#342D2A] border border-[#4A3F39] text-[#F6AC67] font-['Cinzel'] font-black text-base lg:text-lg shadow">
                    {third.votes} {third.votes === 1 ? 'VOTE' : 'VOTES'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-60 flex items-center justify-center text-xs text-[#AFA39B]">
                Awaiting 3rd contender...
              </div>
            )}
          </div>
        </section>

        {/* SECTION B: BELOW PODIUM — #4 ONWARD READABLE GRID + AUTO-PAGINATION + TABLE QR */}
        <section className="bg-[#211D1C]/90 rounded-3xl border border-[#342D2A] p-4 lg:p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-5">
          {/* Left: Paginated Lower Rankings (#4 Onward) */}
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-3">
                <h3 className="font-['Cinzel'] text-xs font-bold text-[#D8B37A] tracking-[0.25em] uppercase">
                  CURRENT RUNNERS-UP
                </h3>
                {totalPages > 1 && (
                  <span className="text-[11px] font-bold text-[#AFA39B] bg-[#2A2422] px-2.5 py-0.5 rounded-full border border-[#4A3F39]">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                )}
              </div>

              {/* Page Indicator Dots */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === currentPage ? 'w-6 bg-[#F6AC67]' : 'w-2 bg-[#4A3F39]'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
              {displayedLowerContestants.length === 0 ? (
                <div className="col-span-full py-6 text-center text-xs text-[#AFA39B]">
                  No additional contestants registered yet.
                </div>
              ) : (
                displayedLowerContestants.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-2xl bg-[#2A2422] border border-[#3E3531] flex items-center gap-3 shadow-lg hover:border-[#D8B37A]/40 transition-all"
                  >
                    {/* Rank */}
                    <div className="w-7 text-center font-['Cinzel'] font-black text-sm text-[#AFA39B] flex-shrink-0">
                      #{c.rank}
                    </div>

                    {/* Thumbnail */}
                    <img
                      src={c.imageUrl}
                      alt={c.name}
                      className="w-12 h-14 rounded-xl object-cover object-top bg-[#1D1918] flex-shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80';
                      }}
                    />

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-['Cinzel'] font-bold text-[#D8B37A]">
                        {c.numberDisplay}
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm text-[#F7F0EA] truncate">
                        {c.name}
                      </h4>
                      <p className="text-[11px] text-[#F6AC67] truncate font-medium mt-0.5">
                        {c.instagram || (c.costume?.startsWith('@') ? c.costume : `@${c.costume}`)}
                      </p>
                      <div className="mt-1 font-['Cinzel'] font-bold text-xs text-[#F6AC67]">
                        {c.votes} {c.votes === 1 ? 'vote' : 'votes'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Table Scan QR Code Widget */}
          <div className="flex-shrink-0 bg-gradient-to-r from-[#2A2422] to-[#342D2A] rounded-2xl border border-[#D8B37A]/40 p-3.5 flex items-center gap-4 shadow-xl">
            <div className="space-y-1 max-w-[210px]">
              <span className="text-[9px] font-black text-[#F6AC67] tracking-widest uppercase block">
                LIVE BALLOT OPEN
              </span>
              <h4 className="font-['Cinzel'] text-xs font-bold text-[#F7F0EA] uppercase leading-tight">
                SCAN TO VOTE FROM YOUR TABLE
              </h4>
              <p className="text-[10px] text-[#AFA39B] leading-tight">
                Scan with any phone camera to vote for your favorite costume.
              </p>
            </div>

            {qrDataUrl && (
              <div className="p-1.5 rounded-xl bg-[#F6AC67] shadow-lg">
                <img
                  src={qrDataUrl}
                  alt={`Vote QR for ${outletCode}`}
                  className="w-20 h-20 rounded-lg object-contain"
                />
              </div>
            )}
          </div>
        </section>
      </main>

      {/* 3. Footer Branding */}
      <footer className="relative z-10 px-8 py-3 border-t border-[#342D2A]/80 bg-[#171413] flex items-center justify-between text-xs text-[#AFA39B]">
        <span>BLACK OWL INDONESIA • OFFICIAL HALLOWEEN SYSTEM</span>
        <span className="font-mono text-[11px]">Press 'F' for Venue Fullscreen</span>
      </footer>
    </div>
  );
};
