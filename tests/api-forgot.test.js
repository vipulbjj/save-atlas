import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabaseClient } = vi.hoisted(() => ({
  mockSupabaseClient: {
    auth: {
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
}));

import { POST as forgotPost } from '@/app/api/auth/forgot/route.js';

describe('API: POST /api/auth/forgot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when email missing', async () => {
    const req = new Request('http://localhost/api/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await forgotPost(req);
    expect(res.status).toBe(400);
  });

  it('sends reset email when valid', async () => {
    mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });

    const req = new Request('http://localhost/api/auth/forgot', {
      method: 'POST',
      headers: { origin: 'https://save-atlas.vercel.app' },
      body: JSON.stringify({ email: 'user@example.com' }),
    });

    const res = await forgotPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('/auth/callback') }),
    );
  });
});
