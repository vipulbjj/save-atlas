import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockAuthenticatedClient, createSavesTableMock } from './helpers/mock-supabase.js';

const { mockSupabaseClient } = vi.hoisted(() => ({
  mockSupabaseClient: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
}));

import { POST as importPost, OPTIONS as importOptions } from '@/app/api/import/route.js';

describe('API: POST /api/import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('no session'),
    });

    const req = new Request('http://localhost/api/import', {
      method: 'POST',
      body: JSON.stringify({
        saves: [{ shortcode: 'abc', permalink: 'https://instagram.com/p/abc/', timestamp: new Date().toISOString() }],
      }),
    });

    const res = await importPost(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when saves array is empty', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    });

    const req = new Request('http://localhost/api/import', {
      method: 'POST',
      body: JSON.stringify({ saves: [] }),
    });

    const res = await importPost(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no saves/i);
  });

  it('inserts new saves and reports counts', async () => {
    const client = mockAuthenticatedClient({
      savesTable: createSavesTableMock({ existingIds: [], insertRows: [{ id: '1' }, { id: '2' }] }),
    });
    mockSupabaseClient.auth.getUser.mockImplementation(client.auth.getUser);
    mockSupabaseClient.from.mockImplementation(client.from);

    const req = new Request('http://localhost/api/import', {
      method: 'POST',
      body: JSON.stringify({
        saves: [
          {
            shortcode: 'sc1',
            permalink: 'https://www.instagram.com/p/sc1/',
            caption: 'Modern villa #architecture',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
          {
            shortcode: 'sc2',
            permalink: 'https://www.instagram.com/reel/sc2/',
            caption: 'AI startup tips',
            timestamp: '2024-01-02T00:00:00.000Z',
          },
        ],
      }),
    });

    const res = await importPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.imported).toBe(2);
  });

  it('OPTIONS returns CORS headers', async () => {
    const res = await importOptions();
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
