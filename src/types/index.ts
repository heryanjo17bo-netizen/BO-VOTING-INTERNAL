export type OutletCode = 'BOHO' | 'BOALL' | 'BOPIK' | 'BOKG' | 'BOGS' | 'BOSCBD' | 'BOSBY' | 'BOMDN';

export interface Outlet {
  code: OutletCode;
  name: string;
  shortName: string;
  city: string;
  address: string;
  votingActive: boolean;
  totalVotes: number;
}

export interface Contestant {
  id: string;
  outletCode: OutletCode;
  number: number;
  numberDisplay: string; // e.g. "#01"
  name: string;
  costume: string; // Used for Instagram username / IG handle (e.g. @username)
  instagram?: string;
  phoneNumber?: string; // Private / internal contact number (never shown on public voting/display)
  description?: string;
  imageUrl: string;
  votes: number;
  rank?: number;
  isActive: boolean;
  hasConsented: boolean;
  createdAt: string;
  isDemo?: boolean;
}

export interface VoteRecord {
  id: string;
  eventId: string;
  voterHash: string;
  outletCode: OutletCode;
  contestantId: string;
  timestamp: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'VOTE_CAST' | 'CONTESTANT_ADDED' | 'CONTESTANT_UPDATED' | 'CONTESTANT_HIDDEN' | 'CONTESTANT_DELETED' | 'VOTING_STATUS_CHANGED' | 'RESET_DEMO' | 'SYSTEM_BOOT' | 'DATABASE_INIT';
  outletCode: OutletCode;
  actor: string;
  details: string;
}

export interface StaffUser {
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'OUTLET_ADMIN';
  assignedOutlet?: OutletCode;
  avatarUrl?: string;
  pin?: string;
}

export interface VoterSessionStatus {
  voterId: string;
  hasVoted: boolean;
  votedContestantId?: string;
  votedOutletCode?: OutletCode;
  votedContestantNumber?: string;
  votedContestantName?: string;
  outlet: Outlet;
}
