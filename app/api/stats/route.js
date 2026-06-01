import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { CATEGORIES, SUBCATEGORIES } from '@/lib/categorize';
import { isValidFolderName } from '@/lib/parseInstagramCollections';

export const dynamic = 'force-dynamic';

// Build flat lists from taxonomy for the large-account query path
const CATEGORIES_LIST = CATEGORIES.map((c) => c.id);
const SUBCATEGORIES_MAP = Object.fromEntries(
  Object.entries(SUBCATEGORIES).map(([cat, subs]) => [cat, subs.map((s) => s.id)])
);

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // 1. Total Saves
    const { count: total } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    // 2. Media Type Counts
    const { count: photos } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('media_type', 'IMAGE');

    const { count: videos } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('media_type', 'VIDEO');

    const categories = {};
    const subCategories = {};
    const igCollections = {};
    const totalCount = total || 0;

    // Hybrid performance scaling
    if (totalCount <= 500) {
      // 3. Category & Subcategory Counts (In-memory for small/moderate accounts to minimize query roundtrips)
      const { data: catData } = await supabase
        .from('saves')
        .select('ai_category, ai_subcategory, ig_collections')
        .eq('user_id', userId);

      (catData || []).forEach((item) => {
        const cat = item.ai_category || 'other';
        categories[cat] = (categories[cat] || 0) + 1;
        
        const sub = item.ai_subcategory || 'other';
        if (!subCategories[cat]) subCategories[cat] = {};
        subCategories[cat][sub] = (subCategories[cat][sub] || 0) + 1;

        for (const folder of item.ig_collections || []) {
          if (!folder || !isValidFolderName(folder)) continue;
          igCollections[folder] = (igCollections[folder] || 0) + 1;
        }
      });
    } else {
      // Index-based Parallel Counts (For large/stress accounts, avoids memory/network/bandwidth bottlenecks completely)
      const catCountsPromise = Promise.all(
        CATEGORIES_LIST.map(async (cat) => {
          const { count } = await supabase
            .from('saves')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('ai_category', cat);
          return { cat, count: count || 0 };
        })
      );

      const subCountsPromise = Promise.all(
        Object.entries(SUBCATEGORIES_MAP).flatMap(([cat, subs]) =>
          subs.map(async (sub) => {
            const { count } = await supabase
              .from('saves')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('ai_category', cat)
              .eq('ai_subcategory', sub);
            return { cat, sub, count: count || 0 };
          })
        )
      );

      const [catCounts, subCounts] = await Promise.all([catCountsPromise, subCountsPromise]);

      catCounts.forEach(({ cat, count }) => {
        if (count > 0) categories[cat] = count;
      });

      subCounts.forEach(({ cat, sub, count }) => {
        if (count > 0) {
          if (!subCategories[cat]) subCategories[cat] = {};
          subCategories[cat][sub] = count;
        }
      });

      const { data: collRows } = await supabase
        .from('saves')
        .select('ig_collections')
        .eq('user_id', userId);

      (collRows || []).forEach((item) => {
        for (const folder of item.ig_collections || []) {
          if (!folder || !isValidFolderName(folder)) continue;
          igCollections[folder] = (igCollections[folder] || 0) + 1;
        }
      });
    }

    return NextResponse.json({
      ok: true,
      email: user.email,
      stats: {
        total: totalCount,
        photos: photos || 0,
        videos: videos || 0,
        categories,
        subCategories,
        igCollections,
      }
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

