import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Outlet, OutletCode, Contestant, VoteRecord, AuditLogEntry, StaffUser } from '../types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

export const EVENT_ID = 'bo-halloween-2026';
const SECRET_SALT = process.env.VOTER_HASH_SALT || 'black-owl-halloween-secret-salt-2026';

export const INITIAL_OUTLETS: Record<string, Outlet> = {
  BOHO: {
    code: 'BOHO',
    name: 'Black Owl Head Office',
    shortName: 'Head Office',
    city: 'Jakarta',
    address: 'Black Owl Head Office, Jakarta',
    votingActive: true,
    totalVotes: 0,
  },
  BOALL: {
    code: 'BOALL',
    name: 'Black Owl All Outlet',
    shortName: 'All Outlets',
    city: 'PIK, KG, Gading Serpong, SCBD, Surabaya, Medan',
    address: 'Black Owl Outlets (PIK, Kelapa Gading, Gading Serpong, SCBD, Surabaya, Medan)',
    votingActive: true,
    totalVotes: 0,
  },
};

// Authorized staff allowlist
export const STAFF_USERS: Record<string, StaffUser> = {
  'heryanjojo@gmail.com': {
    email: 'heryanjojo@gmail.com',
    name: 'Heryan Jojo',
    role: 'SUPER_ADMIN',
  },
  'superadmin@blackowl.id': {
    email: 'superadmin@blackowl.id',
    name: 'Black Owl Head of Events',
    role: 'SUPER_ADMIN',
  },
  'headoffice@blackowl.id': {
    email: 'headoffice@blackowl.id',
    name: 'Black Owl Head Office (HQ)',
    role: 'SUPER_ADMIN',
  },
  'admin.ho@blackowl.id': {
    email: 'admin.ho@blackowl.id',
    name: 'Outlet Lead — Head Office',
    role: 'OUTLET_ADMIN',
    assignedOutlet: 'BOHO',
  },
  'admin.all@blackowl.id': {
    email: 'admin.all@blackowl.id',
    name: 'Outlet Lead — All Outlets',
    role: 'OUTLET_ADMIN',
    assignedOutlet: 'BOALL',
  },
  'admin.pik@blackowl.id': {
    email: 'admin.pik@blackowl.id',
    name: 'Outlet Lead — PIK',
    role: 'OUTLET_ADMIN',
    assignedOutlet: 'BOALL',
  },
  'admin.scbd@blackowl.id': {
    email: 'admin.scbd@blackowl.id',
    name: 'Outlet Lead — SCBD',
    role: 'OUTLET_ADMIN',
    assignedOutlet: 'BOALL',
  },
  'admin.kg@blackowl.id': {
    email: 'admin.kg@blackowl.id',
    name: 'Outlet Lead — Kelapa Gading',
    role: 'OUTLET_ADMIN',
    assignedOutlet: 'BOALL',
  },
  'admin.gs@blackowl.id': {
    email: 'admin.gs@blackowl.id',
    name: 'Outlet Lead — Gading Serpong',
    role: 'OUTLET_ADMIN',
    assignedOutlet: 'BOALL',
  },
  'admin.sby@blackowl.id': {
    email: 'admin.sby@blackowl.id',
    name: 'Outlet Lead — Surabaya',
    role: 'OUTLET_ADMIN',
    assignedOutlet: 'BOALL',
  },
  'admin.mdn@blackowl.id': {
    email: 'admin.mdn@blackowl.id',
    name: 'Outlet Lead — Medan',
    role: 'OUTLET_ADMIN',
    assignedOutlet: 'BOALL',
  },
};

export function verifyStaffAccess(
  email: string | undefined,
  targetOutlet: OutletCode | undefined
): { ok: boolean; status: number; message?: string; user?: StaffUser } {
  if (!email) {
    return { ok: false, status: 401, message: 'Authentication required. Staff email header missing.' };
  }
  const user = STAFF_USERS[email.toLowerCase().trim()];
  if (!user) {
    return { ok: false, status: 403, message: `Access denied. ${email} is not on the authorized staff allowlist.` };
  }
  if (user.role === 'SUPER_ADMIN') {
    return { ok: true, status: 200, user };
  }
  if (user.role === 'OUTLET_ADMIN') {
    const normalizedTarget = (!targetOutlet || targetOutlet === 'BOHO') ? targetOutlet : 'BOALL';
    const legacyOutlets = ['BOALL', 'BOPIK', 'BOKG', 'BOGS', 'BOSCBD', 'BOSBY', 'BOMDN'];

    // Outlet admins for SCBD, KG, PIK, etc. can all access BOALL
    if (normalizedTarget === 'BOALL') {
      if (user.assignedOutlet && legacyOutlets.includes(user.assignedOutlet)) {
        return { ok: true, status: 200, user };
      }
    }
    // Head office target can only be accessed by BOHO admin
    if (normalizedTarget === 'BOHO' && user.assignedOutlet !== 'BOHO') {
      return {
        ok: false,
        status: 403,
        message: `Forbidden: Outlet Admin for ${user.assignedOutlet} cannot access Head Office records.`,
      };
    }
    if (normalizedTarget && user.assignedOutlet !== normalizedTarget) {
      return {
        ok: false,
        status: 403,
        message: `Forbidden: Outlet Admin for ${user.assignedOutlet} cannot access or modify records for ${targetOutlet}.`,
      };
    }
    return { ok: true, status: 200, user };
  }
  return { ok: false, status: 403, message: 'Unauthorized staff role.' };
}

export function addStaffUser(user: StaffUser): StaffUser {
  const normalizedEmail = user.email.toLowerCase().trim();
  const staff: StaffUser = {
    ...user,
    email: normalizedEmail,
    pin: user.pin ? user.pin.trim() : undefined,
  };
  STAFF_USERS[normalizedEmail] = staff;
  return staff;
}

export function updateStaffPin(email: string, pin?: string): StaffUser | null {
  const normalizedEmail = email.toLowerCase().trim();
  const staff = STAFF_USERS[normalizedEmail];
  if (!staff) return null;
  staff.pin = pin && pin.trim().length > 0 ? pin.trim() : undefined;
  return staff;
}

export function removeStaffUser(email: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  if (normalizedEmail === 'heryanjojo@gmail.com') {
    return false; // Owner cannot be deleted
  }
  if (STAFF_USERS[normalizedEmail]) {
    delete STAFF_USERS[normalizedEmail];
    return true;
  }
  return false;
}

export function getStaffUsersList(): StaffUser[] {
  return Object.values(STAFF_USERS);
}

// Premium royalty-free Halloween portrait assets for demo seeding
const SEED_PHOTOS = [
  'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80', // Vampire skull elegance
  'https://images.unsplash.com/photo-1603775020644-eb8decd79994?auto=format&fit=crop&w=800&q=80', // Gothic sorceress
  'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&w=800&q=80', // Elegant Phantom
  'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=800&q=80', // Baroque masquerade gentleman
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80', // Cyberpunk siren
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80', // Venetian witch
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80', // Steampunk warlock
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80', // Blood sovereign
];

export class VotingEngine {
  private outlets: Map<OutletCode, Outlet> = new Map();
  private contestants: Map<string, Contestant> = new Map();
  private votes: Map<string, VoteRecord> = new Map(); // key: eventId + ":" + voterHash
  private boundOutlets: Map<string, OutletCode> = new Map(); // key: voterHash -> first bound outlet
  private auditLogs: AuditLogEntry[] = [];
  private listeners: Set<(outletCode: OutletCode) => void> = new Set();
  private rateLimitMap: Map<string, { count: number; resetAt: number }> = new Map();
  private mutexChain: Promise<unknown> = Promise.resolve();
  private dbPath: string | null = DB_FILE;

  private cleanMode = false;

  constructor(options?: { inMemory?: boolean; dbPath?: string; clean?: boolean }) {
    this.cleanMode = !!options?.clean;
    this.initOutlets();
    if (options?.inMemory) {
      this.dbPath = null;
      this.seedDemoData();
    } else {
      if (options?.dbPath) {
        this.dbPath = options.dbPath;
      }
      const loaded = this.loadFromDisk();
      if (!loaded) {
        if (!this.cleanMode) {
          this.seedBohoContestants();
          this.seedBoallContestants();
          const boho = this.outlets.get('BOHO');
          if (boho) {
            boho.totalVotes = Array.from(this.contestants.values())
              .filter((c) => c.outletCode === 'BOHO')
              .reduce((sum, c) => sum + c.votes, 0);
          }
          const boall = this.outlets.get('BOALL');
          if (boall) {
            boall.totalVotes = Array.from(this.contestants.values())
              .filter((c) => c.outletCode === 'BOALL')
              .reduce((sum, c) => sum + c.votes, 0);
          }
        }
        this.auditLogs.unshift({
          id: `audit_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'SYSTEM_BOOT',
          outletCode: 'BOHO',
          actor: 'SYSTEM',
          details: 'Initialized contestants for Head Office and Black Owl All Outlet.',
        });
        this.saveToDisk();
      } else {
        let needsSave = false;
        for (const [code, outlet] of Object.entries(INITIAL_OUTLETS)) {
          if (!this.outlets.has(code as OutletCode)) {
            this.outlets.set(code as OutletCode, { ...outlet });
            needsSave = true;
          }
        }
        if (!STAFF_USERS['admin.ho@blackowl.id']) {
          STAFF_USERS['admin.ho@blackowl.id'] = {
            email: 'admin.ho@blackowl.id',
            name: 'Outlet Lead — Head Office',
            role: 'OUTLET_ADMIN',
            assignedOutlet: 'BOHO',
          };
          needsSave = true;
        }
        if (!STAFF_USERS['headoffice@blackowl.id']) {
          STAFF_USERS['headoffice@blackowl.id'] = {
            email: 'headoffice@blackowl.id',
            name: 'Black Owl Head Office (HQ)',
            role: 'SUPER_ADMIN',
          };
          needsSave = true;
        }
        if (needsSave) {
          this.saveToDisk();
        }
      }
    }
  }

  private initOutlets() {
    for (const [code, outlet] of Object.entries(INITIAL_OUTLETS)) {
      this.outlets.set(code as OutletCode, { ...outlet });
    }
  }

  private saveToDisk() {
    if (!this.dbPath) return;
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        outlets: Array.from(this.outlets.entries()),
        contestants: Array.from(this.contestants.entries()),
        votes: Array.from(this.votes.entries()),
        boundOutlets: Array.from(this.boundOutlets.entries()),
        auditLogs: this.auditLogs,
        staffUsers: Object.values(STAFF_USERS),
      };
      const jsonContent = JSON.stringify(data, null, 2);
      // Atomic write using .tmp and rename to avoid partial writes or race-conditions
      const tmpPath = `${this.dbPath}.tmp`;
      fs.writeFileSync(tmpPath, jsonContent, 'utf-8');
      fs.renameSync(tmpPath, this.dbPath);

      // Synchronize durable backup file
      const bakPath = `${this.dbPath}.bak`;
      fs.writeFileSync(bakPath, jsonContent, 'utf-8');
    } catch (err) {
      console.error('Failed to persist database to disk:', err);
    }
  }

  public persist() {
    this.saveToDisk();
  }

  public normalizeOutletCode(code: string | undefined): OutletCode {
    if (!code) return 'BOALL';
    const upper = code.toUpperCase();
    if (upper === 'BOHO') return 'BOHO';
    return 'BOALL';
  }

  private loadFromDisk(): boolean {
    if (!this.dbPath) return false;
    const candidates = [this.dbPath, `${this.dbPath}.bak`];
    for (const targetFile of candidates) {
      if (!fs.existsSync(targetFile)) continue;
      try {
        const raw = fs.readFileSync(targetFile, 'utf-8');
        if (!raw || raw.trim().length === 0) continue;
        const parsed = JSON.parse(raw);

        // Reset outlets map strictly to the 2 supported venues
        this.outlets.clear();
        for (const [code, outlet] of Object.entries(INITIAL_OUTLETS)) {
          this.outlets.set(code as OutletCode, { ...outlet });
        }

        // Restore votingActive states if present
        if (parsed.outlets) {
          for (const [k, v] of parsed.outlets) {
            if (k === 'BOHO' && this.outlets.has('BOHO') && v) {
              this.outlets.get('BOHO')!.votingActive = v.votingActive;
            } else if (this.outlets.has('BOALL') && v) {
              if (k === 'BOALL' || k === 'BOPIK') {
                this.outlets.get('BOALL')!.votingActive = v.votingActive;
              }
            }
          }
        }

        let migratedCount = 0;

        if (parsed.contestants) {
          for (const [k, v] of parsed.contestants) {
            const contestant: Contestant = { ...v };
            if (contestant.outletCode !== 'BOHO' && contestant.outletCode !== 'BOALL') {
              contestant.outletCode = 'BOALL';
              migratedCount++;
            }
            this.contestants.set(k, contestant);
          }

          // Ensure sequential numbers for BOALL if merged contestants have overlapping numbers
          const boallContestants = Array.from(this.contestants.values())
            .filter((c) => c.outletCode === 'BOALL')
            .sort((a, b) => {
              const dateA = new Date(a.createdAt || 0).getTime();
              const dateB = new Date(b.createdAt || 0).getTime();
              if (dateA !== dateB) return dateA - dateB;
              return a.number - b.number;
            });

          // Check if there are duplicate numbers
          const seenNumbers = new Set<number>();
          let hasDuplicates = false;
          for (const c of boallContestants) {
            if (seenNumbers.has(c.number)) {
              hasDuplicates = true;
              break;
            }
            seenNumbers.add(c.number);
          }

          if (hasDuplicates) {
            boallContestants.forEach((c, idx) => {
              const seq = idx + 1;
              c.number = seq;
              c.numberDisplay = `#${seq.toString().padStart(2, '0')}`;
              this.contestants.set(c.id, c);
            });
            migratedCount++;
          }
        }

        if (parsed.votes) {
          for (const [k, v] of parsed.votes) {
            const vote: VoteRecord = { ...v };
            if (vote.outletCode !== 'BOHO' && vote.outletCode !== 'BOALL') {
              vote.outletCode = 'BOALL';
              migratedCount++;
            }
            const normalizedKey = `${EVENT_ID}:${vote.outletCode}:${vote.voterHash}`;
            this.votes.set(normalizedKey, vote);
          }
        }

        if (parsed.boundOutlets) {
          for (const [k, v] of parsed.boundOutlets) {
            const normalizedBound: OutletCode = v === 'BOHO' ? 'BOHO' : 'BOALL';
            if (v !== normalizedBound) migratedCount++;
            this.boundOutlets.set(k, normalizedBound);
          }
        }

        if (parsed.auditLogs) {
          this.auditLogs = parsed.auditLogs.map((log: AuditLogEntry) => ({
            ...log,
            outletCode: log.outletCode === 'BOHO' ? 'BOHO' : 'BOALL',
          }));
        }

        if (Array.isArray(parsed.staffUsers)) {
          for (const staff of parsed.staffUsers) {
            if (staff && staff.email) {
              const staffEmail = staff.email.toLowerCase().trim();
              const existing = STAFF_USERS[staffEmail];
              const normalizedOutlet = staff.assignedOutlet === 'BOHO' ? 'BOHO' : 'BOALL';
              if (existing) {
                STAFF_USERS[staffEmail] = {
                  ...existing,
                  ...staff,
                  assignedOutlet: existing.role === 'OUTLET_ADMIN' ? normalizedOutlet : undefined,
                };
              } else {
                STAFF_USERS[staffEmail] = {
                  ...staff,
                  assignedOutlet: staff.role === 'OUTLET_ADMIN' ? normalizedOutlet : undefined,
                };
              }
            }
          }
        }

        // Ensure BOHO and BOALL have their full contestants populated
        if (!this.cleanMode) {
          const bohoCount = Array.from(this.contestants.values()).filter((c) => c.outletCode === 'BOHO').length;
          const boallCount = Array.from(this.contestants.values()).filter((c) => c.outletCode === 'BOALL').length;

          if (bohoCount === 0) {
            this.seedBohoContestants();
            migratedCount++;
          }
          if (boallCount === 0) {
            this.seedBoallContestants();
            migratedCount++;
          }
        }

        // Re-calculate vote totals for BOHO and BOALL
        const boho = this.outlets.get('BOHO');
        if (boho) {
          boho.totalVotes = Array.from(this.contestants.values())
            .filter((c) => c.outletCode === 'BOHO')
            .reduce((sum, c) => sum + c.votes, 0);
        }

        const boall = this.outlets.get('BOALL');
        if (boall) {
          boall.totalVotes = Array.from(this.contestants.values())
            .filter((c) => c.outletCode === 'BOALL')
            .reduce((sum, c) => sum + c.votes, 0);
        }

        if (migratedCount > 0) {
          const totalBoall = Array.from(this.contestants.values()).filter((c) => c.outletCode === 'BOALL').length;
          this.auditLogs.unshift({
            id: `audit_${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'CONTESTANT_UPDATED',
            outletCode: 'BOALL',
            actor: 'SYSTEM_MIGRATION',
            details: `Synchronized Black Owl Head Office and Black Owl All Outlet (total BOALL: ${totalBoall} contestants).`,
          });
          this.saveToDisk();
        }

        return true;
      } catch (err) {
        console.warn(`Failed reading database from ${targetFile}:`, err);
      }
    }
    return false;
  }

  private seedBohoContestants() {
    const bohoList = [
      {
        number: 1,
        name: 'Valentina Valois',
        ig: '@valentinavalois',
        phone: '0812-9843-1101',
        desc: 'Black Owl Head Office — Vampire Elegance costume for Halloween Night.',
        imageUrl: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80',
        votes: 42,
      },
      {
        number: 2,
        name: 'Kaelen Thorne',
        ig: '@kaelenthorne',
        phone: '0813-8821-4402',
        desc: 'Black Owl Head Office — Gothic Sorcerer costume for Halloween Night.',
        imageUrl: 'https://images.unsplash.com/photo-1603775020644-eb8decd79994?auto=format&fit=crop&w=800&q=80',
        votes: 38,
      },
      {
        number: 3,
        name: 'Aurelia Vance',
        ig: '@aureliavance',
        phone: '0811-7729-3303',
        desc: 'Black Owl Head Office — Masquerade Phantom costume for Halloween Night.',
        imageUrl: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&w=800&q=80',
        votes: 31,
      },
      {
        number: 4,
        name: 'Dante Moretti',
        ig: '@dantemoretti',
        phone: '0818-4455-6604',
        desc: 'Black Owl Head Office — Baroque Noble costume for Halloween Night.',
        imageUrl: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=800&q=80',
        votes: 27,
      },
      {
        number: 5,
        name: 'Seraphina Roux',
        ig: '@seraphinaroux',
        phone: '0821-3322-1105',
        desc: 'Black Owl Head Office — Dark Siren costume for Halloween Night.',
        imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
        votes: 23,
      },
      {
        number: 6,
        name: 'Marcus Sterling',
        ig: '@marcussterling',
        phone: '0857-1122-3306',
        desc: 'Black Owl Head Office — Blood Sovereign costume for Halloween Night.',
        imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
        votes: 19,
      },
    ];

    bohoList.forEach((c) => {
      const id = `c_boho_${c.number}`;
      this.contestants.set(id, {
        id,
        outletCode: 'BOHO',
        number: c.number,
        numberDisplay: `#${c.number.toString().padStart(2, '0')}`,
        name: c.name,
        costume: c.ig,
        instagram: c.ig,
        phoneNumber: c.phone,
        description: c.desc,
        imageUrl: c.imageUrl,
        votes: c.votes,
        isActive: true,
        hasConsented: true,
        createdAt: new Date(Date.now() - (10 - c.number) * 3600000).toISOString(),
      });
    });
  }

  private seedBoallContestants() {
    const branchList = [
      // PIK (#01 - #06)
      { num: 1, name: 'Valentina Valois', branch: 'PIK', ig: '@valentinavalois_pik', phone: '0812-9843-1101', votes: 45, img: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80' },
      { num: 2, name: 'Kaelen Thorne', branch: 'PIK', ig: '@kaelenthorne_pik', phone: '0813-8821-4402', votes: 39, img: 'https://images.unsplash.com/photo-1603775020644-eb8decd79994?auto=format&fit=crop&w=800&q=80' },
      { num: 3, name: 'Aurelia Vance', branch: 'PIK', ig: '@aureliavance_pik', phone: '0811-7729-3303', votes: 34, img: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&w=800&q=80' },
      { num: 4, name: 'Dante Moretti', branch: 'PIK', ig: '@dantemoretti_pik', phone: '0818-4455-6604', votes: 28, img: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=800&q=80' },
      { num: 5, name: 'Seraphina Roux', branch: 'PIK', ig: '@seraphinaroux_pik', phone: '0821-3322-1105', votes: 22, img: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80' },
      { num: 6, name: 'Marcus Sterling', branch: 'PIK', ig: '@marcussterling_pik', phone: '0857-1122-3306', votes: 18, img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80' },

      // Kelapa Gading (#07 - #12)
      { num: 7, name: 'Elena Rostova', branch: 'Kelapa Gading', ig: '@elenarostova_kg', phone: '0812-4455-2201', votes: 41, img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80' },
      { num: 8, name: 'Viktor Draven', branch: 'Kelapa Gading', ig: '@viktordraven_kg', phone: '0813-7788-2202', votes: 36, img: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80' },
      { num: 9, name: 'Lilith Morgan', branch: 'Kelapa Gading', ig: '@lilithmorgan_kg', phone: '0811-9922-2203', votes: 30, img: 'https://images.unsplash.com/photo-1576836165612-8bc9b07e7778?auto=format&fit=crop&w=800&q=80' },
      { num: 10, name: 'Lucien Cross', branch: 'Kelapa Gading', ig: '@luciencross_kg', phone: '0818-6611-2204', votes: 26, img: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=800&q=80' },
      { num: 11, name: 'Astrid Vane', branch: 'Kelapa Gading', ig: '@astridvane_kg', phone: '0821-5544-2205', votes: 21, img: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80' },
      { num: 12, name: 'Damian Thorne', branch: 'Kelapa Gading', ig: '@damianthorne_kg', phone: '0857-3322-2206', votes: 17, img: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80' },

      // Gading Serpong (#13 - #18)
      { num: 13, name: 'Cassandra Bell', branch: 'Gading Serpong', ig: '@cassandrabell_gs', phone: '0812-3344-3301', votes: 40, img: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80' },
      { num: 14, name: 'Felix Faust', branch: 'Gading Serpong', ig: '@felixfaust_gs', phone: '0813-2211-3302', votes: 35, img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80' },
      { num: 15, name: 'Isabella Nocturne', branch: 'Gading Serpong', ig: '@isabellanocturne_gs', phone: '0811-6677-3303', votes: 29, img: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=80' },
      { num: 16, name: 'Gabriel Grimm', branch: 'Gading Serpong', ig: '@gabrielgrimm_gs', phone: '0818-8899-3304', votes: 25, img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80' },
      { num: 17, name: 'Morgana LeFay', branch: 'Gading Serpong', ig: '@morganalefay_gs', phone: '0821-7788-3305', votes: 20, img: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80' },
      { num: 18, name: 'Tristan Darke', branch: 'Gading Serpong', ig: '@tristandarke_gs', phone: '0857-4455-3306', votes: 16, img: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&w=800&q=80' },

      // SCBD (#19 - #24)
      { num: 19, name: 'Natasha Roman', branch: 'SCBD', ig: '@natasharoman_scbd', phone: '0812-1122-4401', votes: 44, img: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80' },
      { num: 20, name: 'Christian Grey', branch: 'SCBD', ig: '@christiangrey_scbd', phone: '0813-9988-4402', votes: 37, img: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=800&q=80' },
      { num: 21, name: 'Valerie Fox', branch: 'SCBD', ig: '@valeriefox_scbd', phone: '0811-3344-4403', votes: 32, img: 'https://images.unsplash.com/photo-1603775020644-eb8decd79994?auto=format&fit=crop&w=800&q=80' },
      { num: 22, name: 'Sebastian Kane', branch: 'SCBD', ig: '@sebastiankane_scbd', phone: '0818-5566-4404', votes: 27, img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80' },
      { num: 23, name: 'Diana Prince', branch: 'SCBD', ig: '@dianaprince_scbd', phone: '0821-2233-4405', votes: 24, img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80' },
      { num: 24, name: 'Dominic Toretto', branch: 'SCBD', ig: '@dominictoretto_scbd', phone: '0857-6677-4406', votes: 19, img: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80' },

      // Surabaya (#25 - #30)
      { num: 25, name: 'Natalia Suryo', branch: 'Surabaya', ig: '@nataliasuryo_sby', phone: '0812-7788-5501', votes: 39, img: 'https://images.unsplash.com/photo-1576836165612-8bc9b07e7778?auto=format&fit=crop&w=800&q=80' },
      { num: 26, name: 'Kenji Tanaka', branch: 'Surabaya', ig: '@kenjitanaka_sby', phone: '0813-6655-5502', votes: 34, img: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=800&q=80' },
      { num: 27, name: 'Michelle Halim', branch: 'Surabaya', ig: '@michellehalim_sby', phone: '0811-4433-5503', votes: 28, img: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80' },
      { num: 28, name: 'Reza Rahadian', branch: 'Surabaya', ig: '@rezarahadian_sby', phone: '0818-2233-5504', votes: 25, img: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80' },
      { num: 29, name: 'Chloe Tan', branch: 'Surabaya', ig: '@chloetan_sby', phone: '0821-8899-5505', votes: 22, img: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=800&q=80' },
      { num: 30, name: 'Anthony Wong', branch: 'Surabaya', ig: '@anthonywong_sby', phone: '0857-9988-5506', votes: 18, img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80' },

      // Medan (#31 - #36)
      { num: 31, name: 'Stephanie Siregar', branch: 'Medan', ig: '@stephaniesiregar_mdn', phone: '0812-5566-6601', votes: 38, img: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=80' },
      { num: 32, name: 'Ricky Pratama', branch: 'Medan', ig: '@rickypratama_mdn', phone: '0813-4433-6602', votes: 33, img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80' },
      { num: 33, name: 'Vanessa Wu', branch: 'Medan', ig: '@vanessawu_mdn', phone: '0811-8877-6603', votes: 29, img: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=800&q=80' },
      { num: 34, name: 'Michael Chen', branch: 'Medan', ig: '@michaelchen_mdn', phone: '0818-7766-6604', votes: 26, img: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&w=800&q=80' },
      { num: 35, name: 'Keisha Lubis', branch: 'Medan', ig: '@keishalubis_mdn', phone: '0821-6655-6605', votes: 21, img: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80' },
      { num: 36, name: 'Brandon Lee', branch: 'Medan', ig: '@brandonlee_mdn', phone: '0857-5544-6606', votes: 17, img: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=800&q=80' },

      // Uploaded Contestant (#37)
      { num: 37, name: 'Test Upload Contestant', branch: 'Uploaded', ig: '@testcostume', phone: '0812-8899-7711', votes: 15, img: '/uploads/1793600722177-9fa2f5c71d55.jpg' },
    ];

    branchList.forEach((c) => {
      const id = `c_boall_${c.num}`;
      this.contestants.set(id, {
        id,
        outletCode: 'BOALL',
        number: c.num,
        numberDisplay: `#${c.num.toString().padStart(2, '0')}`,
        name: c.name,
        costume: c.ig,
        instagram: c.ig,
        phoneNumber: c.phone,
        description: c.branch === 'Uploaded'
          ? 'Uploaded costume photo for Black Owl All Outlet Halloween Night.'
          : `Black Owl ${c.branch} contestant for Halloween Night (Black Owl All Outlet).`,
        imageUrl: c.img,
        votes: c.votes,
        isActive: true,
        hasConsented: true,
        createdAt: new Date(Date.now() - (45 - c.num) * 3600000).toISOString(),
      });
    });
  }

  public seedDemoData() {
    this.contestants.clear();
    this.votes.clear();
    this.boundOutlets.clear();
    this.auditLogs = [];

    this.seedBohoContestants();
    this.seedBoallContestants();

    const boho = this.outlets.get('BOHO');
    if (boho) {
      boho.totalVotes = Array.from(this.contestants.values())
        .filter((c) => c.outletCode === 'BOHO')
        .reduce((sum, c) => sum + c.votes, 0);
    }

    const boall = this.outlets.get('BOALL');
    if (boall) {
      boall.totalVotes = Array.from(this.contestants.values())
        .filter((c) => c.outletCode === 'BOALL')
        .reduce((sum, c) => sum + c.votes, 0);
    }

    this.auditLogs.push({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'RESET_DEMO',
      outletCode: 'BOALL',
      actor: 'SYSTEM_BOOT',
      details: 'Initialized contestants for Head Office and All Outlets.',
    });

    this.saveToDisk();
  }

  public hashVoterIdentity(voterId: string): string {
    return crypto.createHmac('sha256', SECRET_SALT).update(voterId.trim()).digest('hex');
  }

  // Bind voter identity to first outlet
  public bindVoterToOutlet(voterId: string, outletCode: OutletCode): void {
    if (!voterId) return;
    const normalized = this.normalizeOutletCode(outletCode);
    const voterHash = this.hashVoterIdentity(voterId);
    if (!this.boundOutlets.has(voterHash)) {
      this.boundOutlets.set(voterHash, normalized);
      this.saveToDisk();
    }
  }

  // Real-time listener registration
  public subscribe(callback: (outletCode: OutletCode) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(outletCode: OutletCode) {
    const normalized = this.normalizeOutletCode(outletCode);
    for (const listener of this.listeners) {
      try {
        listener(normalized);
      } catch (err) {
        console.error('Error invoking voting engine subscriber:', err);
      }
    }
  }

  // Outlets
  public getOutlets(): Outlet[] {
    return Array.from(this.outlets.values());
  }

  public getOutlet(code: OutletCode): Outlet | undefined {
    const normalized = this.normalizeOutletCode(code);
    return this.outlets.get(normalized);
  }

  public setOutletVotingStatus(code: OutletCode, active: boolean, actor: string): boolean {
    const normalized = this.normalizeOutletCode(code);
    const outlet = this.outlets.get(normalized);
    if (!outlet) return false;
    outlet.votingActive = active;

    this.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'VOTING_STATUS_CHANGED',
      outletCode: normalized,
      actor,
      details: `Voting ${active ? 'OPENED' : 'CLOSED'} for ${outlet.name}.`,
    });

    this.saveToDisk();
    this.notify(normalized);
    return true;
  }

  // Contestants
  public getContestants(
    outletCode: OutletCode,
    includeHidden = false,
    includePrivate = true
  ): Contestant[] {
    const normalized = this.normalizeOutletCode(outletCode);
    const list = Array.from(this.contestants.values()).filter(
      (c) => c.outletCode === normalized && (includeHidden || c.isActive)
    );
    // Sort by number ascending
    const sorted = list.sort((a, b) => a.number - b.number);
    if (includePrivate) {
      return sorted;
    }
    // Redact private fields like phoneNumber for public guest voting views
    return sorted.map((c) => {
      const { phoneNumber, ...publicContestant } = c;
      return publicContestant as Contestant;
    });
  }

  // Leaderboard: sort descending by votes, using contestant number ascending as deterministic tie-break
  public getLeaderboard(outletCode: OutletCode): Contestant[] {
    const normalized = this.normalizeOutletCode(outletCode);
    const list = Array.from(this.contestants.values()).filter(
      (c) => c.outletCode === normalized && c.isActive
    );

    // Exact deterministic tie-break: votes DESC, then number ASC
    list.sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return a.number - b.number;
    });

    return list.map((c, idx) => {
      const { phoneNumber, ...publicContestant } = c;
      return {
        ...publicContestant,
        rank: idx + 1,
      } as Contestant;
    });
  }

  public getContestantById(id: string): Contestant | undefined {
    return this.contestants.get(id);
  }

  public getNextContestantNumber(outletCode: OutletCode): number {
    const normalized = this.normalizeOutletCode(outletCode);
    const contestants = Array.from(this.contestants.values()).filter((c) => c.outletCode === normalized);
    if (contestants.length === 0) return 1;
    const maxNum = Math.max(...contestants.map((c) => c.number));
    return maxNum + 1;
  }

  public addContestant(data: {
    outletCode: OutletCode;
    name: string;
    costume: string; // Instagram username / IG handle (e.g. @username)
    instagram?: string;
    phoneNumber?: string;
    description?: string;
    imageUrl: string;
    hasConsented: boolean;
    actor: string;
  }): Contestant {
    const normalized = this.normalizeOutletCode(data.outletCode);
    const nextNum = this.getNextContestantNumber(normalized);
    const id = `c_${normalized.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Normalize Instagram handle with @ prefix
    let igHandle = (data.instagram || data.costume).trim();
    if (igHandle && !igHandle.startsWith('@')) {
      igHandle = `@${igHandle}`;
    }

    const contestant: Contestant = {
      id,
      outletCode: normalized,
      number: nextNum,
      numberDisplay: `#${nextNum.toString().padStart(2, '0')}`,
      name: data.name.trim(),
      costume: igHandle,
      instagram: igHandle,
      phoneNumber: data.phoneNumber && data.phoneNumber.trim().length > 0 ? data.phoneNumber.trim() : undefined,
      description: data.description?.trim(),
      imageUrl: data.imageUrl,
      votes: 0,
      isActive: true,
      hasConsented: data.hasConsented,
      createdAt: new Date().toISOString(),
    };

    this.contestants.set(id, contestant);

    this.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'CONTESTANT_ADDED',
      outletCode: normalized,
      actor: data.actor,
      details: `Added contestant ${contestant.numberDisplay} - ${contestant.name} (${contestant.costume}).`,
    });

    this.saveToDisk();
    this.notify(normalized);
    return contestant;
  }

  public updateContestant(
    id: string,
    updates: Partial<Pick<Contestant, 'name' | 'costume' | 'instagram' | 'phoneNumber' | 'description' | 'imageUrl' | 'isActive'>>,
    actor: string
  ): Contestant | null {
    const contestant = this.contestants.get(id);
    if (!contestant) return null;

    if (updates.costume !== undefined || updates.instagram !== undefined) {
      let igHandle = (updates.instagram || updates.costume || '').trim();
      if (igHandle && !igHandle.startsWith('@')) {
        igHandle = `@${igHandle}`;
      }
      updates.costume = igHandle;
      updates.instagram = igHandle;
    }

    if (updates.phoneNumber !== undefined) {
      updates.phoneNumber = updates.phoneNumber && updates.phoneNumber.trim().length > 0 ? updates.phoneNumber.trim() : undefined;
    }

    Object.assign(contestant, updates);

    this.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'CONTESTANT_UPDATED',
      outletCode: contestant.outletCode,
      actor,
      details: `Updated contestant ${contestant.numberDisplay} - ${contestant.name}.`,
    });

    this.saveToDisk();
    this.notify(contestant.outletCode);
    return contestant;
  }

  public toggleHideContestant(id: string, actor: string): Contestant | null {
    const contestant = this.contestants.get(id);
    if (!contestant) return null;

    contestant.isActive = !contestant.isActive;

    this.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'CONTESTANT_HIDDEN',
      outletCode: contestant.outletCode,
      actor,
      details: `${contestant.isActive ? 'Unhid' : 'Hid'} contestant ${contestant.numberDisplay} - ${contestant.name}.`,
    });

    this.saveToDisk();
    this.notify(contestant.outletCode);
    return contestant;
  }

  public deleteContestant(id: string, actor: string): boolean {
    const contestant = this.contestants.get(id);
    if (!contestant) return false;

    const outlet = this.outlets.get(contestant.outletCode);
    if (outlet) {
      outlet.totalVotes = Math.max(0, outlet.totalVotes - contestant.votes);
    }

    this.contestants.delete(id);

    // Remove any cast votes for this contestant
    for (const [key, v] of this.votes.entries()) {
      if (v.contestantId === id) {
        this.votes.delete(key);
      }
    }

    this.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'CONTESTANT_DELETED',
      outletCode: contestant.outletCode,
      actor,
      details: `Permanently deleted contestant ${contestant.numberDisplay} - ${contestant.name} (had ${contestant.votes} votes).`,
    });

    this.saveToDisk();
    this.notify(contestant.outletCode);
    return true;
  }

  public deleteMultipleContestants(
    ids: string[],
    outletCode: OutletCode,
    actor: string
  ): { deletedCount: number; remainingCount: number } {
    let deletedCount = 0;
    const normalized = this.normalizeOutletCode(outletCode);
    const outlet = this.outlets.get(normalized);

    for (const id of ids) {
      const contestant = this.contestants.get(id);
      if (contestant && contestant.outletCode === normalized) {
        if (outlet) {
          outlet.totalVotes = Math.max(0, outlet.totalVotes - contestant.votes);
        }
        for (const [key, v] of this.votes.entries()) {
          if (v.contestantId === id) {
            this.votes.delete(key);
          }
        }
        this.contestants.delete(id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.auditLogs.unshift({
        id: `audit_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'CONTESTANT_DELETED',
        outletCode: normalized,
        actor,
        details: `Bulk deleted ${deletedCount} contestant(s) by ${actor}.`,
      });
      this.saveToDisk();
      this.notify(normalized);
    }

    const remaining = this.getContestants(normalized, true).length;
    return { deletedCount, remainingCount: remaining };
  }

  public resetOutlet(outletCode: OutletCode, actor: string): { success: boolean; outlet: Outlet } {
    const normalized = this.normalizeOutletCode(outletCode);
    const outlet = this.outlets.get(normalized);
    if (!outlet) {
      throw new Error(`Outlet ${normalized} not found.`);
    }

    // 1. Remove all contestants belonging to this outlet
    for (const [id, c] of this.contestants.entries()) {
      if (c.outletCode === normalized) {
        this.contestants.delete(id);
      }
    }

    // 2. Remove all vote records for this outlet
    for (const [key, v] of this.votes.entries()) {
      if (v.outletCode === normalized) {
        this.votes.delete(key);
      }
    }

    // 3. Clear bound outlets for this outlet
    for (const [voterHash, boundCode] of this.boundOutlets.entries()) {
      if (boundCode === normalized) {
        this.boundOutlets.delete(voterHash);
      }
    }

    // 4. Reset outlet totalVotes to 0
    outlet.totalVotes = 0;

    this.auditLogs.unshift({
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'RESET_DEMO',
      outletCode: normalized,
      actor,
      details: `Reset outlet ${normalized} (${outlet.name}) to 0 contestants and 0 votes by ${actor}.`,
    });

    this.saveToDisk();
    this.notify(normalized);

    return { success: true, outlet };
  }

  // Helper to retrieve existing vote for an outlet category
  public getVoteForOutlet(voterHash: string, outletCode: OutletCode): VoteRecord | undefined {
    const normalized = this.normalizeOutletCode(outletCode);
    const voteKey = `${EVENT_ID}:${normalized}:${voterHash}`;
    const direct = this.votes.get(voteKey);
    if (direct) return direct;

    for (const v of this.votes.values()) {
      if (v.voterHash === voterHash && this.normalizeOutletCode(v.outletCode) === normalized) {
        return v;
      }
    }
    return undefined;
  }

  // Voting Status check: supports outlet-scoped status
  public getVoterStatus(
    voterId: string,
    outletCode?: OutletCode
  ): {
    hasVoted: boolean;
    voteRecord?: VoteRecord;
    contestant?: Contestant;
    boundOutlet?: OutletCode;
    votesByOutlet: {
      BOHO: { hasVoted: boolean; contestant?: Contestant; voteRecord?: VoteRecord };
      BOALL: { hasVoted: boolean; contestant?: Contestant; voteRecord?: VoteRecord };
    };
  } {
    const emptyVotes = {
      BOHO: { hasVoted: false },
      BOALL: { hasVoted: false },
    };

    if (!voterId) {
      return {
        hasVoted: false,
        votesByOutlet: emptyVotes,
      };
    }

    const voterHash = this.hashVoterIdentity(voterId);
    const bohoVote = this.getVoteForOutlet(voterHash, 'BOHO');
    const boallVote = this.getVoteForOutlet(voterHash, 'BOALL');

    const bohoContestant = bohoVote ? this.contestants.get(bohoVote.contestantId) : undefined;
    const boallContestant = boallVote ? this.contestants.get(boallVote.contestantId) : undefined;

    const votesByOutlet = {
      BOHO: {
        hasVoted: !!bohoVote,
        contestant: bohoContestant,
        voteRecord: bohoVote,
      },
      BOALL: {
        hasVoted: !!boallVote,
        contestant: boallContestant,
        voteRecord: boallVote,
      },
    };

    if (outletCode) {
      const normalized = this.normalizeOutletCode(outletCode);
      const isBoho = normalized === 'BOHO';
      const targetVote = isBoho ? bohoVote : boallVote;
      const targetContestant = isBoho ? bohoContestant : boallContestant;

      return {
        hasVoted: !!targetVote,
        voteRecord: targetVote,
        contestant: targetContestant,
        boundOutlet: undefined,
        votesByOutlet,
      };
    }

    const latestVote = bohoVote || boallVote;
    const latestContestant = latestVote ? this.contestants.get(latestVote.contestantId) : undefined;

    return {
      hasVoted: !!latestVote,
      voteRecord: latestVote,
      contestant: latestContestant,
      boundOutlet: undefined,
      votesByOutlet,
    };
  }

  // Rate Limiter: check anti-burst (max 5 requests per 10s per voter)
  private checkRateLimit(voterHash: string): boolean {
    const now = Date.now();
    const existing = this.rateLimitMap.get(voterHash);
    if (!existing || now > existing.resetAt) {
      this.rateLimitMap.set(voterHash, { count: 1, resetAt: now + 10000 });
      return true;
    }
    if (existing.count >= 5) {
      return false;
    }
    existing.count += 1;
    return true;
  }

  // Atomic Vote Cast: Allows 1 vote in Head Office and 1 vote in Black Owl All Outlet per device
  public async castVote(params: {
    voterId: string;
    outletCode: OutletCode;
    contestantId: string;
    userAgent?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    code?: string;
    contestant?: Contestant;
    outlet?: Outlet;
  }> {
    // Chain onto mutex to guarantee strict atomic serialization against race conditions
    return new Promise((resolve) => {
      this.mutexChain = this.mutexChain.then(async () => {
        try {
          const { voterId, outletCode, contestantId } = params;
          const normalized = this.normalizeOutletCode(outletCode);

          if (!voterId || voterId.trim().length < 8) {
            return resolve({
              success: false,
              error: 'Invalid or missing voting session identity.',
              code: 'INVALID_SESSION',
            });
          }

          const voterHash = this.hashVoterIdentity(voterId);

          // 1. Check Rate Limit
          if (!this.checkRateLimit(voterHash)) {
            return resolve({
              success: false,
              error: 'Too many requests. Please wait a moment.',
              code: 'RATE_LIMITED',
            });
          }

          // 2. Check Outlet
          const outlet = this.outlets.get(normalized);
          if (!outlet) {
            return resolve({
              success: false,
              error: 'Invalid venue outlet code.',
              code: 'OUTLET_NOT_FOUND',
            });
          }

          // 3. Check Voting Open Status
          if (!outlet.votingActive) {
            return resolve({
              success: false,
              error: `Voting is currently closed for ${outlet.name}.`,
              code: 'VOTING_CLOSED',
            });
          }

          // 4. Duplicate Check: has voter already voted in THIS outlet category?
          const existingVote = this.getVoteForOutlet(voterHash, normalized);
          if (existingVote) {
            const existingContestant = this.contestants.get(existingVote.contestantId);
            const outletName = outlet.name;
            const otherCategory = normalized === 'BOHO' ? 'Black Owl All Outlet' : 'Black Owl Head Office';
            return resolve({
              success: false,
              error: `Anda sudah memberikan 1 vote di ${outletName}${
                existingContestant ? ` untuk ${existingContestant.numberDisplay} - ${existingContestant.name}` : ''
              }. Anda masih dapat memberikan 1 vote di kategori ${otherCategory}.`,
              code: 'DUPLICATE_VOTE',
              contestant: existingContestant,
            });
          }

          // 5. Contestant Check
          const contestant = this.contestants.get(contestantId);
          if (!contestant) {
            return resolve({
              success: false,
              error: 'Contestant not found.',
              code: 'CONTESTANT_NOT_FOUND',
            });
          }

          if (contestant.outletCode !== normalized) {
            return resolve({
              success: false,
              error: 'Contestant does not belong to this outlet.',
              code: 'OUTLET_MISMATCH',
            });
          }

          if (!contestant.isActive) {
            return resolve({
              success: false,
              error: 'Contestant is not currently active for voting.',
              code: 'CONTESTANT_INACTIVE',
            });
          }

          // 6. Record Vote Record with category-specific key
          const voteKey = `${EVENT_ID}:${normalized}:${voterHash}`;
          const voteRecord: VoteRecord = {
            id: `v_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            eventId: EVENT_ID,
            voterHash,
            outletCode: normalized,
            contestantId,
            timestamp: new Date().toISOString(),
          };

          this.votes.set(voteKey, voteRecord);
          this.boundOutlets.set(voterHash, normalized);

          // Increment vote counts atomically
          contestant.votes += 1;
          outlet.totalVotes += 1;

          this.auditLogs.unshift({
            id: `audit_${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'VOTE_CAST',
            outletCode: normalized,
            actor: `VOTER_${voterHash.substring(0, 8)}`,
            details: `Cast 1 vote in ${outlet.shortName || outlet.name} for ${contestant.numberDisplay} - ${contestant.name}.`,
          });

          this.saveToDisk();

          // Notify real-time listeners for this outlet
          this.notify(normalized);

          return resolve({
            success: true,
            contestant,
            outlet,
          });
        } catch (err) {
          console.error('Error during atomic vote cast:', err);
          return resolve({
            success: false,
            error: 'Internal server error while processing vote.',
            code: 'SERVER_ERROR',
          });
        }
      });
    });
  }

  // Audit Logs
  public getAuditLogs(outletCode?: OutletCode, limit = 50): AuditLogEntry[] {
    if (!outletCode) {
      return this.auditLogs.slice(0, limit);
    }
    const normalized = this.normalizeOutletCode(outletCode);
    return this.auditLogs.filter((log) => log.outletCode === normalized).slice(0, limit);
  }
}

// Singleton instance for server
export const votingEngine = new VotingEngine();
