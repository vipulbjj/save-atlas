import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('next/image', () => ({
  default: React.forwardRef(function MockImage({ src, alt, ...props }, ref) {
    const { fill, ...otherProps } = props;
    return <img ref={ref} src={src} alt={alt} {...otherProps} />;
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

global.fetch = vi.fn();

import LoginPage from '@/app/login/page';
import ForgotPage from '@/app/auth/forgot/page';

describe('UI: public auth pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  });

  it('login page links forgot password to /auth/forgot', async () => {
    await act(async () => {
      render(<LoginPage />);
    });

    const forgot = screen.getByText('Forgot?').closest('a');
    expect(forgot).toBeTruthy();
    expect(forgot.getAttribute('href')).toBe('/auth/forgot');
  });

  it('forgot password page renders email form', async () => {
    await act(async () => {
      render(<ForgotPage />);
    });

    expect(screen.getByText(/reset your password/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeDefined();
    expect(screen.getByText(/back to sign in/i).closest('a')?.getAttribute('href')).toBe('/login');
  });
});
