/**
 * POST /api/import
 *
 * Accepts an Instagram data export:
 *   - A ZIP file (the full export) — we extract saved_posts.json from it
 *   - A raw JSON file (saved_posts.json directly)
 *
 * Parses all saved posts, enriches via Instagram oEmbed API, and upserts to Supabase.
 *
 * Returns: { ok, imported, skipped, total, errors }
 */

import { NextResponse } from 'next/server';
import { getSupabase, DEFAULT_USER_ID } from '@/lib/supabase';
import JSZip from 'jszip';

export const maxDuration = 60; // Vercel max for hobby
export const dynamic = 'force-dynamic';

// ── CORS ──────────────────────────────────────────────────────────────────────
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
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name?.toLowerCase() || '';

    let rawJson = null;

    // ── Parse ZIP or raw JSON ──────────────────────────────────────────────────
    if (filename.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(buffer);

      // Instagram exports place it at: your_instagram_activity/saved_posts_and_collections/saved_posts.json
      // Older exports: saved_posts.json at the root, or inside a folder
      const candidates = [
        'your_instagram_activity/saved_posts_and_collections/saved_posts.json',
        'saved_posts_and_collections/saved_posts.json',
        'saved_posts.json',
      ];

      let jsonFile = null;
      for (const path of candidates) {
        jsonFile = zip.file(path);
        if (jsonFile) break;
      }

      // Also try a case-insensitive search across all files in the zip
      if (!jsonFile) {
        zip.forEach((relativePath, zipEntry) => {
          if (!jsonFile && relativePath.toLowerCase().includes('saved_posts.json')) {
            jsonFile = zipEntry;
          }
        });
      }

      if (!jsonFile) {
        return NextResponse.json({
          ok: false,
          error: 'Could not find saved_posts.json inside the ZIP. Make sure you uploaded the correct Instagram data export.',
        }, { status: 400 });
      }

      rawJson = await jsonFile.async('string');

    } else if (filename.endsWith('.json')) {
      rawJson = buffer.toString('utf-8');
    } else {
      return NextResponse.json({
        ok: false,
        error: 'Please upload either the Instagram export ZIP or a saved_posts.json file.',
      }, { status: 400 });
    }

    // ── Parse the Instagram JSON ───────────────────────────────────────────────
    const parsed = JSON.parse(rawJson);

    // Instagram's export format:
    // { "saved_saved_media": [ { "title": "", "string_map_data": { "Saved on": { "href": "...", "timestamp": 123 } } } ] }
    const rawSaves = parsed?.saved_saved_media || parsed?.saves || (Array.isArray(parsed) ? parsed : []);

    if (!rawSaves || rawSaves.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'No saved posts found in the file. Make sure this is the saved_posts.json from your Instagram data export.',
      }, { status: 400 });
    }

    // ── Extract URLs and timestamps ───────────────────────────────────────────
    const saves = rawSaves
      .map((entry) => {
        const savedOn = entry?.string_map_data?.['Saved on'];
        const href = savedOn?.href || entry?.href || null;
        const timestamp = savedOn?.timestamp || entry?.timestamp || null;

        if (!href || !href.includes('instagram.com/p/')) return null;

        // Extract shortcode from URL: https://www.instagram.com/p/SHORTCODE/
        const match = href.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/);
        const shortcode = match?.[1] || null;
        if (!shortcode) return null;

        return {
          shortcode,
          permalink: `https://www.instagram.com/p/${shortcode}/`,
          timestamp: timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString(),
          title: entry?.title || null,
        };
      })
      .filter(Boolean);

    if (saves.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Could not extract any Instagram post URLs from the file.',
      }, { status: 400 });
    }

    // ── Enrich with oEmbed data (in batches to avoid rate limits) ────────────
    const enriched = await enrichBatch(saves);

    // ── Upsert to Supabase ────────────────────────────────────────────────────
    const supabase = getSupabase();

    const records = enriched.map((save) => ({
      user_id: DEFAULT_USER_ID,
      instagram_id: save.shortcode,
      username: save.username || null,
      caption: save.caption || save.title || null,
      media_type: save.media_type || 'IMAGE',
      thumbnail_url: save.thumbnail_url || null,
      video_url: null,
      hashtags: extractHashtags(save.caption || ''),
      likes: 0,
      location: null,
      permalink: save.permalink,
      timestamp: save.timestamp,
      ai_processed: false,
    }));

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
      message: `Successfully imported ${data?.length || records.length} saves from your Instagram export.`,
    }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ── oEmbed Enrichment ─────────────────────────────────────────────────────────

async function enrichBatch(saves) {
  const results = [];
  // Process in batches of 5 with small delay to be respectful
  const BATCH_SIZE = 5;

  for (let i = 0; i < saves.length; i += BATCH_SIZE) {
    const batch = saves.slice(i, i + BATCH_SIZE);
    const enriched = await Promise.all(batch.map(enrichOne));
    results.push(...enriched);

    // Small delay between batches
    if (i + BATCH_SIZE < saves.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}

async function enrichOne(save) {
  try {
    // Instagram's oEmbed endpoint — works for public posts, no auth required
    const oembedUrl = `https://www.instagram.com/p/${save.shortcode}/?__a=1&__d=dis`;

    // Use the official oEmbed endpoint as primary
    const res = await fetch(
      `https://graph.instagram.com/oembed?url=${encodeURIComponent(save.permalink)}&maxwidth=640`,
      {
        headers: { 'User-Agent': 'SaveAtlas/1.0' },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return {
        ...save,
        username: data.author_name || null,
        caption: data.title || null,
        thumbnail_url: data.thumbnail_url || null,
        media_type: 'IMAGE',
      };
    }
  } catch (e) {
    // oEmbed failed (private account, rate limit, etc.) — return base data
  }

  // Return without enrichment — we still have the permalink and timestamp
  return save;
}

function extractHashtags(text) {
  if (!text) return [];
  return (text.match(/#[a-zA-Z0-9_]+/g) || []).map((h) => h.toLowerCase());
}
