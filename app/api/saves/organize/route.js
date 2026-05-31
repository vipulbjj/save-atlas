/**
 * POST /api/saves/organize
 *
 * Re-classifies all of the authenticated user's saves using the latest
 * inferFullTaxonomy logic. Processes in batches of 200 rows to stay within
 * Vercel's function timeout (60 s). Call repeatedly until `done: true`.
 *
 * Request body (optional):
 *   { offset?: number }   — resume from a specific offset
 *
 * Response:
 *   { ok, processed, total, done, nextOffset }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { inferFullTaxonomy } from '@/lib/categorize';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BATCH = 200;

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    let body = {};
    try { body = await request.json(); } catch {}

    const offset = Number(body?.offset) || 0;

    // Count total saves for progress reporting
    const { count: total } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Fetch a batch
    const { data: saves, error: fetchError } = await supabase
      .from('saves')
      .select('id, caption, hashtags')
      .eq('user_id', user.id)
      .range(offset, offset + BATCH - 1);

    if (fetchError) throw fetchError;

    // Re-classify
    const updates = (saves || []).map((save) => {
      const { category, subCategory } = inferFullTaxonomy(save.caption, save.hashtags);
      return { id: save.id, category, subCategory };
    });

    // Write back in one shot per row (supabase-js doesn't support bulk update by id list directly)
    await Promise.all(
      updates.map(({ id, category, subCategory }) =>
        supabase
          .from('saves')
          .update({ ai_category: category, ai_subcategory: subCategory, ai_processed: true })
          .eq('id', id)
      )
    );

    const processed = updates.length;
    const nextOffset = offset + processed;
    const done = processed < BATCH; // fewer rows than batch size => we're at the end

    return NextResponse.json({ ok: true, processed, total, done, nextOffset });
  } catch (err) {
    console.error('Organize error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
