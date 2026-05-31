/**
 * Strict caption search — every query term must appear in the post text.
 * No synonym OR-expansion (that was matching unrelated saves).
 */

const STOP = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'it',
]);

export function parseSearchTerms(query) {
  if (!query?.trim()) return [];
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function termMatchesCaption(caption, term) {
  const cap = (caption || '').toLowerCase();
  if (cap.includes(term)) return true;
  if (term.length > 3 && term.endsWith('s') && cap.includes(term.slice(0, -1))) return true;
  if (!term.endsWith('s') && cap.includes(`${term}s`)) return true;
  return false;
}

/** Client-side filter (demo mode, tests). */
export function captionMatchesSearch(caption, query) {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return true;
  return terms.every((term) => termMatchesCaption(caption, term));
}

/**
 * Apply AND filters to a Supabase query builder — each term must match caption.
 */
export function applyStrictCaptionSearch(supabaseQuery, search) {
  const terms = parseSearchTerms(search);
  if (terms.length === 0) return supabaseQuery;

  let q = supabaseQuery;
  for (const term of terms) {
    const patterns = [`caption.ilike.%${term}%`];
    if (term.length > 3 && term.endsWith('s')) {
      patterns.push(`caption.ilike.%${term.slice(0, -1)}%`);
    } else if (!term.endsWith('s')) {
      patterns.push(`caption.ilike.%${term}s%`);
    }
    q = patterns.length === 1
      ? q.ilike('caption', `%${term}%`)
      : q.or(patterns.join(','));
  }
  return q;
}

/** Sort so exact phrase and multi-term matches float to the top. */
export function rankSearchResults(saves, search) {
  const terms = parseSearchTerms(search);
  const phrase = search?.trim().toLowerCase() || '';
  if (terms.length === 0 || !saves?.length) return saves || [];

  const score = (save) => {
    const cap = (save.caption || '').toLowerCase();
    let s = 0;
    if (phrase && cap.includes(phrase)) s += 100;
    for (const term of terms) {
      if (termMatchesCaption(save.caption, term)) s += 10;
    }
    return s;
  };

  return [...saves].sort((a, b) => score(b) - score(a));
}
