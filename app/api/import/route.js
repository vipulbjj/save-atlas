/**
 * POST /api/import
 *
 * Receives an array of pre-parsed saves (shortcode + permalink + timestamp)
 * from the client-side ZIP parser. Enriches via oEmbed and upserts to Supabase.
 *
 * Body: { saves: [{ shortcode, permalink, timestamp, title? }] }
 * Response: { ok, imported, total }
 */

import { NextResponse } from 'next/server';
import { getSupabase, DEFAULT_USER_ID } from '@/lib/supabase';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request) {
  try {
    const { saves } = await request.json();

    if (!Array.isArray(saves) || saves.length === 0) {
      return NextResponse.json({ ok: false, error: 'No saves provided.' }, { status: 400 });
    }

    // Enrich with oEmbed (batched, non-blocking — missing enrichment is fine)
    const enriched = await enrichBatch(saves);

    // Build Supabase records
    const records = enriched.map((save) => ({
      user_id: DEFAULT_USER_ID,
      instagram_id: save.shortcode,
      username: save.username || null,
      caption: save.caption || save.title || null,
      media_type: save.media_type || 'IMAGE',
      thumbnail_url: save.thumbnail_url || null,
      video_url: null,
      hashtags: extractHashtags(save.caption || save.title || ''),
      likes: 0,
      location: null,
      permalink: save.permalink,
      timestamp: save.timestamp,
      ai_processed: false,
    }));

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('saves')
      .upsert(records, { onConflict: 'instagram_id', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      imported: data?.length || records.length,
      total: saves.length,
      message: `Successfully imported ${data?.length || records.length} saves.`,
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });

  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ── oEmbed enrichment ─────────────────────────────────────────────────────────

async function enrichBatch(saves) {
  const results = [];
  const BATCH = 5;

  for (let i = 0; i < saves.length; i += BATCH) {
    const batch = saves.slice(i, i + BATCH);
    const enriched = await Promise.all(batch.map(enrichOne));
    results.push(...enriched);
    if (i + BATCH < saves.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return results;
}

async function enrichOne(save) {
  try {
    const res = await fetch(
      `https://graph.instagram.com/oembed?url=${encodeURIComponent(save.permalink)}&maxwidth=640`,
      {
        headers: { 'User-Agent': 'SaveAtlas/1.0' },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (res.ok) {
      const d = await res.json();
      return {
        ...save,
        username: d.author_name || null,
        caption: d.title || null,
        thumbnail_url: d.thumbnail_url || null,
        media_type: 'IMAGE',
      };
    }
  } catch { /* enrichment is best-effort */ }
  return save;
}

function extractHashtags(text) {
  if (!text) return [];
  return (text.match(/#[a-zA-Z0-9_]+/g) || []).map((h) => h.toLowerCase());
}
