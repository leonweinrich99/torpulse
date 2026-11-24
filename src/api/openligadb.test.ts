import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearApiCache, getApiTelemetry, openLigaApi } from './openligadb';

describe('openLigaApi client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearApiCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('caches repeated requests and deduplicates concurrent in-flight requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ sportId: 1, sportName: 'Fußball' }]),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const [a, b] = await Promise.all([
      openLigaApi.getAvailableSports(),
      openLigaApi.getAvailableSports(),
    ]);
    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Subsequent call hits cache
    const c = await openLigaApi.getAvailableSports();
    expect(c[0].sportName).toBe('Fußball');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const tel = getApiTelemetry();
    expect(tel.memoryCacheEntries).toBeGreaterThanOrEqual(1);
  });

  it('falls back to stale cache when network fails offline', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify([{ id: 1, name: 'Halbzeit', kind: 'HalfTime' }]),
      })
      .mockRejectedValueOnce(new Error('Network offline'));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const initial = await openLigaApi.getResultTypes();
    expect(initial).toHaveLength(1);

    const fallback = await openLigaApi.getResultTypes();
    expect(fallback).toEqual(initial);
  });
});
