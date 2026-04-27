/**
 * POST /api/saves/sync
 * 
 * Receives a batch of saves from the Chrome extension.
 * Deduplicates by instagram_id, upserts into Supabase,
 * and logs a sync session.
 * 
 * Body: { saves: SaveObject[] }
 * Response: { ok: true, inserted: number, total: number }
 */

import { NextResponse } from 'next/server';
import { getSupabase, DEFAULT_USER_ID } from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const { saves } = body;

    if (!Array.isArray(saves) || saves.length === 0) {
      return NextResponse.json({ ok: false, error: 'No saves provided' }, { status: 400 });
    }

    // Sanitize and map to DB schema
    const records = saves.map((s) => ({
      user_id:       DEFAULT_USER_ID,
      instagram_id:  String(s.instagram_id),
      username:      s.username || null,
      caption:       s.caption?.slice(0, 2200) || null, // Instagram caption limit
      media_type:    ['IMAGE', 'VIDEO', 'CAROUSEL'].includes(s.media_type) ? s.media_type : 'IMAGE',
      thumbnail_url: s.thumbnail_url || null,
      video_url:     s.video_url || null,
      hashtags:      Array.isArray(s.hashtags) ? s.hashtags.slice(0, 30) : [],
      likes:         typeof s.likes === 'number' ? s.likes : 0,
      location:      s.location || null,
      permalink:     s.permalink || null,
      timestamp:     s.timestamp ? new Date(s.timestamp).toISOString() : new Date().toISOString(),
      synced_at:     new Date().toISOString(),
    }));

    const supabase = getSupabase();

    // Upsert — insert or ignore duplicates based on (instagram_id, user_id)
    const { data, error } = await supabase
      .from('saves')
      .upsert(records, {
        onConflict: 'instagram_id,user_id',
        ignoreDuplicates: true,
      })
      .select('id');

    if (error) {
      console.error('[API /saves/sync] Supabase error:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const inserted = data?.length || 0;

    // Log sync session
    await supabase.from('sync_sessions').insert({
      user_id:     DEFAULT_USER_ID,
      saves_count: saves.length,
      new_saves:   inserted,
      source:      'extension',
    });

    // Get total count
    const { count } = await supabase
      .from('saves')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', DEFAULT_USER_ID);

    return NextResponse.json({
      ok:       true,
      inserted,
      received: saves.length,
      total:    count || 0,
    });

  } catch (err) {
    console.error('[API /saves/sync] Unexpected error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'SaveAtlas sync endpoint live.' });
}
