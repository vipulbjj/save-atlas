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

import { POST as syncPost, OPTIONS as syncOptions } from '@/app/api/saves/sync/route.js';

describe('API: POST /api/saves/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for extension payload without session', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('no session'),
    });

    const req = new Request('http://localhost/api/saves/sync', {
      method: 'POST',
      body: JSON.stringify({
        saves: [{ instagram_id: '999', permalink: 'https://instagram.com/p/x/', caption: 'test' }],
      }),
    });

    const res = await syncPost(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/log in/i);
  });

  it('inserts extension saves when authenticated', async () => {
    const client = mockAuthenticatedClient({
      savesTable: createSavesTableMock({ existingIds: [], insertRows: [{ id: 'ext1' }] }),
    });
    mockSupabaseClient.auth.getUser.mockImplementation(client.auth.getUser);
    mockSupabaseClient.from.mockImplementation(client.from);

    const req = new Request('http://localhost/api/saves/sync', {
      method: 'POST',
      body: JSON.stringify({
        saves: [
          {
            instagram_id: 'ext_42',
            permalink: 'https://www.instagram.com/p/ext_42/',
            caption: 'Founder advice #startup',
            media_type: 'IMAGE',
            timestamp: '2024-06-01T12:00:00.000Z',
          },
        ],
      }),
    });

    const res = await syncPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.imported).toBe(1);
  });

  it('runs backfill when body has no saves', async () => {
    const unprocessed = [
      { id: 's1', caption: 'test', hashtags: [], ai_processed: false },
    ];

    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user_123', email: 'test@saveatlas.com' } },
      error: null,
    });

    mockSupabaseClient.from.mockImplementation((table) => {
      if (table === 'users') {
        return { upsert: vi.fn(() => Promise.resolve({ error: null })) };
      }
      if (table === 'saves') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: unprocessed, error: null })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        };
      }
      return {};
    });

    const req = new Request('http://localhost/api/saves/sync', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await syncPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.fixed).toBe('number');
  });

  it('OPTIONS returns CORS headers', async () => {
    const res = await syncOptions();
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});
