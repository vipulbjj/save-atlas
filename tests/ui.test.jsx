import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';

// 1. Mock Next.js Image component to render standard img tag
vi.mock('next/image', () => ({
  default: React.forwardRef(function MockImage({ src, alt, ...props }, ref) {
    const { fill, ...otherProps } = props;
    return <img ref={ref} src={src} alt={alt} {...otherProps} />;
  })
}));

// 2. Use vi.hoisted to declare mockSupabaseClient so it's fully initialized before imports are resolved
const { mockSupabaseClient } = vi.hoisted(() => {
  return {
    mockSupabaseClient: {
      auth: {
        getSession: vi.fn(),
        getUser: vi.fn(),
      },
    }
  };
});

// Mock Supabase Client using the hoisted mock
vi.mock('@/lib/supabase-client', () => ({
  createClient: () => mockSupabaseClient,
}));

// 3. Mock window.location
if (typeof window !== 'undefined') {
  delete window.location;
  window.location = {
    search: '?demo=false',
    href: '',
  };
}

// Mock fetch globally
global.fetch = vi.fn();

// Import components to test after mocks are registered
import Home from '@/app/page';
import Dashboard from '@/app/dashboard/page';

describe('UI: Landing Page Component (Home)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders landing page title and layout elements correctly', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({ data: { session: null } });

    await act(async () => {
      render(<Home />);
    });

    expect(screen.getByText(/Turn your Instagram saves/i)).toBeDefined();
    expect(screen.getAllByText(/Features/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/How it Works/i).length).toBeGreaterThan(0);
  });

  it('renders "Dashboard" button instead of "Log In" if user session exists', async () => {
    mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
      data: { session: { user: { email: 'user@example.com' } } }
    });

    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeDefined();
      expect(screen.queryByText('Log In')).toBeNull();
    });
  });
});

describe('UI: Dashboard Sidebar and Content Panel (Dashboard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default fetch mocks
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/stats')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            email: 'vbajaj56@gmail.com',
            stats: {
              total: 1200,
              photos: 966,
              videos: 234,
              categories: { "home-design": 55, "tech-ai": 499 },
              subCategories: {}
            }
          })
        });
      }
      if (url.includes('/api/saves')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            total: 2,
            saves: [
              { id: '1', instagram_id: '1', thumbnail_url: '/modern_villa_facade_1777051470979.png', username: 'user_a', caption: 'Warm minimalist architecture design style', ai_category: 'home-design', timestamp: new Date().toISOString() },
              { id: '2', instagram_id: '2', thumbnail_url: '/japandi_interior_1777051495653.png', username: 'user_b', caption: 'Next.js Turbopack development guide', ai_category: 'tech-ai', timestamp: new Date().toISOString() }
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    });
  });

  it('renders dashboard with stats and library lists', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { email: 'vbajaj56@gmail.com' } }
    });

    await act(async () => {
      render(<Dashboard />);
    });

    // Check stats are rendered from mock API
    expect(screen.getAllByText(/Total Saves/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Photos/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Videos/i).length).toBeGreaterThan(0);

    // Check library navigation items
    expect(screen.getAllByText('All Saves').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tech & AI').length).toBeGreaterThan(0);
  });

  it('renders user profile email card in the sidebar bottom reliably', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { email: 'vbajaj56@gmail.com' } }
    });

    await act(async () => {
      render(<Dashboard />);
    });

    await waitFor(() => {
      expect(screen.getByText('vbajaj56@gmail.com')).toBeDefined();
      expect(screen.getByText('Premium Member')).toBeDefined();
    });
  });
});
