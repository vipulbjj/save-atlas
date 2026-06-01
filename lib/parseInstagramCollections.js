/**
 * Parse Instagram data-export "saved collections" JSON into shortcode → folder names.
 *
 * Instagram ships folder data in saved_collections.json (flat tag rows + post rows)
 * and/or grouped entries with title + string_list_data. Some exports embed
 * saved_saved_collections inside saved_posts.json as well.
 */

const GENERIC_FOLDER_NAMES = new Set([
  'media',
  'post',
  'reel',
  'photo',
  'video',
  'saved',
  'name',
  'collection',
  'instagram',
  'added time',
  'all posts',
  'all saved',
  'saved posts',
]);

function fixEncoding(str) {
  if (!str) return str;
  try {
    const bytes = Uint8Array.from(str, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '').trim();
  } catch {
    return String(str).replace(/\0/g, '').trim();
  }
}

export function shortcodeFromHref(href) {
  if (!href || typeof href !== 'string') return null;
  const m = href.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/** Instagram collection page URL → folder slug (user-named collection). */
function folderSlugFromSavedHref(href) {
  if (!href || typeof href !== 'string') return null;
  const m = href.match(/instagram\.com\/[^/]+\/saved\/([^/?#]+)/i);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]).trim();
  if (!slug || slug.toLowerCase() === 'all-posts') return null;
  return slug;
}

function humanizeSlug(slug) {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function isValidFolderName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return false;
  const lower = trimmed.toLowerCase();
  if (GENERIC_FOLDER_NAMES.has(lower)) return false;
  if (/^(post|reel|tv|photo|video)s?$/i.test(lower)) return false;
  return true;
}

function normalizeFolderName(name) {
  const fixed = fixEncoding(name);
  return isValidFolderName(fixed) ? fixed : null;
}

function addToMap(map, shortcode, collectionName) {
  const name = normalizeFolderName(collectionName);
  if (!shortcode || !name) return;
  if (!map[shortcode]) map[shortcode] = new Set();
  map[shortcode].add(name);
}

function finalizeMap(map) {
  return Object.fromEntries(
    Object.entries(map).map(([sc, set]) => [sc, [...set]]),
  );
}

function collectionNameFromEntry(entry) {
  const smd = entry?.string_map_data || {};
  const nameField = smd.Name || smd.name || smd.Collection || smd.collection;

  if (nameField?.href == null || nameField?.href === '') {
    const fromName = normalizeFolderName(nameField?.value);
    if (fromName) return fromName;
  }

  const savedSlug = folderSlugFromSavedHref(nameField?.href || entry?.href || entry?.uri);
  if (savedSlug) return humanizeSlug(savedSlug);

  return (
    normalizeFolderName(entry?.title)
    || normalizeFolderName(entry?.name)
    || normalizeFolderName(entry?.label)
    || null
  );
}

function parseGroupedCollections(entries) {
  const map = {};

  for (const entry of entries) {
    const collectionName = collectionNameFromEntry(entry);
    if (!collectionName) continue;

    for (const item of entry.string_list_data || []) {
      const sc = shortcodeFromHref(item?.href);
      if (sc) addToMap(map, sc, collectionName);
    }

    const smd = entry.string_map_data;
    if (smd) {
      for (const v of Object.values(smd)) {
        const sc = shortcodeFromHref(v?.href);
        if (sc) addToMap(map, sc, collectionName);
      }
    }
  }

  return finalizeMap(map);
}

/**
 * Flat export (yemreak / Meta docs): alternating rows where Name.value without
 * href is the folder tag, and Name.href is the saved post URL.
 */
function parseFlatCollections(entries) {
  const map = {};
  let currentCollection = null;

  for (const entry of entries) {
    const smd = entry?.string_map_data || {};
    const nameField = smd.Name || smd.name || smd.Collection || smd.collection;

    if (nameField) {
      const href = nameField.href ?? null;
      const label = fixEncoding(nameField.value) || '';

      if (href == null || href === '') {
        const folder = normalizeFolderName(label);
        if (folder) currentCollection = folder;
        continue;
      }

      const postSc = shortcodeFromHref(href);
      if (postSc && currentCollection) {
        addToMap(map, postSc, currentCollection);
        continue;
      }

      const savedSlug = folderSlugFromSavedHref(href);
      if (savedSlug && !postSc) {
        const folder = normalizeFolderName(label) || humanizeSlug(savedSlug);
        if (folder) currentCollection = folder;
        continue;
      }
    }

    // Grouped-style row inside a collections file
    const groupedName = collectionNameFromEntry(entry);
    if (groupedName && Array.isArray(entry.string_list_data)) {
      for (const item of entry.string_list_data) {
        const sc = shortcodeFromHref(item?.href);
        if (sc) addToMap(map, sc, groupedName);
      }
    }
  }

  return finalizeMap(map);
}

/**
 * @param {unknown} raw Parsed JSON from saved_collections.json (or similar)
 * @returns {Record<string, string[]>} shortcode → collection names
 */
export function parseSavedCollectionsFromExport(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const entries =
    raw.saved_saved_collections
    || raw.saved_collections
    || raw.collections
    || (Array.isArray(raw) ? raw : null);

  if (!Array.isArray(entries) || entries.length === 0) return {};

  // Run both parsers — Instagram mixes formats in the wild.
  return mergeCollectionMaps(
    parseGroupedCollections(entries),
    parseFlatCollections(entries),
  );
}

/** Regex fallback when JSON keys differ but URLs + folder names are present. */
export function parseCollectionsFromText(text) {
  const map = {};
  let currentCollection = null;

  const flatPattern = /"Name"\s*:\s*\{([^}]*)\}/g;
  let m;
  while ((m = flatPattern.exec(text)) !== null) {
    const block = m[1];
    const hrefMatch = block.match(/"href"\s*:\s*"([^"]+)"/);
    const valueMatch = block.match(/"value"\s*:\s*"([^"]*)"/);
    if (hrefMatch) {
      const sc = shortcodeFromHref(hrefMatch[1]);
      if (sc && currentCollection) addToMap(map, sc, currentCollection);
      const slug = folderSlugFromSavedHref(hrefMatch[1]);
      if (slug && !sc) {
        const folder = humanizeSlug(slug);
        if (folder) currentCollection = folder;
      }
    } else if (valueMatch) {
      const name = fixEncoding(
        valueMatch[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
          String.fromCharCode(parseInt(h, 16)),
        ),
      );
      const folder = normalizeFolderName(name);
      if (folder) currentCollection = folder;
    }
  }

  const titlePattern = /"title"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  const sections = text.split(titlePattern);
  for (let i = 1; i < sections.length; i += 2) {
    try {
      const title = normalizeFolderName(fixEncoding(JSON.parse(`"${sections[i]}"`)));
      if (!title) continue;
      const body = sections[i + 1] || '';
      const hrefRe = /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/g;
      let hm;
      while ((hm = hrefRe.exec(body)) !== null) {
        addToMap(map, hm[1], title);
      }
    } catch { /* skip bad section */ }
  }

  return finalizeMap(map);
}

/** Merge multiple shortcode → names maps (union per shortcode). */
export function mergeCollectionMaps(...maps) {
  const merged = {};
  for (const map of maps) {
    for (const [sc, names] of Object.entries(map || {})) {
      for (const name of names) addToMap(merged, sc, name);
    }
  }
  return finalizeMap(merged);
}

export function countCollectionEntries(map) {
  return Object.keys(map || {}).length;
}

export function distinctFolderNames(map) {
  const names = new Set();
  for (const list of Object.values(map || {})) {
    for (const n of list) {
      if (isValidFolderName(n)) names.add(n);
    }
  }
  return names.size;
}

/** All unique folder names referenced in a shortcode → names map. */
export function folderNamesFromMap(map) {
  const names = new Set();
  for (const list of Object.values(map || {})) {
    for (const n of list) {
      if (isValidFolderName(n)) names.add(n);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function isCollectionsJsonPath(path) {
  const lower = (path || '').toLowerCase();
  return (
    lower.includes('saved_collections')
    || lower.includes('saved/collections')
    || /\/saved\/saved_collection/.test(lower)
  );
}
