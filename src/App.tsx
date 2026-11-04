import React, { useState, useEffect, useCallback } from 'react';
import type { Outlet, OutletCode, Contestant } from './types/index.ts';
import {
  fetchOutlet,
  fetchLeaderboard,
  castVote,
  subscribeToOutletEvents,
  getLocalVoterState,
  saveLocalVoterState,
  type LocalVoterState,
} from './utils/api.ts';
import { Header } from './components/Header.tsx';
import { ContestantCard } from './components/ContestantCard.tsx';
import { VoteConfirmModal } from './components/VoteConfirmModal.tsx';
import { VoteSuccessModal } from './components/VoteSuccessModal.tsx';
import { PhotoPreviewModal } from './components/PhotoPreviewModal.tsx';
import { MobileLeaderboard } from './components/MobileLeaderboard.tsx';
import { LedDisplayView } from './components/LedDisplayView.tsx';
import { AdminPortal } from './components/AdminPortal.tsx';
import { OutletLanding } from './components/OutletLanding.tsx';
import { mediaUrl, stripBase, withBase } from './utils/basePath.ts';

function normalizeRouteOutlet(code?: string): OutletCode {
  if (!code) return 'BOALL';
  const upper = code.toUpperCase();
  if (upper === 'BOHO') return 'BOHO';
  return 'BOALL';
}

// Helper to parse route from pathname or search/hash
function parseRoute(): {
  page: 'landing' | 'guest' | 'display' | 'admin';
  outletCode?: OutletCode;
  initialTab?: 'vote' | 'leaderboard';
} {
  const path = stripBase(window.location.pathname);
  const search = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace('#', '');

  // Check query param overrides (useful for preview mode)
  if (search.get('admin') === 'true' || path === '/admin' || hash === 'admin') {
    return { page: 'admin' };
  }

  const rawQueryOutlet = search.get('outlet');
  const queryOutlet = rawQueryOutlet ? normalizeRouteOutlet(rawQueryOutlet) : undefined;
  const queryView = search.get('view');

  if (queryView === 'display' && queryOutlet) {
    return { page: 'display', outletCode: queryOutlet };
  }
  if (queryView === 'leaderboard' && queryOutlet) {
    return { page: 'guest', outletCode: queryOutlet, initialTab: 'leaderboard' };
  }
  if (queryOutlet) {
    return { page: 'guest', outletCode: queryOutlet, initialTab: 'vote' };
  }

  // Check path pattern /vote/:outletCode, /leaderboard/:outletCode, /display/:outletCode
  const voteMatch = path.match(/^\/vote\/([A-Za-z0-9]+)/i) || hash.match(/^vote\/([A-Za-z0-9]+)/i);
  if (voteMatch) {
    return { page: 'guest', outletCode: normalizeRouteOutlet(voteMatch[1]), initialTab: 'vote' };
  }

  const lbMatch = path.match(/^\/leaderboard\/([A-Za-z0-9]+)/i) || hash.match(/^leaderboard\/([A-Za-z0-9]+)/i);
  if (lbMatch) {
    return { page: 'guest', outletCode: normalizeRouteOutlet(lbMatch[1]), initialTab: 'leaderboard' };
  }

  const displayMatch = path.match(/^\/display\/([A-Za-z0-9]+)/i) || hash.match(/^display\/([A-Za-z0-9]+)/i);
  if (displayMatch) {
    return { page: 'display', outletCode: normalizeRouteOutlet(displayMatch[1]) };
  }

  return { page: 'landing' };
}

export default function App() {
  const [routeInfo, setRouteInfo] = useState(parseRoute);

  // Persistent HP Voter State (1 vote for BOHO + 1 vote for BOALL)
  const [voterState, setVoterState] = useState<LocalVoterState>(() => getLocalVoterState());

  // Guest State
  const [outlet, setOutlet] = useState<Outlet | null>(null);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [leaderboard, setLeaderboard] = useState<Contestant[]>([]);
  const [activeTab, setActiveTab] = useState<'vote' | 'leaderboard'>('vote');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals
  const [confirmContestant, setConfirmContestant] = useState<Contestant | null>(null);
  const [successContestant, setSuccessContestant] = useState<Contestant | null>(null);
  const [previewContestant, setPreviewContestant] = useState<Contestant | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState<boolean>(false);

  // Active Category & Scoped Vote Status for this Phone
  const currentCategory: 'BOHO' | 'BOALL' = routeInfo.outletCode === 'BOHO' ? 'BOHO' : 'BOALL';
  const otherCategory: 'BOHO' | 'BOALL' = currentCategory === 'BOHO' ? 'BOALL' : 'BOHO';

  const currentVoteInfo = voterState[currentCategory];
  const otherVoteInfo = voterState[otherCategory];

  const hasVotedCurrent = Boolean(currentVoteInfo?.hasVoted);
  const votedContestantId = currentVoteInfo?.votedContestantId;
  const votedContestantName = currentVoteInfo?.votedContestant?.name;

  const hasVotedOther = Boolean(otherVoteInfo?.hasVoted);

  // Sync tab with route if requested
  useEffect(() => {
    if (routeInfo.initialTab) {
      setActiveTab(routeInfo.initialTab);
    }
  }, [routeInfo]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setRouteInfo(parseRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Monitor network online/offline state
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch outlet data for guest
  const loadGuestData = useCallback(async (code: OutletCode) => {
    try {
      setErrorMsg(null);
      const [outletRes, lbRes] = await Promise.all([
        fetchOutlet(code),
        fetchLeaderboard(code),
      ]);

      setOutlet(outletRes.outlet);
      setContestants(outletRes.contestants);
      setLeaderboard(lbRes.leaderboard);

      // Synchronize server-verified voter status into device state
      if (outletRes.voterStatus?.votesByOutlet) {
        setVoterState((prev) => {
          const next: LocalVoterState = {
            BOHO: {
              hasVoted: Boolean(outletRes.voterStatus.votesByOutlet?.BOHO?.hasVoted || prev.BOHO.hasVoted),
              votedContestantId: outletRes.voterStatus.votesByOutlet?.BOHO?.contestant?.id || prev.BOHO.votedContestantId,
              votedContestant: outletRes.voterStatus.votesByOutlet?.BOHO?.contestant || prev.BOHO.votedContestant,
            },
            BOALL: {
              hasVoted: Boolean(outletRes.voterStatus.votesByOutlet?.BOALL?.hasVoted || prev.BOALL.hasVoted),
              votedContestantId: outletRes.voterStatus.votesByOutlet?.BOALL?.contestant?.id || prev.BOALL.votedContestantId,
              votedContestant: outletRes.voterStatus.votesByOutlet?.BOALL?.contestant || prev.BOALL.votedContestant,
            },
          };
          saveLocalVoterState(next);
          return next;
        });
      }
    } catch (err: any) {
      console.error('Error loading guest view:', err);
      setErrorMsg(err.message || 'Unable to connect to venue server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (routeInfo.page === 'guest' && routeInfo.outletCode) {
      setIsLoading(true);
      loadGuestData(routeInfo.outletCode);

      // Real-time SSE updates
      const unsubscribe = subscribeToOutletEvents(routeInfo.outletCode, () => {
        loadGuestData(routeInfo.outletCode!);
      });

      return () => unsubscribe();
    }
  }, [routeInfo.page, routeInfo.outletCode, loadGuestData]);

  // Handle Vote Submission
  const handleVoteSubmit = async () => {
    if (!confirmContestant || !routeInfo.outletCode) return;
    setIsSubmittingVote(true);

    try {
      const res = await castVote(routeInfo.outletCode, confirmContestant.id);
      if (!res.success) {
        alert(res.error || 'Gagal mengirimkan vote.');
        if (res.code === 'DUPLICATE_VOTE' || res.existingContestant) {
          const normKey: 'BOHO' | 'BOALL' = routeInfo.outletCode === 'BOHO' ? 'BOHO' : 'BOALL';
          setVoterState((prev) => {
            const next: LocalVoterState = {
              ...prev,
              [normKey]: {
                hasVoted: true,
                votedContestantId: res.existingContestant?.id || prev[normKey].votedContestantId,
                votedContestant: res.existingContestant || prev[normKey].votedContestant,
              },
            };
            saveLocalVoterState(next);
            return next;
          });
        }
        setConfirmContestant(null);
        return;
      }

      // Successful Vote: Immediately lock vote in this category on this device
      const normKey: 'BOHO' | 'BOALL' = routeInfo.outletCode === 'BOHO' ? 'BOHO' : 'BOALL';
      setVoterState((prev) => {
        const next: LocalVoterState = {
          ...prev,
          [normKey]: {
            hasVoted: true,
            votedContestantId: confirmContestant.id,
            votedContestant: confirmContestant,
          },
        };
        saveLocalVoterState(next);
        return next;
      });

      setSuccessContestant(confirmContestant);
      setConfirmContestant(null);

      // Refresh data
      loadGuestData(routeInfo.outletCode);
    } catch (err: any) {
      alert(err.message || 'Network error while casting vote');
    } finally {
      setIsSubmittingVote(false);
    }
  };

  // Route Handlers
  const handleSelectOutletFromLanding = (code: string, route: 'vote' | 'leaderboard' | 'display') => {
    const url = route === 'display' ? `/display/${code}` : route === 'leaderboard' ? `/leaderboard/${code}` : `/vote/${code}`;
    window.history.pushState({}, '', withBase(url));
    setRouteInfo(parseRoute());
  };

  const handleOpenAdminFromLanding = () => {
    window.history.pushState({}, '', withBase('/admin'));
    setRouteInfo(parseRoute());
  };

  const handleReturnHome = () => {
    window.history.pushState({}, '', withBase('/'));
    setRouteInfo(parseRoute());
  };

  const handleSwitchCategory = (targetCode: 'BOHO' | 'BOALL') => {
    window.history.pushState({}, '', withBase(`/vote/${targetCode}`));
    setRouteInfo({ page: 'guest', outletCode: targetCode, initialTab: 'vote' });
  };

  // 1. Display LED Route
  if (routeInfo.page === 'display' && routeInfo.outletCode) {
    return <LedDisplayView outletCode={routeInfo.outletCode} />;
  }

  // 2. Admin Portal Route
  if (routeInfo.page === 'admin') {
    return <AdminPortal onNavigateHome={handleReturnHome} />;
  }

  // 3. Outlet Landing Hub Route
  if (routeInfo.page === 'landing' || !routeInfo.outletCode) {
    return (
      <OutletLanding
        onSelectOutlet={handleSelectOutletFromLanding}
        onOpenAdmin={handleOpenAdminFromLanding}
        voterState={voterState}
      />
    );
  }

  // 4. Guest Mobile Route (/vote/:outletCode or /leaderboard/:outletCode)
  return (
    <div className="min-h-screen bg-[#211D1C] text-[#F7F0EA] flex flex-col justify-between selection:bg-[#F6AC67]/30">
      {/* Offline warning banner */}
      {isOffline && (
        <div className="bg-rose-950 text-rose-200 text-xs px-4 py-2 text-center border-b border-rose-800 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping"></span>
          <span>You appear to be offline. Reconnecting to venue WiFi...</span>
        </div>
      )}

      {/* Main Guest Content */}
      <div className="flex-1 flex flex-col">
        {outlet ? (
          <>
            {/* Minimalist Mobile Header */}
            <Header
              outlet={outlet}
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                const newPath = tab === 'leaderboard' ? `/leaderboard/${outlet.code}` : `/vote/${outlet.code}`;
                window.history.replaceState({}, '', withBase(newPath));
              }}
              votingActive={outlet.votingActive}
              hasVoted={hasVotedCurrent}
              votedContestantName={votedContestantName}
              hasVotedOther={hasVotedOther}
              otherCategoryName={currentCategory === 'BOHO' ? 'Black Owl All Outlet' : 'Head Office'}
              onSwitchCategory={() => handleSwitchCategory(otherCategory)}
            />

            {/* Category Switcher: Head Office vs All Outlet */}
            <div className="max-w-md mx-auto w-full px-4 pt-2 pb-1">
              <div className="bg-[#27211F] p-1 rounded-2xl border border-[#4A3F39] flex items-center gap-1.5 shadow-inner">
                <button
                  type="button"
                  onClick={() => {
                    if (outlet.code !== 'BOHO') {
                      handleSwitchCategory('BOHO');
                    }
                  }}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    currentCategory === 'BOHO'
                      ? 'bg-[#342D2A] text-[#F6AC67] border border-[#D8B37A]/50 shadow'
                      : 'text-[#AFA39B] hover:text-[#F7F0EA]'
                  }`}
                >
                  <span className="truncate">Head Office</span>
                  {voterState.BOHO?.hasVoted ? (
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-700/60 px-1.5 py-0.2 rounded-full font-bold flex-shrink-0">
                      ✓ Voted
                    </span>
                  ) : (
                    <span className="text-[10px] bg-[#342D2A] text-[#D8B37A] border border-[#4A3F39] px-1.5 py-0.2 rounded-full font-medium flex-shrink-0">
                      1 Vote
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (outlet.code !== 'BOALL') {
                      handleSwitchCategory('BOALL');
                    }
                  }}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    currentCategory === 'BOALL'
                      ? 'bg-[#342D2A] text-[#F6AC67] border border-[#D8B37A]/50 shadow'
                      : 'text-[#AFA39B] hover:text-[#F7F0EA]'
                  }`}
                >
                  <span className="truncate">All Outlet</span>
                  {voterState.BOALL?.hasVoted ? (
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-700/60 px-1.5 py-0.2 rounded-full font-bold flex-shrink-0">
                      ✓ Voted
                    </span>
                  ) : (
                    <span className="text-[10px] bg-[#342D2A] text-[#D8B37A] border border-[#4A3F39] px-1.5 py-0.2 rounded-full font-medium flex-shrink-0">
                      1 Vote
                    </span>
                  )}
                </button>
              </div>

              {/* Informative Dual Voting Rule Guidance Bar */}
              <div className="mt-2 px-3 py-1.5 rounded-xl bg-[#2A2422]/90 border border-[#4A3F39]/60 flex items-center justify-between text-[11px] text-[#AFA39B]">
                {hasVotedCurrent && !hasVotedOther ? (
                  <>
                    <span className="truncate text-emerald-300">
                      ✓ Vote {currentCategory === 'BOHO' ? 'Head Office' : 'All Outlet'} tercatat.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSwitchCategory(otherCategory)}
                      className="text-[#F6AC67] font-bold hover:underline flex-shrink-0 ml-2"
                    >
                      Vote di {otherCategory === 'BOHO' ? 'Head Office' : 'All Outlet'} →
                    </button>
                  </>
                ) : !hasVotedCurrent && hasVotedOther ? (
                  <>
                    <span className="text-[#D8B37A] truncate">
                      🌟 1 Vote tersedia untuk {currentCategory === 'BOHO' ? 'Head Office' : 'All Outlet'}.
                    </span>
                    <span className="text-emerald-400 text-[10px] flex-shrink-0">
                      (1/2 Selesai)
                    </span>
                  </>
                ) : hasVotedCurrent && hasVotedOther ? (
                  <span className="text-emerald-400 font-medium mx-auto">
                    ✓ Lengkap! 1 HP telah memberikan 2 vote (Head Office & All Outlet).
                  </span>
                ) : (
                  <span className="mx-auto text-[11px] text-[#D8B37A]/90">
                    📱 1 HP berhak 1 Vote di Head Office + 1 Vote di All Outlet
                  </span>
                )}
              </div>
            </div>

            {/* Voting Closed Notice Banner */}
            {!outlet.votingActive && (
              <div className="max-w-md mx-auto w-full px-4 pt-3">
                <div className="p-3 rounded-2xl bg-[#342D2A] border border-[#F6AC67]/30 text-center">
                  <span className="font-['Cinzel'] font-bold text-xs text-[#F6AC67] tracking-wider uppercase block">
                    VOTING IS CURRENTLY CLOSED
                  </span>
                  <p className="text-[11px] text-[#AFA39B] mt-0.5">
                    Official ballot collection is paused. You can still inspect contestants and watch the live leaderboard!
                  </p>
                </div>
              </div>
            )}

            {/* TAB 1: VOTE - Contestants Grid */}
            {activeTab === 'vote' && (
              <main className="max-w-md mx-auto w-full px-3 sm:px-4 py-4 flex-1">
                {isLoading ? (
                  <div className="py-20 text-center space-y-3">
                    <div className="w-8 h-8 mx-auto border-2 border-[#D8B37A] border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-[#AFA39B] tracking-wider uppercase">
                      Loading Contestants...
                    </p>
                  </div>
                ) : contestants.length === 0 ? (
                  <div className="py-20 text-center bg-[#342D2A] rounded-3xl border border-[#4A3F39]/60 p-6 my-4">
                    <img
                      src={mediaUrl("/assets/aistudio/BO_LOGO_cc0ca4aa.png")}
                      alt="Black Owl"
                      className="w-12 h-12 mx-auto object-contain mb-3 opacity-60"
                    />
                    <h3 className="font-['Cinzel'] text-sm font-bold text-[#F7F0EA] uppercase">
                      No Contestants Registered Yet
                    </h3>
                    <p className="text-xs text-[#AFA39B] mt-1">
                      Event staff are currently registering contestants. Refresh or check back shortly!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
                    {contestants.map((c) => (
                      <ContestantCard
                        key={c.id}
                        contestant={c}
                        hasVoted={hasVotedCurrent}
                        isVotedForThis={votedContestantId === c.id}
                        votingActive={outlet.votingActive}
                        onVoteClick={(item) => setConfirmContestant(item)}
                        onPhotoClick={(item) => setPreviewContestant(item)}
                      />
                    ))}
                  </div>
                )}
              </main>
            )}

            {/* TAB 2: LEADERBOARD - Mobile Standings */}
            {activeTab === 'leaderboard' && (
              <main className="flex-1">
                <MobileLeaderboard
                  outlet={outlet}
                  leaderboard={leaderboard}
                  isLoading={isLoading}
                  onRefresh={() => loadGuestData(outlet.code)}
                  votedContestantId={votedContestantId}
                />
              </main>
            )}
          </>
        ) : isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <img
              src={mediaUrl("/assets/aistudio/BO_LOGO_cc0ca4aa.png")}
              alt="Black Owl"
              className="w-14 h-14 object-contain animate-pulse"
            />
            <p className="text-xs tracking-widest text-[#D8B37A] uppercase font-bold">
              Connecting to Venue...
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <h2 className="font-['Cinzel'] text-lg font-bold text-rose-400">
              Venue Outlet Not Found
            </h2>
            <p className="text-xs text-[#AFA39B] max-w-xs">
              {errorMsg || 'Please make sure you scanned an official venue QR code.'}
            </p>
            <button
              onClick={handleReturnHome}
              className="py-2 px-4 rounded-xl bg-[#342D2A] text-xs font-semibold text-[#D8B37A] cursor-pointer"
            >
              Return to Directory
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <VoteConfirmModal
        contestant={confirmContestant}
        outletName={outlet?.name || ''}
        isSubmitting={isSubmittingVote}
        onConfirm={handleVoteSubmit}
        onCancel={() => setConfirmContestant(null)}
      />

      {/* Vote Success Celebration Modal */}
      {successContestant && (
        <VoteSuccessModal
          contestant={successContestant}
          currentOutletCode={currentCategory}
          hasVotedOther={hasVotedOther}
          otherOutletName={currentCategory === 'BOHO' ? 'Black Owl All Outlet' : 'Black Owl Head Office'}
          onSwitchOutlet={() => {
            setSuccessContestant(null);
            handleSwitchCategory(otherCategory);
          }}
          onViewLeaderboard={() => {
            setSuccessContestant(null);
            setActiveTab('leaderboard');
          }}
          onClose={() => setSuccessContestant(null)}
        />
      )}

      {/* Fullscreen Photo Preview Modal */}
      <PhotoPreviewModal
        contestant={previewContestant}
        hasVoted={hasVotedCurrent}
        isVotedForThis={previewContestant?.id === votedContestantId}
        votingActive={Boolean(outlet?.votingActive)}
        onVoteClick={(item) => {
          setPreviewContestant(null);
          setConfirmContestant(item);
        }}
        onClose={() => setPreviewContestant(null)}
      />

      {/* Subtle Guest Footer */}
      <footer className="py-3 text-center text-[10px] text-[#AFA39B]/80 border-t border-[#342D2A]/60">
        <span>BLACK OWL • 1 HP BISA VOTE 1 KALI DI HEAD OFFICE & 1 KALI DI ALL OUTLET</span>
      </footer>
    </div>
  );
}
