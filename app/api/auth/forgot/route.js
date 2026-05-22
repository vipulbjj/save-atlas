import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ ok: false, error: 'Email is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/auth/callback`,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message || 'Request failed' }, { status: 500 });
  }
}
