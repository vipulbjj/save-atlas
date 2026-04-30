/**
 * GET /api/saves
 * 
 * Returns the user's saves with optional filtering:
 *   ?category=Facades
 *   ?search=stone staircase
 *   ?page=1&limit=50
 */

import { NextResponse } from 'next/server';
import { getSupabase, DEFAULT_USER_ID } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search   = searchParams.get('search');
    const subcategory = searchParams.get('subcategory');
    const page     = parseInt(searchParams.get('page') || '1', 10);
    const limit    = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset   = (page - 1) * limit;

    const supabase = getSupabase();

    let query = supabase
      .from('saves')
      .select('*', { count: 'exact' })
      .eq('user_id', DEFAULT_USER_ID)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category && category !== 'all') {
      query = query.eq('ai_category', category);
    }

    if (subcategory && subcategory !== 'all') {
      query = query.eq('ai_subcategory', subcategory);
    }

    if (search) {
      // Full-text search over caption, ai_category, ai_style
      query = query.textSearch('caption', search, { type: 'websearch' });
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Get counts for photos and videos
    const { count: photoCount } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', DEFAULT_USER_ID)
      .eq('media_type', 'IMAGE');
    
    const { count: videoCount } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', DEFAULT_USER_ID)
      .eq('media_type', 'VIDEO');

    return NextResponse.json({
      ok:    true,
      saves: data,
      total: count,
      photos: photoCount || 0,
      videos: videoCount || 0,
      page,
      limit,
    });

  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
