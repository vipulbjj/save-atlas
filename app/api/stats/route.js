import { NextResponse } from 'next/server';
import { getSupabase, DEFAULT_USER_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabase();

    // 1. Total Saves
    const { count: total } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', DEFAULT_USER_ID);

    // 2. Media Type Counts
    const { count: photos } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', DEFAULT_USER_ID)
      .eq('media_type', 'IMAGE');

    const { count: videos } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', DEFAULT_USER_ID)
      .eq('media_type', 'VIDEO');

    // 3. Category & Subcategory Counts
    const { data: catData } = await supabase
      .from('saves')
      .select('ai_category, ai_subcategory')
      .eq('user_id', DEFAULT_USER_ID);

    const categories = {};
    const subCategories = {};

    (catData || []).forEach((item) => {
      const cat = item.ai_category || 'other';
      categories[cat] = (categories[cat] || 0) + 1;
      
      const sub = item.ai_subcategory || 'other';
      if (!subCategories[cat]) subCategories[cat] = {};
      subCategories[cat][sub] = (subCategories[cat][sub] || 0) + 1;
    });

    return NextResponse.json({
      ok: true,
      stats: {
        total: total || 0,
        photos: photos || 0,
        videos: videos || 0,
        categories,
        subCategories
      }
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
