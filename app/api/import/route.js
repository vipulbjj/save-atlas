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
      timestamp: save.timestamp,
      ai_processed: false,
    }));

    const supabase = getSupabase();

    // Batch upsert in chunks of 500 to stay within Supabase limits
    const CHUNK = 500;
    let inserted = 0;

    for (let i = 0; i < records.length; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('saves')
        .upsert(chunk, { onConflict: 'instagram_id', ignoreDuplicates: true })
        .select('id');

      if (error) {
        console.error('Supabase upsert error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      inserted += data?.length || 0;
    }

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
