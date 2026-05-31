/**
 * Mine recurring themes from save captions (and inline labels in post text).
 * Used by /api/saves/topics to drive dynamic subcategory pills on the dashboard.
 */

const STOP = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one',
  'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old',
  'see', 'two', 'way', 'who', 'boy', 'did', 'let', 'put', 'say', 'she', 'too', 'use', 'that',
  'this', 'with', 'have', 'from', 'they', 'been', 'were', 'said', 'each', 'which', 'their',
  'will', 'other', 'about', 'many', 'then', 'them', 'these', 'some', 'would', 'make', 'like',
  'into', 'time', 'very', 'when', 'come', 'here', 'just', 'know', 'take', 'people', 'into',
  'year', 'your', 'good', 'some', 'could', 'them', 'see', 'only', 'over', 'think', 'also',
  'back', 'after', 'use', 'work', 'first', 'well', 'way', 'even', 'want', 'because', 'any',
  'give', 'most', 'us', 'instagram', 'reels', 'reel', 'follow', 'link', 'bio', 'click', 'tap',
  'save', 'saved', 'post', 'video', 'photo', 'image', 'www', 'com', 'http', 'https',
]);

function titleCase(str) {
  return str
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function normalizeRowText(caption, hashtags) {
  let text = (caption || '').toLowerCase();
  text = text.replace(/https?:\/\/\S+/g, ' ');
  text = text.replace(/@\w+/g, ' ');
  // Inline #labels become plain words in the mining pass
  text = text.replace(/#([\w\u00C0-\u024F]+)/g, ' $1 ');
  for (const raw of hashtags || []) {
    const w = String(raw).replace(/^#/, '').toLowerCase().trim();
    if (w.length >= 2) text += ` ${w}`;
  }
  return text;
}

function tokenize(text) {
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}'-]{1,}/gu) || [];
  return matches.filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));
}

/**
 * @param {Array<{ caption?: string|null, hashtags?: string[]|null }>} rows
 * @param {number} limit
 * @returns {Array<{ id: string, label: string, query: string, count: number }>}
 */
export function extractTopicsFromSaves(rows, limit = 16) {
  const wordFreq = {};
  const phraseFreq = {};

  for (const row of rows || []) {
    const tokens = tokenize(normalizeRowText(row.caption, row.hashtags));
    if (tokens.length === 0) continue;

    const seenWords = new Set();
    for (const t of tokens) {
      if (seenWords.has(t)) continue;
      seenWords.add(t);
      wordFreq[t] = (wordFreq[t] || 0) + 1;
    }

    for (let i = 0; i < tokens.length - 1; i++) {
      const phrase = `${tokens[i]} ${tokens[i + 1]}`;
      phraseFreq[phrase] = (phraseFreq[phrase] || 0) + 1;
    }
  }

  const candidates = [];

  for (const [phrase, count] of Object.entries(phraseFreq)) {
    if (count < 2) continue;
    candidates.push({ query: phrase, label: titleCase(phrase), count, score: count * 3 });
  }

  for (const [word, count] of Object.entries(wordFreq)) {
    if (count < 2) continue;
    const covered = candidates.some((c) => c.query.includes(word));
    if (covered) continue;
    candidates.push({ query: word, label: titleCase(word), count, score: count });
  }

  candidates.sort((a, b) => b.score - a.score || b.count - a.count || a.label.localeCompare(b.label));

  const seen = new Set();
  const topics = [];
  for (const c of candidates) {
    if (seen.has(c.query)) continue;
    seen.add(c.query);
    topics.push({
      id: c.query.replace(/\s+/g, '-'),
      label: c.label,
      query: c.query,
      count: c.count,
    });
    if (topics.length >= limit) break;
  }

  return topics;
}
