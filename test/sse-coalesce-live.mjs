/**
 * Live verification of SSE coalesce under a burst of VotingEngine notifies.
 * Uses in-memory engine + mini Express SSE (mirrors server.ts coalesce).
 */
import express from 'express';
import { VotingEngine } from '../src/server/votingEngine.ts';

const SSE_COALESCE_MS = 750;
const BURST = 200;

const engine = new VotingEngine({ inMemory: true });
const app = express();

const sseClients = new Set();
const pendingSseFlush = new Map();

const flushSseUpdate = (outletCode) => {
  pendingSseFlush.delete(outletCode);
  if (sseClients.size === 0) return;
  const payload = JSON.stringify({
    type: 'UPDATE',
    outletCode,
    timestamp: Date.now(),
  });
  for (const client of sseClients) {
    client.write(`data: ${payload}\n\n`);
  }
};

engine.subscribe((outletCode) => {
  if (pendingSseFlush.has(outletCode)) return;
  pendingSseFlush.set(
    outletCode,
    setTimeout(() => flushSseUpdate(outletCode), SSE_COALESCE_MS)
  );
});

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`);
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

const server = app.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();
  const updates = [];

  const res = await fetch(`http://127.0.0.1:${port}/events`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const readLoop = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const line = part.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'UPDATE') updates.push(data);
        } catch {}
      }
    }
  })();

  // Wait for CONNECTED
  await new Promise((r) => setTimeout(r, 100));

  const contestants = engine.getContestants('BOHO', true);
  if (contestants.length === 0) {
    console.error('FAIL: no contestants for BOHO in seed');
    process.exit(1);
  }
  const contestantId = contestants[0].id;

  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: BURST }, (_, i) =>
      engine.castVote({
        voterId: `verify-voter-${i}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        outletCode: 'BOHO',
        contestantId,
      })
    )
  );
  const voteMs = Date.now() - t0;

  // Wait for coalesce window + margin
  await new Promise((r) => setTimeout(r, SSE_COALESCE_MS + 300));

  reader.cancel().catch(() => {});
  await readLoop.catch(() => {});
  server.close();

  const updateCount = updates.length;
  const maxExpected = Math.ceil(voteMs / SSE_COALESCE_MS) + 2;

  console.log(
    JSON.stringify(
      {
        burstVotes: BURST,
        voteMs,
        sseUpdates: updateCount,
        maxExpected,
        pass: updateCount > 0 && updateCount <= maxExpected && updateCount < BURST / 10,
      },
      null,
      2
    )
  );

  if (!(updateCount > 0 && updateCount <= maxExpected && updateCount < BURST / 10)) {
    process.exit(1);
  }
});
