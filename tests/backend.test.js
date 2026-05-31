import { describe, it, expect, vi, beforeEach } from 'vitest';

// Declare mocked objects inside vi.hoisted to ensure they are available before imports are resolved
const { mockSupabaseClient, mockUser } = vi.hoisted(() => {
  return {
    mockUser: { id: 'user_123', email: 'test@saveatlas.com' },
    mockSupabaseClient: {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
    }
  };
});

// Mock the Supabase server client library using the hoisted mocks
vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseClient),
}));

// Import the API routes and functions after the mock has been registered
import { GET as getStats } from '@/app/api/stats/route';
import { POST as updateSave } from '@/app/api/saves/update/route';
import { parseSearchTerms, captionMatchesSearch, rankSearchResults } from '@/lib/aiSearch';
import { buildSearchText } from '@/lib/searchText';

// Helper test for Instagram UTF-8 moji-bake encoding correction
const fixEncoding = (str) => {
  if (!str) return "";
  try {
    const bytes = new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return str;
  }
};

describe('Backend Utility Tests', () => {
  it('should fix garbled Instagram UTF-8 mojibake strings correctly', () => {
    // Garbled UTF-8 bytes representation
    const input = "Ã\u00a9lÃ\u00a9gant"; // "élégant" in garbled UTF-8
    const output = fixEncoding(input);
    expect(output).toBe("élégant");
  });

  it('should return empty string if input is falsy', () => {
    expect(fixEncoding(null)).toBe("");
    expect(fixEncoding("")).toBe("");
  });
});

describe('Search query parsing', () => {
  it('requires every term to match caption (AND, not OR)', () => {
    expect(captionMatchesSearch('Modern bathroom design ideas', 'bathroom designs')).toBe(true);
    expect(captionMatchesSearch('Small changes that transform a space', 'bathroom designs')).toBe(false);
    expect(captionMatchesSearch('6 Steps to Build with AI', 'bathroom designs')).toBe(false);
  });

  it('handles simple plural stems', () => {
    expect(captionMatchesSearch('Beautiful bathroom design', 'bathroom designs')).toBe(true);
  });

  it('parses terms and ignores stop words', () => {
    expect(parseSearchTerms('bathroom designs')).toEqual(['bathroom', 'designs']);
    expect(parseSearchTerms('')).toEqual([]);
    expect(parseSearchTerms(null)).toEqual([]);
  });

  it('ranks exact phrase matches higher', () => {
    const saves = [
      { id: '1', caption: 'Love this bathroom design' },
      { id: '2', caption: 'bathroom designs for small spaces' },
    ];
    const ranked = rankSearchResults(saves, 'bathroom designs');
    expect(ranked[0].id).toBe('2');
  });
});

describe('Search text for embeddings', () => {
  it('combines caption and hashtags without hash symbols', () => {
    const text = buildSearchText({
      caption: 'Love this #bathroom setup',
      hashtags: ['interiordesign', 'homedecor'],
      username: 'designer',
    });
    expect(text).toContain('bathroom setup');
    expect(text).toContain('interiordesign');
    expect(text).toContain('@designer');
    expect(text).not.toContain('#');
  });

  it('returns empty for missing content', () => {
    expect(buildSearchText({})).toBe('');
    expect(buildSearchText({ caption: '   ' })).toBe('');
  });
});

describe('Backend API: /api/stats Route Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 Unauthorized if user session does not exist', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('Auth error') });

    const response = await getStats();
    expect(response.status).toBe(401);
    
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toBe('Unauthorized');
  });

  it('should calculate stats correctly for low volume saves (<= 500)', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: mockUser }, error: null });

    // Mock count database queries
    // Total saves query, then photos query, then videos query
    let callCount = 0;
    mockSupabaseClient.from.mockImplementation((table) => {
      callCount++;
      if (callCount === 1) {
        // Total query
        return {
          select: () => ({
            eq: () => Promise.resolve({ count: 5, error: null }),
          }),
        };
      } else if (callCount === 2) {
        // Photos query
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ count: 4, error: null }),
            }),
          }),
        };
      } else if (callCount === 3) {
        // Videos query
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ count: 1, error: null }),
            }),
          }),
        };
      } else {
        // Categories list query for <= 500 saves
        const mockSavesData = [
          { ai_category: 'home-design', ai_subcategory: 'architecture' },
          { ai_category: 'home-design', ai_subcategory: 'interiors' },
          { ai_category: 'travel', ai_subcategory: 'stays' },
          { ai_category: 'tech-ai', ai_subcategory: 'ai-tools' },
          { ai_category: 'tech-ai', ai_subcategory: 'coding' },
        ];
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: mockSavesData, error: null }),
          }),
        };
      }
    });

    const response = await getStats();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.email).toBe('test@saveatlas.com');
    expect(data.stats.total).toBe(5);
    expect(data.stats.photos).toBe(4);
    expect(data.stats.videos).toBe(1);
    expect(data.stats.categories['home-design']).toBe(2);
    expect(data.stats.categories['travel']).toBe(1);
    expect(data.stats.categories['tech-ai']).toBe(2);
  });
});

describe('Backend API: /api/saves/update Route Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if unauthenticated', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null } });

    const req = {
      json: async () => ({ id: 'save_123', likes: 1 })
    };

    const response = await updateSave(req);
    expect(response.status).toBe(401);
  });

  it('should toggle like successfully when authenticated', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: mockUser } });
    mockSupabaseClient.from.mockReturnValue({
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => Promise.resolve({ data: [{ id: 'save_123', likes: 1 }], error: null })
          })
        })
      })
    });

    const req = {
      json: async () => ({ id: 'save_123', likes: 1 })
    };

    const response = await updateSave(req);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
  });
});
