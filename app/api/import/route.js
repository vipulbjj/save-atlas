/**
 * POST /api/import
 *
 * Receives pre-parsed saves array from the client-side ZIP parser.
 * Upserts to Supabase. oEmbed enrichment is skipped (unreliable + causes timeouts).
 *
 * Body: { saves: [{ shortcode, permalink, timestamp, title?, caption? }] }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { inferFullTaxonomy } from '@/lib/categorize';
import { buildSearchText } from '@/lib/searchText';

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

function fixEncoding(str) {
  if (!str) return str;
  try {
    const bytes = new Uint8Array(str.split('').map((c) => c.charCodeAt(0)));
    return new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '');
  } catch (e) {
    return str.replace(/\0/g, '');
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const saves = body?.saves;

    if (!Array.isArray(saves) || saves.length === 0) {
      return NextResponse.json({ ok: false, error: 'No saves provided.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Ensure the user exists in public.users to satisfy the foreign key constraint
    await supabase.from('users').upsert({
      id: userId,
      email: user.email,
    }, { onConflict: 'id' });

    // Build Supabase records — no oEmbed (avoids timeout)
    const records = saves.map((save) => {
      const rawCaption = save.caption || save.title || '';
      const fixedCaption = fixEncoding(rawCaption).replace(/\0/g, '');
      const hashtags = extractHashtags(fixedCaption);
      const { category, subCategory } = inferFullTaxonomy(fixedCaption, hashtags);

      // Validate & sanitize media type to prevent database check constraint failure
      let mediaType = 'IMAGE';
      const captionText = (fixedCaption || '').toLowerCase();
      const VIDEO_INDICATORS = [
        '#reel', '#video', 'reelsinstagram', 'reelvideo', '#shorts', 
        'reelsindia', 'sound on', '🔊', '🎥', '🎬', '▶️', 
        'reels.instagram', '#trendingreels', '#reels', 'explorepage'
      ];
      const isVideoHeuristic = VIDEO_INDICATORS.some(ind => captionText.includes(ind));

      if (save.permalink?.includes('/reel/') || save.permalink?.includes('/tv/') || isVideoHeuristic) {
        mediaType = 'VIDEO';
      }

      if (save.media_type && ['IMAGE', 'VIDEO', 'CAROUSEL'].includes(save.media_type)) {
        mediaType = save.media_type;
      }

      return {
        user_id: userId,
        instagram_id: save.shortcode,
        username: null,
        caption: fixedCaption || null,
        search_text: buildSearchText({ caption: fixedCaption, hashtags }),
        media_type: mediaType,
        thumbnail_url: null,
        video_url: null,
        hashtags: hashtags,
        likes: 0,
        location: null,
        permalink: save.permalink,
        timestamp: toISO(save.timestamp),
        ai_processed: true,
        ai_category: category,
        ai_subcategory: subCategory,
        ig_collections: Array.isArray(save.collections)
          ? save.collections.filter(Boolean)
          : [],
      };
    });

    // Deduplicate records on the backend to avoid processing duplicates
    const seenOnBackend = new Set();
    const uniqueRecords = [];
    for (const record of records) {
      if (record.instagram_id && !seenOnBackend.has(record.instagram_id)) {
        seenOnBackend.add(record.instagram_id);
        uniqueRecords.push(record);
      }
    }

    // Fetch already-stored instagram_ids in chunks to avoid PostgREST URI parameter overflow
    const existingSet = new Set();
    const DEDUPE_CHUNK = 500;
    
    for (let i = 0; i < uniqueRecords.length; i += DEDUPE_CHUNK) {
      const chunkRecords = uniqueRecords.slice(i, i + DEDUPE_CHUNK);
      const chunkShortcodes = chunkRecords.map((r) => r.instagram_id);
      
      const { data: existing, error } = await supabase
        .from('saves')
        .select('instagram_id')
        .eq('user_id', userId)
        .in('instagram_id', chunkShortcodes);

      if (error) {
        console.error('Deduplication check error:', error);
        throw error;
      }
      
      if (existing) {
        existing.forEach((r) => existingSet.add(r.instagram_id));
      }
    }

    const newRecords = uniqueRecords.filter((r) => !existingSet.has(r.instagram_id));

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

    // Backfill Instagram folder names on existing saves when re-importing with collections
    const withCollections = uniqueRecords.filter((r) => r.ig_collections?.length);
    let collectionsUpdated = 0;
    const UPDATE_CHUNK = 50;

    for (let i = 0; i < withCollections.length; i += UPDATE_CHUNK) {
      const chunk = withCollections.slice(i, i + UPDATE_CHUNK);
      const results = await Promise.all(
        chunk.map((rec) =>
          supabase
            .from('saves')
            .update({ ig_collections: rec.ig_collections })
            .eq('user_id', userId)
            .eq('instagram_id', rec.instagram_id)
            .select('id')
        ),
      );
      for (const { data, error } of results) {
        if (error) {
          console.error('Collection update error:', error);
          continue;
        }
        if (data?.length) collectionsUpdated += data.length;
      }
    }

    const folderNames = new Set();
    for (const rec of withCollections) {
      for (const name of rec.ig_collections) folderNames.add(name);
    }

    return NextResponse.json({
      ok: true,
      imported: inserted,
      collectionsUpdated,
      foldersFound: folderNames.size,
      folderNames: [...folderNames].sort((a, b) => a.localeCompare(b)),
      savesWithFolders: withCollections.length,
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

