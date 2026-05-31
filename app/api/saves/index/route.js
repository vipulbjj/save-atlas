/**
 * POST /api/saves/index
 *
 * Builds search_text and caption_embedding for saves that lack an index.
 * Processes in batches (40 rows) — call repeatedly until done: true.
 *
 * Body: { offset?: number }
 * Response: { ok, processed, total, done, nextOffset }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { buildSearchText } from '@/lib/searchText';
import { embedTexts, isEmbeddingsConfigured } from '@/lib/embeddings';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const BATCH = 40;

export async function POST(request) {
  try {
    if (!isEmbeddingsConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'Semantic search is not configured (missing OPENAI_API_KEY).' },
        { status: 503 }
      );
    }

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

    const { count: totalUnindexed } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('caption_embedding', null)
      .not('caption', 'is', null);

    const { data: rows, error: fetchError } = await supabase
      .from('saves')
      .select('id, caption, hashtags, username')
      .eq('user_id', user.id)
      .is('caption_embedding', null)
      .not('caption', 'is', null)
      .order('timestamp', { ascending: false })
      .range(offset, offset + BATCH - 1);

    if (fetchError) throw fetchError;

    const batch = (rows || []).filter((row) => buildSearchText(row).length > 0);
    if (batch.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        total: totalUnindexed ?? 0,
        done: (rows || []).length === 0,
        nextOffset: offset + (rows?.length || 0),
      });
    }

    const texts = batch.map((row) => {
      const searchText = buildSearchText(row);
      return searchText;
    });

    const embeddings = await embedTexts(texts);

    await Promise.all(
      batch.map((row, i) =>
        supabase
          .from('saves')
          .update({
            search_text: texts[i],
            caption_embedding: embeddings[i],
          })
          .eq('id', row.id)
      )
    );

    const processed = batch.length;
    const nextOffset = offset + processed;
    const done = processed < BATCH;

    return NextResponse.json({
      ok: true,
      processed,
      total: totalUnindexed ?? processed,
      done,
      nextOffset,
    });
  } catch (err) {
    console.error('Index error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
