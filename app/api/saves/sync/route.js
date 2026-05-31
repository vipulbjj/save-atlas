import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { inferFullTaxonomy } from '@/lib/categorize';
import { buildSearchText } from '@/lib/searchText';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function fixEncoding(str) {
  if (!str) return str;
  try {
    const bytes = new Uint8Array(str.split('').map((c) => c.charCodeAt(0)));
    return new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '');
  } catch (e) {
    return str.replace(/\0/g, '');
  }
}

function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? [...new Set(matches.map((h) => h.toLowerCase()))] : [];
}

function extensionSaveToRecord(save, userId) {
  const rawCaption = save.caption || save.title || '';
  const fixedCaption = fixEncoding(rawCaption).replace(/\0/g, '');
  const hashtags =
    Array.isArray(save.hashtags) && save.hashtags.length > 0
      ? save.hashtags.map((h) => fixEncoding(h))
      : extractHashtags(fixedCaption);
  const { category, subCategory } = inferFullTaxonomy(fixedCaption, hashtags);

  let mediaType = 'IMAGE';
  if (save.media_type && ['IMAGE', 'VIDEO', 'CAROUSEL'].includes(save.media_type)) {
    mediaType = save.media_type;
  } else if (save.permalink?.includes('/reel/') || save.permalink?.includes('/tv/')) {
    mediaType = 'VIDEO';
  }

  const instagramId = save.instagram_id || save.shortcode;
  if (!instagramId) return null;

  return {
    user_id: userId,
    instagram_id: String(instagramId),
    username: save.username || null,
    caption: fixedCaption || null,
    search_text: buildSearchText({ caption: fixedCaption, hashtags, username: save.username }),
    media_type: mediaType,
    thumbnail_url: save.thumbnail_url || null,
    video_url: save.video_url || null,
    hashtags,
    likes: save.likes ?? 0,
    location: save.location || null,
    permalink: save.permalink || null,
    timestamp: save.timestamp || new Date().toISOString(),
    ai_processed: true,
    ai_category: category,
    ai_subcategory: subCategory,
  };
}

async function insertExtensionSaves(supabase, userId, saves) {
  const records = saves
    .map((save) => extensionSaveToRecord(save, userId))
    .filter(Boolean);

  const seen = new Set();
  const uniqueRecords = [];
  for (const record of records) {
    if (!seen.has(record.instagram_id)) {
      seen.add(record.instagram_id);
      uniqueRecords.push(record);
    }
  }

  const existingSet = new Set();
  const DEDUPE_CHUNK = 500;

  for (let i = 0; i < uniqueRecords.length; i += DEDUPE_CHUNK) {
    const chunkRecords = uniqueRecords.slice(i, i + DEDUPE_CHUNK);
    const chunkIds = chunkRecords.map((r) => r.instagram_id);

    const { data: existing, error } = await supabase
      .from('saves')
      .select('instagram_id')
      .eq('user_id', userId)
      .in('instagram_id', chunkIds);

    if (error) throw error;
    existing?.forEach((r) => existingSet.add(r.instagram_id));
  }

  const newRecords = uniqueRecords.filter((r) => !existingSet.has(r.instagram_id));

  let inserted = 0;
  const CHUNK = 500;

  for (let i = 0; i < newRecords.length; i += CHUNK) {
    const chunk = newRecords.slice(i, i + CHUNK);
    const { data, error } = await supabase.from('saves').insert(chunk).select('id');

    if (error) throw error;
    inserted += data?.length || 0;
  }

  return {
    imported: inserted,
    skipped: records.length - newRecords.length,
    total: uniqueRecords.length,
  };
}

async function backfillUnprocessed(supabase, userId) {
  const { data: saves, error } = await supabase
    .from('saves')
    .select('*')
    .eq('user_id', userId)
    .eq('ai_processed', false)
    .limit(200);

  if (error) throw error;

  let fixedCount = 0;

  await Promise.all(
    (saves || []).map(async (save) => {
      try {
        const fixedCaption = fixEncoding(save.caption);
        const hashtags = (save.hashtags || []).map((h) => fixEncoding(h));
        const { category, subCategory } = inferFullTaxonomy(fixedCaption, hashtags);

        const { error: updateError } = await supabase
          .from('saves')
          .update({
            caption: fixedCaption,
            hashtags,
            search_text: buildSearchText({ caption: fixedCaption, hashtags, username: save.username }),
            ai_category: category,
            ai_subcategory: subCategory,
            ai_processed: true,
          })
          .eq('id', save.id);

        if (!updateError) fixedCount++;
      } catch (e) {
        console.error(`Failed to fix save ${save.id}:`, e);
      }
    }),
  );

  return {
    fixed: fixedCount,
    remaining: (saves || []).length === 200,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized. Log in at save-atlas.vercel.app first.' },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const userId = user.id;

    await supabase.from('users').upsert(
      { id: userId, email: user.email },
      { onConflict: 'id' },
    );

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const incoming = body?.saves;

    if (Array.isArray(incoming) && incoming.length > 0) {
      const result = await insertExtensionSaves(supabase, userId, incoming);
      return NextResponse.json(
        { ok: true, ...result },
        { headers: CORS_HEADERS },
      );
    }

    const backfill = await backfillUnprocessed(supabase, userId);
    return NextResponse.json(
      { ok: true, ...backfill },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
