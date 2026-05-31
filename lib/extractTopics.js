/**
 * Mine distinct themes from save captions for category filter pills.
 * Avoids redundant hashtag pairs like "Homedecor Homedesign".
 */

import { SUBCATEGORIES } from '@/lib/categorize';

const STOP = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one',
  'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old',
  'see', 'two', 'way', 'who', 'this', 'with', 'have', 'from', 'they', 'been', 'were', 'their',
  'will', 'would', 'make', 'like', 'into', 'time', 'very', 'when', 'just', 'also', 'back',
  'after', 'work', 'first', 'well', 'even', 'want', 'because', 'any', 'give', 'most',
  'instagram', 'reels', 'reel', 'follow', 'link', 'bio', 'click', 'tap', 'save', 'saved',
  'post', 'video', 'photo', 'image', 'www', 'com', 'http', 'https', 'must', 'know', 'tips',
]);

/** Generic words that make weak pills on their own within a category */
const GENERIC = new Set([
  'design', 'decor', 'home', 'interior', 'interiors', 'style', 'ideas', 'inspiration',
  'beautiful', 'amazing', 'love', 'best', 'top', 'new', 'room', 'house', 'space',
]);

const VOCAB = [
  'interior', 'interiors', 'architecture', 'kitchen', 'bathroom', 'bedroom', 'living',
  'furniture', 'lighting', 'renovation', 'minimal', 'modern', 'scandinavian', 'japandi',
  'luxury', 'lifestyle', 'homes', 'decor', 'design', 'home', 'villa', 'apartment',
  'facade', 'cabin', 'cozy', 'aesthetic', 'makeover', 'remodel', 'outdoor', 'garden',
  'startup', 'founder', 'marketing', 'productivity', 'coding', 'travel', 'hotel', 'recipe',
];

const KNOWN_COMPOUNDS = {
  homedecor: 'home decor',
  homedesign: 'home design',
  interiordesign: 'interior design',
  interiordecor: 'interior decor',
  luxuryhomes: 'luxury homes',
  luxuryhome: 'luxury home',
  luxurylifestyle: 'luxury lifestyle',
  livingroom: 'living room',
  diningroom: 'dining room',
  floorplan: 'floor plan',
  homerenovation: 'home renovation',
  kitchenremodel: 'kitchen remodel',
  bathroomdesign: 'bathroom design',
  aihacks: 'ai hacks',
  sidehustle: 'side hustle',
};

function titleCase(str) {
  return str
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function splitCompoundToken(token) {
  const lower = token.toLowerCase();
  if (KNOWN_COMPOUNDS[lower]) return KNOWN_COMPOUNDS[lower].split(/\s+/);
  if (lower.length < 9) return [lower];

  const parts = [];
  let remaining = lower;
  while (remaining.length > 0) {
    const word = VOCAB.find((w) => remaining.startsWith(w));
    if (word) {
      parts.push(word);
      remaining = remaining.slice(word.length);
    } else {
      parts.push(remaining);
      break;
    }
  }
  return parts.length > 1 ? parts : [lower];
}

function tokenizeCaption(caption) {
  let text = (caption || '').toLowerCase();
  text = text.replace(/https?:\/\/\S+/g, ' ');
  text = text.replace(/@\w+/g, ' ');
  text = text.replace(/#([\w\u00C0-\u024F]+)/g, (_, tag) => {
    const split = splitCompoundToken(tag);
    return ` ${split.join(' ')} `;
  });

  const raw = text.match(/[\p{L}\p{N}][\p{L}\p{N}'-]{1,}/gu) || [];
  const tokens = [];
  for (const t of raw) {
    if (t.length < 3 || STOP.has(t) || /^\d+$/.test(t)) continue;
    for (const part of splitCompoundToken(t)) {
      if (part.length >= 3 && !STOP.has(part)) tokens.push(part);
    }
  }
  return tokens;
}

function tokenSet(query) {
  return new Set(String(query).toLowerCase().split(/\s+/).filter(Boolean));
}

function overlapRatio(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

function isRedundant(candidate, existingLabels) {
  for (const label of existingLabels) {
    if (overlapRatio(candidate, label) >= 0.66) return true;
    if (label.includes(candidate) || candidate.includes(label)) {
      const shorter = candidate.length < label.length ? candidate : label;
      const longer = candidate.length >= label.length ? candidate : label;
      if (longer.split(/\s+/).length - shorter.split(/\s+/).length <= 1) return true;
    }
  }
  return false;
}

export function getSubcategoryLabel(categoryId, subId) {
  const sub = SUBCATEGORIES[categoryId]?.find((s) => s.id === subId);
  if (sub?.label) return sub.label;
  return titleCase(String(subId).replace(/-/g, ' '));
}

/**
 * Build filter pills: subcategory counts first, then distinct caption themes.
 * @param {string} categoryId
 * @param {Record<string, number>} subCategoryCounts
 * @param {Array<{ caption?: string|null, hashtags?: string[]|null }>} rows
 * @param {number} limit
 */
export function buildCategoryFilters(categoryId, subCategoryCounts, rows, limit = 10) {
  const reservedLabels = [];
  const filters = [];

  const subs = Object.entries(subCategoryCounts || {})
    .filter(([id, count]) => id && id !== 'other' && count >= 3)
    .sort((a, b) => b[1] - a[1]);

  for (const [subId, count] of subs) {
    const label = getSubcategoryLabel(categoryId, subId);
    reservedLabels.push(label);
    filters.push({
      id: `sub-${subId}`,
      kind: 'subcategory',
      subcategoryId: subId,
      label,
      query: null,
      count,
    });
  }

  const wordFreq = {};
  const phraseFreq = {};

  for (const row of rows || []) {
    const tokens = tokenizeCaption(row.caption);
    if (tokens.length === 0) continue;

    const seenWords = new Set();
    for (const t of tokens) {
      if (seenWords.has(t) || GENERIC.has(t)) continue;
      seenWords.add(t);
      wordFreq[t] = (wordFreq[t] || 0) + 1;
    }

    for (let i = 0; i < tokens.length - 1; i++) {
      const a = tokens[i];
      const b = tokens[i + 1];
      if (GENERIC.has(a) && GENERIC.has(b)) continue;
      if (a.length < 4 && b.length < 4) continue;
      const phrase = `${a} ${b}`;
      phraseFreq[phrase] = (phraseFreq[phrase] || 0) + 1;
    }
  }

  const themeCandidates = [];

  for (const [phrase, count] of Object.entries(phraseFreq)) {
    if (count < 3) continue;
    if (isRedundant(phrase, reservedLabels)) continue;
    themeCandidates.push({ query: phrase, label: titleCase(phrase), count, score: count * 4 });
  }

  for (const [word, count] of Object.entries(wordFreq)) {
    if (count < 4) continue;
    if (GENERIC.has(word)) continue;
    if (themeCandidates.some((c) => c.query.includes(word))) continue;
    if (isRedundant(word, reservedLabels)) continue;
    themeCandidates.push({ query: word, label: titleCase(word), count, score: count * 2 });
  }

  themeCandidates.sort((a, b) => b.score - a.score || b.count - a.count);

  for (const c of themeCandidates) {
    if (filters.some((f) => f.kind === 'theme' && overlapRatio(f.query, c.query) >= 0.66)) continue;
    if (isRedundant(c.label, filters.map((f) => f.label))) continue;
    filters.push({
      id: `theme-${c.query.replace(/\s+/g, '-')}`,
      kind: 'theme',
      subcategoryId: null,
      label: c.label,
      query: c.query,
      count: c.count,
    });
    if (filters.length >= limit) break;
  }

  return filters.slice(0, limit);
}

/** @deprecated use buildCategoryFilters via /api/saves/topics */
export function extractTopicsFromSaves(rows, limit = 16) {
  return buildCategoryFilters('other', {}, rows, limit)
    .filter((f) => f.kind === 'theme')
    .map((f) => ({ id: f.id, label: f.label, query: f.query, count: f.count }));
}
