import { embedText, isEmbeddingsConfigured } from '@/lib/embeddings';
import { applyStrictCaptionSearch, rankSearchResults } from '@/lib/aiSearch';

const MATCH_THRESHOLD = 0.32;

function applyCollectionFilter(query, collection) {
  if (!collection || collection === 'all') return query;
  if (collection === 'favourites') return query.gt('likes', 0);
  if (collection === 'inspiration') return query.in('ai_category', ['home-design', 'tech-ai']);
  if (collection === 'highlights') {
    return query.or('caption.ilike.%#highlight%,caption.ilike.%excellent%,caption.ilike.%best%');
  }
  return query;
}

/**
 * Semantic search via pgvector RPC; falls back to strict caption keyword search.
 */
export async function searchUserSaves(supabase, userId, opts) {
  const {
    search,
    category,
    subcategory,
    mediaType,
    collection,
    limit,
    offset,
  } = opts;

  if (search?.trim() && isEmbeddingsConfigured()) {
    const semantic = await trySemanticSearch(supabase, userId, opts);
    if (semantic) return semantic;
  }

  return keywordSearch(supabase, userId, opts);
}

async function trySemanticSearch(supabase, userId, opts) {
  const { search, category, subcategory, mediaType, collection, limit, offset } = opts;

  try {
    const queryEmbedding = await embedText(search.trim());
    if (!queryEmbedding) return null;

    const { data: matches, error } = await supabase.rpc('match_saves', {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_category: category && category !== 'all' ? category : null,
      match_subcategory: subcategory && subcategory !== 'all' ? subcategory : null,
      match_media_type: mediaType && mediaType !== 'all' ? mediaType : null,
      match_count: limit,
      match_offset: offset,
      match_threshold: MATCH_THRESHOLD,
    });

    if (error) {
      // RPC missing until migration applied — fall back silently
      if (error.code === 'PGRST202' || error.message?.includes('match_saves')) return null;
      throw error;
    }

    if (!matches?.length) {
      const { count } = await supabase
        .from('saves')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('caption_embedding', 'is', null);

      // No indexed posts yet — keyword search until /api/saves/index backfill runs
      if (!count) return null;

      return { saves: [], total: 0, mode: 'semantic' };
    }

    const ids = matches.map((m) => m.id);
    const total = Number(matches[0]?.total_count ?? matches.length);

    let rowQuery = supabase.from('saves').select('*').in('id', ids);
    rowQuery = applyCollectionFilter(rowQuery, collection);

    const { data: rows, error: rowError } = await rowQuery;
    if (rowError) throw rowError;

    const simMap = new Map(matches.map((m) => [m.id, m.similarity]));
    const saves = (rows || [])
      .sort((a, b) => (simMap.get(b.id) ?? 0) - (simMap.get(a.id) ?? 0));

    return { saves, total, mode: 'semantic' };
  } catch (err) {
    console.error('Semantic search failed, using keyword fallback:', err.message);
    return null;
  }
}

async function keywordSearch(supabase, userId, opts) {
  const { search, category, subcategory, mediaType, collection, limit, offset } = opts;

  let query = supabase
    .from('saves')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category && category !== 'all') query = query.eq('ai_category', category);
  if (subcategory && subcategory !== 'all') query = query.eq('ai_subcategory', subcategory);
  if (mediaType && mediaType !== 'all') query = query.eq('media_type', mediaType);
  query = applyCollectionFilter(query, collection);
  if (search) query = applyStrictCaptionSearch(query, search);

  const { data, error, count } = await query;
  if (error) throw error;

  const saves = search ? rankSearchResults(data || [], search) : (data || []);
  return { saves, total: count ?? saves.length, mode: 'keyword' };
}
