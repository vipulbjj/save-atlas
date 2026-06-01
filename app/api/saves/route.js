/**
 * GET /api/saves
 *
 * Returns the user's saves with optional filtering.
 * Search uses semantic similarity over indexed post text when OPENAI_API_KEY
 * and caption_embedding are available; otherwise strict caption keyword match.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { searchUserSaves } from '@/lib/semanticSearch';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const subcategory = searchParams.get('subcategory');
    const mediaType = searchParams.get('media_type');
    const collection = searchParams.get('collection');
    const igCollection = searchParams.get('ig_collection');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = (page - 1) * limit;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    const { saves, total, mode } = await searchUserSaves(supabase, userId, {
      search,
      category,
      subcategory,
      mediaType,
      collection,
      igCollection,
      limit,
      offset,
    });

    const { count: photoCount } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('media_type', 'IMAGE');

    const { count: videoCount } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('media_type', 'VIDEO');

    return NextResponse.json({
      ok: true,
      saves,
      total,
      searchMode: mode,
      photos: photoCount || 0,
      videos: videoCount || 0,
      page,
      limit,
    });
  } catch (err) {
    console.error('Saves GET error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
