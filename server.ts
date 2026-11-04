import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import {
  votingEngine,
  INITIAL_OUTLETS,
  STAFF_USERS,
  verifyStaffAccess,
  addStaffUser,
  removeStaffUser,
  updateStaffPin,
  getStaffUsersList,
} from './src/server/votingEngine.ts';
import type { OutletCode } from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3001', 10);
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'black-owl-halloween-signed-secret-2026';
const RAW_BASE = process.env.BASE_PATH ?? '/headoffice';
const BASE_PATH = RAW_BASE === '/' ? '' : RAW_BASE.replace(/\/$/, '');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure Multer for secure photo uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, and AVIF images are allowed'));
    }
  },
});

async function startServer() {
  const app = express();

  // Strip mount path so /headoffice/api/... is handled as /api/...
  if (BASE_PATH) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (req.url === BASE_PATH || req.url.startsWith(`${BASE_PATH}/`)) {
        req.url = req.url.slice(BASE_PATH.length) || '/';
      } else if (req.url.startsWith(`${BASE_PATH}?`)) {
        req.url = req.url.slice(BASE_PATH.length);
      }
      next();
    });
  }

  // Basic security headers and JSON parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(COOKIE_SECRET));

  // Serve uploaded images statically
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Cookie + Device Header middleware for persistent HP guest voting identity
  const ensureVoterIdentity = (req: Request, res: Response, next: NextFunction) => {
    const headerId = (req.headers['x-voter-id'] as string)?.trim();
    let voterId = (headerId && headerId.length >= 8) ? headerId : req.signedCookies?.bo_voter_id;

    if (!voterId) {
      voterId = `bo_hp_${crypto.randomUUID()}`;
    }

    // Set signed HttpOnly SameSite cookie
    res.cookie('bo_voter_id', voterId, {
      httpOnly: true,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'lax',
      signed: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: BASE_PATH || '/',
    });
    res.setHeader('x-voter-id', voterId);
    (req as any).voterId = voterId;
    next();
  };

  // Helper middleware to verify admin role
  const checkAdminAccess = (getOutlet?: (req: Request) => OutletCode | undefined) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const email =
        (req.headers['x-staff-email'] as string) ||
        (req.query.staffEmail as string) ||
        req.body?.staffEmail;

      if (!email) {
        res.status(401).json({ error: 'Unauthorized: Staff authentication required. Please sign in.' });
        return;
      }

      const targetOutlet = getOutlet ? getOutlet(req) : undefined;
      const auth = verifyStaffAccess(email, targetOutlet);

      if (!auth.ok) {
        res.status(auth.status).json({ error: auth.message });
        return;
      }
      (req as any).staffUser = auth.user;
      next();
    };
  };

  // SSE Clients tracking per outlet
  const sseClients: Map<OutletCode, Set<Response>> = new Map();
  const allCodes: OutletCode[] = ['BOHO', 'BOALL', 'BOPIK', 'BOKG', 'BOGS', 'BOSCBD', 'BOSBY', 'BOMDN'];
  for (const code of allCodes) {
    sseClients.set(code, new Set());
  }

  // Coalesce SSE UPDATE broadcasts: at most one per outlet every 750ms
  const SSE_COALESCE_MS = 750;
  const pendingSseFlush: Map<OutletCode, ReturnType<typeof setTimeout>> = new Map();

  const flushSseUpdate = (outletCode: OutletCode) => {
    pendingSseFlush.delete(outletCode);
    // BOALL updates also fan out to branch outlet SSE rooms
    const notifyCodes: OutletCode[] =
      outletCode === 'BOALL'
        ? ['BOALL', 'BOPIK', 'BOKG', 'BOGS', 'BOSCBD', 'BOSBY', 'BOMDN']
        : [outletCode];

    const payload = JSON.stringify({
      type: 'UPDATE',
      outletCode,
      timestamp: Date.now(),
    });

    for (const code of notifyCodes) {
      const clients = sseClients.get(code);
      if (!clients || clients.size === 0) continue;
      for (const client of clients) {
        client.write(`data: ${payload}\n\n`);
      }
    }
  };

  // Subscribe to VotingEngine updates to push SSE events
  votingEngine.subscribe((outletCode) => {
    if (pendingSseFlush.has(outletCode)) return;
    pendingSseFlush.set(
      outletCode,
      setTimeout(() => flushSseUpdate(outletCode), SSE_COALESCE_MS)
    );
  });

  // --- API ROUTES ---

  // 1. Session check & Voter Status
  app.get('/api/session', ensureVoterIdentity, (req: Request, res: Response) => {
    const voterId = (req as any).voterId;
    const targetOutlet = req.query.outlet ? (String(req.query.outlet).toUpperCase() as OutletCode) : undefined;
    const status = votingEngine.getVoterStatus(voterId, targetOutlet);
    res.json({
      voterId: voterId.substring(0, 16) + '...', // Masked for privacy
      hasVoted: status.hasVoted,
      votesByOutlet: status.votesByOutlet,
      boundOutlet: status.boundOutlet || null,
      voteRecord: status.voteRecord
        ? {
            outletCode: status.voteRecord.outletCode,
            contestantId: status.voteRecord.contestantId,
            timestamp: status.voteRecord.timestamp,
          }
        : null,
      contestant: status.contestant
        ? {
            id: status.contestant.id,
            name: status.contestant.name,
            numberDisplay: status.contestant.numberDisplay,
            costume: status.contestant.costume,
          }
        : null,
    });
  });

  // 2. All Outlets overview
  app.get('/api/outlets', (_req: Request, res: Response) => {
    res.json(votingEngine.getOutlets());
  });

  // 3. Single Outlet details & contestants (Guest Route)
  app.get('/api/outlets/:outletCode', ensureVoterIdentity, (req: Request, res: Response) => {
    const code = req.params.outletCode?.toUpperCase() as OutletCode;
    const outlet = votingEngine.getOutlet(code);
    if (!outlet) {
      res.status(404).json({ error: 'Outlet not found' });
      return;
    }

    const voterId = (req as any).voterId;

    // Get status specific to THIS outlet (BOHO or BOALL)
    const voterStatus = votingEngine.getVoterStatus(voterId, code);
    // Sanitize and exclude private fields (e.g. phoneNumber) for public guest ballot
    const contestants = votingEngine.getContestants(code, false, false);

    res.json({
      outlet,
      contestants,
      voterStatus: {
        hasVoted: voterStatus.hasVoted,
        votedContestantId: voterStatus.voteRecord?.contestantId,
        votedOutletCode: voterStatus.voteRecord?.outletCode,
        contestant: voterStatus.contestant,
        votesByOutlet: voterStatus.votesByOutlet,
      },
    });
  });

  // 4. Outlet Leaderboard (Public read-only)
  app.get('/api/leaderboard/:outletCode', (req: Request, res: Response) => {
    const code = req.params.outletCode?.toUpperCase() as OutletCode;
    const outlet = votingEngine.getOutlet(code);
    if (!outlet) {
      res.status(404).json({ error: 'Outlet not found' });
      return;
    }

    const leaderboard = votingEngine.getLeaderboard(code);
    res.json({
      outlet,
      leaderboard,
      totalVotes: outlet.totalVotes,
      lastUpdated: new Date().toISOString(),
    });
  });

  // 5. Cast Vote
  app.post('/api/vote', ensureVoterIdentity, async (req: Request, res: Response) => {
    const voterId = (req as any).voterId;
    const { outletCode, contestantId } = req.body;

    if (!outletCode || !contestantId) {
      res.status(400).json({ error: 'Missing outletCode or contestantId' });
      return;
    }

    const code = String(outletCode).toUpperCase() as OutletCode;
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await votingEngine.castVote({
      voterId,
      outletCode: code,
      contestantId: String(contestantId),
      userAgent,
    });

    if (!result.success) {
      res.status(400).json({
        error: result.error,
        code: result.code,
        existingContestant: result.contestant,
      });
      return;
    }

    const status = votingEngine.getVoterStatus(voterId);

    res.json({
      success: true,
      message: 'Vote successfully recorded!',
      contestant: result.contestant,
      outlet: result.outlet,
      votesByOutlet: status.votesByOutlet,
    });
  });

  // 6. Real-time Server-Sent Events (SSE) Stream
  app.get('/api/events/:outletCode', (req: Request, res: Response) => {
    const code = req.params.outletCode?.toUpperCase() as OutletCode;
    if (!votingEngine.getOutlet(code)) {
      res.status(404).end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for NGINX/Cloud Run
    res.flushHeaders();

    // Send initial handshake
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', outletCode: code })}\n\n`);

    const clients = sseClients.get(code);
    if (clients) {
      clients.add(res);
    }

    // Keep-alive ping every 25s
    const pingInterval = setInterval(() => {
      res.write(': ping\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(pingInterval);
      if (clients) {
        clients.delete(res);
      }
    });
  });

  // 7. Photo Upload Endpoint
  app.post('/api/upload', upload.single('photo'), (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No photo uploaded or unsupported file format' });
      return;
    }
    const publicUrl = `${BASE_PATH}/uploads/${req.file.filename}`;
    res.json({
      success: true,
      imageUrl: publicUrl,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  });

  // 8. Staff / Admin Endpoints with Role Checks
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const { email, pin } = req.body || {};
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Staff email is required.' });
      return;
    }
    const normalized = email.toLowerCase().trim();
    const staff = STAFF_USERS[normalized];
    if (!staff) {
      res.status(403).json({
        error: `Email "${normalized}" is not on the authorized Black Owl staff allowlist. Access denied.`,
      });
      return;
    }

    // Security PIN / Password check:
    // If a staff user has a personalized PIN configured, verify against it.
    // Otherwise fallback to standard default '2026' or master system PIN.
    const enteredPin = pin ? String(pin).trim() : '';
    const masterPins = ['BLACKOWL2026', process.env.ADMIN_PIN].filter(Boolean) as string[];

    let isPinValid = false;
    if (staff.pin && staff.pin.trim().length > 0) {
      isPinValid = enteredPin === staff.pin.trim() || masterPins.includes(enteredPin);
    } else {
      const validPins = ['2026', ...masterPins];
      isPinValid = validPins.includes(enteredPin);
    }

    if (!isPinValid) {
      res.status(401).json({ error: 'Incorrect Security PIN / Password.' });
      return;
    }

    res.json({
      success: true,
      user: staff,
      message: `Signed in successfully as ${staff.name}`,
    });
  });

  app.get('/api/admin/staff', (_req: Request, res: Response) => {
    res.json({
      allowedStaff: getStaffUsersList(),
      superAdminEmail: 'heryanjojo@gmail.com',
    });
  });

  // Add new staff / admin (Super Admin only)
  app.post(
    '/api/admin/staff',
    checkAdminAccess(),
    (req: Request, res: Response) => {
      const staffUser = (req as any).staffUser;
      if (staffUser?.role !== 'SUPER_ADMIN') {
        res.status(403).json({ error: 'Only Super Admins can add authorized staff.' });
        return;
      }

      const { email, name, role, assignedOutlet, pin } = req.body || {};
      if (!email || !email.includes('@')) {
        res.status(400).json({ error: 'Valid email is required.' });
        return;
      }

      if (!name || name.trim().length === 0) {
        res.status(400).json({ error: 'Staff name is required.' });
        return;
      }

      if (role !== 'SUPER_ADMIN' && role !== 'OUTLET_ADMIN') {
        res.status(400).json({ error: 'Role must be SUPER_ADMIN or OUTLET_ADMIN.' });
        return;
      }

      if (role === 'OUTLET_ADMIN' && (!assignedOutlet || !INITIAL_OUTLETS[assignedOutlet as OutletCode])) {
        res.status(400).json({ error: 'Valid assignedOutlet is required for Outlet Admin.' });
        return;
      }

      const customPin = pin && typeof pin === 'string' && pin.trim().length > 0 ? pin.trim() : undefined;

      const newStaff = addStaffUser({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        role,
        assignedOutlet: role === 'OUTLET_ADMIN' ? (assignedOutlet as OutletCode) : undefined,
        pin: customPin,
      });

      votingEngine.persist();

      res.json({
        success: true,
        staff: newStaff,
        allowedStaff: getStaffUsersList(),
      });
    }
  );

  // Update staff PIN / password (Super Admin only)
  app.patch(
    '/api/admin/staff/:email/pin',
    checkAdminAccess(),
    (req: Request, res: Response) => {
      const staffUser = (req as any).staffUser;
      if (staffUser?.role !== 'SUPER_ADMIN') {
        res.status(403).json({ error: 'Only Super Admins can update staff PINs.' });
        return;
      }

      const targetEmail = req.params.email;
      if (!targetEmail) {
        res.status(400).json({ error: 'Staff email parameter is required.' });
        return;
      }

      const { pin } = req.body || {};
      const updated = updateStaffPin(targetEmail, pin);
      if (!updated) {
        res.status(404).json({ error: `Staff user ${targetEmail} not found.` });
        return;
      }

      votingEngine.persist();

      res.json({
        success: true,
        staff: updated,
        allowedStaff: getStaffUsersList(),
      });
    }
  );

  // Remove staff (Super Admin only)
  app.delete(
    '/api/admin/staff/:email',
    checkAdminAccess(),
    (req: Request, res: Response) => {
      const staffUser = (req as any).staffUser;
      if (staffUser?.role !== 'SUPER_ADMIN') {
        res.status(403).json({ error: 'Only Super Admins can remove authorized staff.' });
        return;
      }

      const targetEmail = req.params.email;
      if (targetEmail.toLowerCase() === 'heryanjojo@gmail.com') {
        res.status(400).json({ error: 'Primary owner cannot be removed.' });
        return;
      }

      const success = removeStaffUser(targetEmail);
      if (!success) {
        res.status(404).json({ error: 'Staff member not found.' });
        return;
      }

      votingEngine.persist();

      res.json({
        success: true,
        allowedStaff: getStaffUsersList(),
      });
    }
  );

  // Get full admin contestants list (including hidden) - role checked
  app.get(
    '/api/admin/contestants/:outletCode',
    checkAdminAccess((req) => req.params.outletCode?.toUpperCase() as OutletCode),
    (req: Request, res: Response) => {
      const code = req.params.outletCode?.toUpperCase() as OutletCode;
      const outlet = votingEngine.getOutlet(code);
      if (!outlet) {
        res.status(404).json({ error: 'Outlet not found' });
        return;
      }

      const contestants = votingEngine.getContestants(code, true, true);
      res.json({
        outlet,
        contestants,
        nextNumber: votingEngine.getNextContestantNumber(code),
      });
    }
  );

  // Add Contestant - role checked
  app.post(
    '/api/admin/contestants',
    checkAdminAccess((req) => req.body.outletCode?.toUpperCase() as OutletCode),
    (req: Request, res: Response) => {
      const { outletCode, name, costume, instagram, phoneNumber, description, imageUrl, hasConsented, actor } = req.body;
      const igHandle = (instagram || costume || '').trim();
      if (!outletCode || !name || !igHandle || !imageUrl) {
        res.status(400).json({ error: 'outletCode, name, instagram handle (@...), and imageUrl are required.' });
        return;
      }

      const code = String(outletCode).toUpperCase() as OutletCode;
      const newContestant = votingEngine.addContestant({
        outletCode: code,
        name,
        costume: igHandle,
        instagram: igHandle,
        phoneNumber: phoneNumber ? String(phoneNumber).trim() : undefined,
        description,
        imageUrl,
        hasConsented: Boolean(hasConsented),
        actor: actor || 'Staff Admin',
      });

      res.json({ success: true, contestant: newContestant });
    }
  );

  // Update Contestant - role checked
  app.put(
    '/api/admin/contestants/:id',
    (req: Request, res: Response, next: NextFunction) => {
      const contestant = votingEngine.getContestantById(req.params.id);
      if (!contestant) {
        res.status(404).json({ error: 'Contestant not found' });
        return;
      }
      const middleware = checkAdminAccess(() => contestant.outletCode);
      middleware(req, res, next);
    },
    (req: Request, res: Response) => {
      const { id } = req.params;
      const { name, costume, instagram, phoneNumber, description, imageUrl, isActive, actor } = req.body;

      const updated = votingEngine.updateContestant(
        id,
        { name, costume, instagram, phoneNumber, description, imageUrl, isActive },
        actor || 'Staff Admin'
      );

      res.json({ success: true, contestant: updated });
    }
  );

  // Toggle Hide/Unhide Contestant - role checked
  app.post(
    '/api/admin/contestants/:id/toggle-hide',
    (req: Request, res: Response, next: NextFunction) => {
      const contestant = votingEngine.getContestantById(req.params.id);
      if (!contestant) {
        res.status(404).json({ error: 'Contestant not found' });
        return;
      }
      const middleware = checkAdminAccess(() => contestant.outletCode);
      middleware(req, res, next);
    },
    (req: Request, res: Response) => {
      const { id } = req.params;
      const { actor } = req.body;

      const toggled = votingEngine.toggleHideContestant(id, actor || 'Staff Admin');
      res.json({ success: true, contestant: toggled });
    }
  );

  // Delete Contestant - role checked
  app.delete(
    '/api/admin/contestants/:id',
    (req: Request, res: Response, next: NextFunction) => {
      const contestant = votingEngine.getContestantById(req.params.id);
      if (!contestant) {
        res.status(404).json({ error: 'Contestant not found' });
        return;
      }
      const middleware = checkAdminAccess(() => contestant.outletCode);
      middleware(req, res, next);
    },
    (req: Request, res: Response) => {
      const { id } = req.params;
      const { actor } = req.body;

      votingEngine.deleteContestant(id, actor || 'Staff Admin');
      res.json({ success: true, message: 'Contestant deleted and audit log recorded' });
    }
  );

  // Toggle Outlet Voting Active Status - role checked
  app.post(
    '/api/admin/outlets/:outletCode/voting-status',
    checkAdminAccess((req) => req.params.outletCode?.toUpperCase() as OutletCode),
    (req: Request, res: Response) => {
      const code = req.params.outletCode?.toUpperCase() as OutletCode;
      const { active, actor } = req.body;

      const success = votingEngine.setOutletVotingStatus(code, Boolean(active), actor || 'Staff Admin');
      if (!success) {
        res.status(404).json({ error: 'Outlet not found' });
        return;
      }

      res.json({ success: true, outlet: votingEngine.getOutlet(code) });
    }
  );

  // Get Audit Logs - role checked
  app.get(
    '/api/admin/audit-logs',
    checkAdminAccess((req) => (req.query.outletCode as string)?.toUpperCase() as OutletCode),
    (req: Request, res: Response) => {
      const outletCode = req.query.outletCode as OutletCode | undefined;
      const logs = votingEngine.getAuditLogs(outletCode);
      res.json(logs);
    }
  );

  // Bulk Delete Contestants - role checked
  app.post(
    '/api/admin/contestants/bulk-delete',
    checkAdminAccess((req) => req.body.outletCode?.toUpperCase() as OutletCode),
    (req: Request, res: Response) => {
      const { ids, outletCode, actor } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0 || !outletCode) {
        res.status(400).json({ error: 'ids array and outletCode are required.' });
        return;
      }
      const code = String(outletCode).toUpperCase() as OutletCode;
      const result = votingEngine.deleteMultipleContestants(ids, code, actor || 'Staff Admin');
      res.json({
        success: true,
        deletedCount: result.deletedCount,
        remainingCount: result.remainingCount,
        message: `Successfully deleted ${result.deletedCount} contestant(s).`,
      });
    }
  );

  // Reset a specific outlet to 0 contestants and 0 votes - role checked
  app.post(
    '/api/admin/outlets/:outletCode/reset',
    checkAdminAccess((req) => req.params.outletCode?.toUpperCase() as OutletCode),
    (req: Request, res: Response) => {
      const code = req.params.outletCode?.toUpperCase() as OutletCode;
      const { actor } = req.body || {};
      try {
        const result = votingEngine.resetOutlet(code, actor || 'Staff Admin');
        res.json({
          success: true,
          outlet: result.outlet,
          message: `Outlet ${code} has been completely reset to 0 contestants and 0 votes.`,
        });
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Failed to reset outlet' });
      }
    }
  );

  // --- VITE MIDDLEWARE / STATIC ASSETS ---
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[Black Owl Head Office Voting] Server running on http://0.0.0.0:${PORT}${BASE_PATH || '/'}`
    );
  });
}

startServer().catch((err) => {
  console.error('Fatal server boot error:', err);
  process.exit(1);
});
