/**
 * GET /api/saves/topics?category=tech-ai&limit=16
 *
 * Returns recurring themes mined from the user's post text in a category.
 * Response: { ok: true, topics: [{ id, label, query, count }] }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { extractTopicsFromSaves } from '@/lib/extractTopics';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const limit = Math.min(Number(searchParams.get('limit') || 16), 30);

    if (!category || category === 'all') {
      return NextResponse.json({ ok: true, topics: [] });
    }

    const { data, error } = await supabase
      .from('saves')
      .select('caption, hashtags')
      .eq('user_id', user.id)
      .eq('ai_category', category)
      .limit(1000);

    if (error) throw error;

    const topics = extractTopicsFromSaves(data || [], limit);

    return NextResponse.json({ ok: true, topics });
  } catch (err) {
    console.error('Topics error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
