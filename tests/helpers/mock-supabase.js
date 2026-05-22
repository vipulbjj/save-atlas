import { vi } from 'vitest';

export const mockUser = { id: 'user_123', email: 'test@saveatlas.com' };

/** Builds a chainable Supabase mock for saves insert/select flows. */
export function createSavesTableMock({ existingIds = [], insertRows = null } = {}) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(() =>
          Promise.resolve({
            data: existingIds.map((instagram_id) => ({ instagram_id })),
            error: null,
          }),
        ),
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() =>
              Promise.resolve({
                data: insertRows ?? [{ id: 'save_1' }],
                error: null,
              }),
            ),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() =>
        Promise.resolve({
          data: insertRows ?? [{ id: 'save_1' }],
          error: null,
        }),
      ),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => Promise.resolve({ data: [{ id: 'save_1' }], error: null })),
        })),
      })),
    })),
  };
}

export function mockAuthenticatedClient(overrides = {}) {
  const savesMock = overrides.savesTable ?? createSavesTableMock();

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      }),
    },
    from: vi.fn((table) => {
      if (table === 'users') {
        return {
          upsert: vi.fn(() => Promise.resolve({ error: null })),
        };
      }
      if (table === 'saves') {
        return savesMock;
      }
      return {};
    }),
    ...overrides.clientExtras,
  };

  return client;
}
