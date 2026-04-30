/**
 * POST /api/import
 *
 * Receives pre-parsed saves array from the client-side ZIP parser.
 * Upserts to Supabase. oEmbed enrichment is skipped (unreliable + causes timeouts).
 *
 * Body: { saves: [{ shortcode, permalink, timestamp, title?, caption? }] }
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
    const body = await request.json();
    const saves = body?.saves;

    if (!Array.isArray(saves) || saves.length === 0) {
      return NextResponse.json({ ok: false, error: 'No saves provided.' }, { status: 400 });
    }

    // Build Supabase records — no oEmbed (avoids timeout)
    const records = saves.map((save) => ({
      user_id: DEFAULT_USER_ID,
      instagram_id: save.shortcode,
      username: null,
      caption: save.caption || save.title || null,
      media_type: save.permalink?.includes('/reel/') ? 'VIDEO' : 'IMAGE',
      thumbnail_url: null,
      video_url: null,
      hashtags: extractHashtags(save.caption || save.title || ''),
      likes: 0,
      location: null,
      permalink: save.permalink,
      timestamp: toISO(save.timestamp),
      ai_processed: false,
    }));

    const supabase = getSupabase();

    // Fetch already-stored instagram_ids to deduplicate without needing a unique constraint
    const shortcodes = records.map((r) => r.instagram_id);
    const { data: existing } = await supabase
      .from('saves')
      .select('instagram_id')
      .in('instagram_id', shortcodes);

    const existingSet = new Set((existing || []).map((r) => r.instagram_id));
    const newRecords = records.filter((r) => !existingSet.has(r.instagram_id));

    let inserted = 0;
    const CHUNK = 500;

    for (let i = 0; i < newRecords.length; i += CHUNK) {
      const chunk = newRecords.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('saves')
        .insert(chunk)
        .select('id');

      if (error) {
        console.error('Supabase insert error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      inserted += data?.length || 0;
    }

    const skipped = records.length - newRecords.length;

    return NextResponse.json({
      ok: true,
      imported: inserted,
      total: saves.length,
      message: `Successfully imported ${inserted} saves.`,
    }, { headers: { 'Access-Control-Allow-Origin': '*' } });

  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

function extractHashtags(text) {
  if (!text) return [];
  return (text.match(/#[a-zA-Z0-9_]+/g) || []).map((h) => h.toLowerCase());
}

// Convert any timestamp representation to a Postgres-safe ISO string
function toISO(ts) {
  if (!ts) return new Date().toISOString();
  const n = Number(ts);
  if (!isNaN(n) && n > 1_000_000_000 && n < 9_999_999_999) {
    return new Date(n * 1000).toISOString(); // Unix seconds → ISO
  }
  if (!isNaN(n) && n > 9_999_999_999) {
    return new Date(n).toISOString(); // Unix milliseconds → ISO
  }
  // Already a string like "2026-04-30T..." — validate it
  const d = new Date(ts);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
