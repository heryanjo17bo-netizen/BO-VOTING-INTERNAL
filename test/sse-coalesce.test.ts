import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors server.ts SSE coalesce: at most one flush per outlet per window.
 */
function createCoalescer(windowMs: number, flush: (outletCode: string) => void) {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    notify(outletCode: string) {
      if (pending.has(outletCode)) return;
      pending.set(
        outletCode,
        setTimeout(() => {
          pending.delete(outletCode);
          flush(outletCode);
        }, windowMs)
      );
    },
    clear() {
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
    },
  };
}

/**
 * Mirrors subscribeToOutletEvents UPDATE debounce.
 */
function createDebouncer(delayMs: number, onUpdate: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  return {
    onUpdateEvent() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (!disposed) onUpdate();
      }, delayMs);
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

test('SSE coalesce: 200 rapid notifies within window produce one flush', async () => {
  const flushes: string[] = [];
  const coalescer = createCoalescer(50, (code) => flushes.push(code));

  for (let i = 0; i < 200; i++) {
    coalescer.notify('BOHO');
  }

  await new Promise((r) => setTimeout(r, 80));
  assert.equal(flushes.length, 1);
  assert.equal(flushes[0], 'BOHO');
  coalescer.clear();
});

test('SSE coalesce: separate outlets flush independently', async () => {
  const flushes: string[] = [];
  const coalescer = createCoalescer(40, (code) => flushes.push(code));

  coalescer.notify('BOHO');
  coalescer.notify('BOALL');
  for (let i = 0; i < 50; i++) {
    coalescer.notify('BOHO');
    coalescer.notify('BOALL');
  }

  await new Promise((r) => setTimeout(r, 70));
  assert.equal(flushes.length, 2);
  assert.ok(flushes.includes('BOHO'));
  assert.ok(flushes.includes('BOALL'));
  coalescer.clear();
});

test('Client debounce: burst of UPDATE events triggers one onUpdate', async () => {
  let calls = 0;
  const debouncer = createDebouncer(40, () => {
    calls += 1;
  });

  for (let i = 0; i < 200; i++) {
    debouncer.onUpdateEvent();
  }

  await new Promise((r) => setTimeout(r, 70));
  assert.equal(calls, 1);
  debouncer.dispose();
});

test('Client debounce: dispose prevents late onUpdate', async () => {
  let calls = 0;
  const debouncer = createDebouncer(30, () => {
    calls += 1;
  });

  debouncer.onUpdateEvent();
  debouncer.dispose();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(calls, 0);
});
