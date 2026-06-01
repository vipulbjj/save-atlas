/**
 * Parse Instagram data-export collection/folder data → shortcode → folder names.
 *
 * Sources (varies by export year / region):
 * - your_instagram_activity/saved/saved_collections.json  → saved_saved_collections[]
 * - saved/saved_collections.json (legacy)
 * - saved_items_and_collections/your_saved_items.json
 * - saved_posts.json (embedded saved_saved_collections or per-post collection fields)
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
  'saved on',
  'saved post',
]);

const COLLECTION_FIELD_RE = /collection|folder|saved.?collection|board|album/i;

function fixEncoding(str) {
  if (!str) return str;
  try {
    const bytes = Uint8Array.from(str, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '').trim();
  } catch {
    return String(str).replace(/\0/g, '').trim();
  }
}

/** Meta exports sometimes store UTF-8 folder names as Latin-1 bytes (yemreak pattern). */
function decodeFolderLabel(str) {
  if (!str) return '';
  const utf8 = fixEncoding(str);
  if (utf8 && utf8 !== str) return utf8;
  try {
    const bytes = Uint8Array.from(str, (c) => c.charCodeAt(0) & 0xff);
    const latin = new TextDecoder('utf-8').decode(bytes).trim();
    return latin || utf8 || str.trim();
  } catch {
    return utf8 || String(str).trim();
  }
}

export function shortcodeFromHref(href) {
  if (!href || typeof href !== 'string') return null;
  const m = href.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

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
  const fixed = decodeFolderLabel(name);
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

function hrefsFromEntry(entry) {
  const hrefs = [];
  if (entry?.href) hrefs.push(entry.href);
  if (entry?.uri) hrefs.push(entry.uri);
  if (entry?.url) hrefs.push(entry.url);
  for (const item of entry?.string_list_data || []) {
    if (item?.href) hrefs.push(item.href);
  }
  for (const item of entry?.media_list_data || []) {
    if (item?.href) hrefs.push(item.href);
    if (item?.uri) hrefs.push(item.uri);
  }
  const smd = entry?.string_map_data;
  if (smd) {
    for (const v of Object.values(smd)) {
      if (v?.href) hrefs.push(v.href);
    }
  }
  for (const lv of entry?.label_values || []) {
    if (lv?.href) hrefs.push(lv.href);
  }
  return hrefs;
}

function collectionNameFromEntry(entry) {
  const smd = entry?.string_map_data || {};

  for (const [key, val] of Object.entries(smd)) {
    if (COLLECTION_FIELD_RE.test(key) && val?.value && !val?.href) {
      const fromField = normalizeFolderName(val.value);
      if (fromField) return fromField;
    }
  }

  const nameField = smd.Name || smd.name || smd.Collection || smd.collection;
  if (nameField) {
    const hasHref = 'href' in nameField && nameField.href != null && nameField.href !== '';
    if (!hasHref) {
      const fromName = normalizeFolderName(nameField.value);
      if (fromName) return fromName;
    }
    const savedSlug = folderSlugFromSavedHref(nameField.href);
    if (savedSlug) return humanizeSlug(savedSlug);
  }

  const savedSlug = folderSlugFromSavedHref(entry?.href || entry?.uri);
  if (savedSlug) return humanizeSlug(savedSlug);

  return (
    normalizeFolderName(entry?.title)
    || normalizeFolderName(entry?.name)
    || normalizeFolderName(entry?.label)
    || normalizeFolderName(entry?.collection_name)
    || normalizeFolderName(entry?.collectionName)
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

    for (const item of entry.media_list_data || []) {
      const sc = shortcodeFromHref(item?.href || item?.uri);
      if (sc) addToMap(map, sc, collectionName);
    }

    const smd = entry?.string_map_data;
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
 * Flat export: alternating rows — Name.value (no href) = folder, Name.href = post.
 * Also handles title-only header rows followed by post rows.
 */
function parseFlatCollections(entries) {
  const map = {};
  let currentCollection = null;

  for (const entry of entries) {
    const headerOnly = collectionNameFromEntry(entry);
    const entryHrefs = hrefsFromEntry(entry);
    const hasPost = entryHrefs.some((h) => shortcodeFromHref(h));

    if (headerOnly && !hasPost) {
      currentCollection = headerOnly;
    }

    const smd = entry?.string_map_data || {};
    const nameField = smd.Name || smd.name || smd.Collection || smd.collection;

    if (nameField) {
      const hasHref = 'href' in nameField && nameField.href != null && nameField.href !== '';
      const label = decodeFolderLabel(nameField.value) || '';

      if (!hasHref) {
        const folder = normalizeFolderName(label);
        if (folder) currentCollection = folder;
      } else {
        const postSc = shortcodeFromHref(nameField.href);
        if (postSc && currentCollection) {
          addToMap(map, postSc, currentCollection);
        } else {
          const savedSlug = folderSlugFromSavedHref(nameField.href);
          if (savedSlug && !postSc) {
            const folder = normalizeFolderName(label) || humanizeSlug(savedSlug);
            if (folder) currentCollection = folder;
          }
        }
      }
    }

    if (headerOnly && hasPost) {
      for (const href of entryHrefs) {
        const sc = shortcodeFromHref(href);
        if (sc) addToMap(map, sc, headerOnly);
      }
    } else if (currentCollection && hasPost && !nameField) {
      for (const href of entryHrefs) {
        const sc = shortcodeFromHref(href);
        if (sc) addToMap(map, sc, currentCollection);
      }
    }
  }

  return finalizeMap(map);
}

/** Per-post collection tags inside saved_posts.json saved_saved_media entries. */
function parseCollectionsFromSavedPosts(raw) {
  const map = {};
  const items = raw?.saved_saved_media || raw?.saves_media || raw?.saved_media || [];
  if (!Array.isArray(items)) return map;

  for (const entry of items) {
    const smd = entry?.string_map_data || {};
    const savedOn = smd['Saved on'] || smd['Saved On'] || smd['Saved On Date'];
    const href = savedOn?.href || entry?.href || entry?.uri;
    const sc = shortcodeFromHref(href);
    if (!sc) continue;

    for (const [key, val] of Object.entries(smd)) {
      if (COLLECTION_FIELD_RE.test(key) && val?.value) {
        addToMap(map, sc, val.value);
      }
    }

    for (const lv of entry?.label_values || []) {
      const label = lv?.label || '';
      if (COLLECTION_FIELD_RE.test(label) && lv?.value) {
        addToMap(map, sc, lv.value);
      }
    }

    if (Array.isArray(entry?.collections)) {
      for (const c of entry.collections) {
        if (typeof c === 'string') addToMap(map, sc, c);
        else if (c?.name) addToMap(map, sc, c.name);
        else if (c?.title) addToMap(map, sc, c.title);
      }
    }
  }

  return finalizeMap(map);
}

/** Newer exports: saved_items_and_collections/your_saved_items.json */
function parseYourSavedItemsExport(raw) {
  const map = {};

  const walk = (node, collectionHint = null) => {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item, collectionHint);
      return;
    }

    const name =
      normalizeFolderName(node.collection_name)
      || normalizeFolderName(node.collectionName)
      || normalizeFolderName(node.name)
      || normalizeFolderName(node.title)
      || collectionHint;

    const hrefs = hrefsFromEntry(node);
    const postSc = hrefs.map(shortcodeFromHref).find(Boolean);

    if (postSc && name) {
      addToMap(map, postSc, name);
    }

    if (node.items) walk(node.items, name || collectionHint);
    if (node.saved_items) walk(node.saved_items, name || collectionHint);
    if (node.collections) walk(node.collections, collectionHint);
    if (node.media) walk(node.media, name || collectionHint);

    for (const val of Object.values(node)) {
      if (val && typeof val === 'object') walk(val, name || collectionHint);
    }
  };

  walk(raw);
  return finalizeMap(map);
}

/** Find every saved_saved_collections array nested anywhere in the export JSON. */
export function findCollectionEntryArrays(raw, found = []) {
  if (!raw || typeof raw !== 'object') return found;

  if (Array.isArray(raw)) {
    for (const item of raw) findCollectionEntryArrays(item, found);
    return found;
  }

  for (const [key, val] of Object.entries(raw)) {
    if (
      (key === 'saved_saved_collections' || key === 'saved_collections')
      && Array.isArray(val)
      && val.length > 0
    ) {
      found.push(val);
    } else if (val && typeof val === 'object') {
      findCollectionEntryArrays(val, found);
    }
  }

  return found;
}

/**
 * @param {unknown} raw Parsed JSON from any Instagram export file
 * @returns {Record<string, string[]>} shortcode → collection names
 */
export function parseSavedCollectionsFromExport(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const maps = [];

  const topEntries =
    raw.saved_saved_collections
    || raw.saved_collections
    || raw.collections
    || (Array.isArray(raw) ? raw : null);

  if (Array.isArray(topEntries) && topEntries.length > 0) {
    maps.push(parseGroupedCollections(topEntries));
    maps.push(parseFlatCollections(topEntries));
  }

  for (const arr of findCollectionEntryArrays(raw)) {
    if (arr === topEntries) continue;
    maps.push(parseGroupedCollections(arr));
    maps.push(parseFlatCollections(arr));
  }

  maps.push(parseCollectionsFromSavedPosts(raw));
  maps.push(parseYourSavedItemsExport(raw));

  return mergeCollectionMaps(...maps);
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
      const name = decodeFolderLabel(
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
      const title = normalizeFolderName(decodeFolderLabel(JSON.parse(`"${sections[i]}"`)));
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
  return folderNamesFromMap(map).length;
}

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
    || lower.includes('saved_items')
    || lower.includes('your_saved_items')
    || /\/saved\/saved_collection/.test(lower)
  );
}

export function isSavedPostsJsonPath(path) {
  return (path || '').toLowerCase().includes('saved_posts');
}

/** Which ZIP JSON paths likely contain folder data (for import diagnostics). */
export function classifyExportJsonPath(path) {
  const lower = (path || '').toLowerCase();
  if (isCollectionsJsonPath(path)) return 'collections';
  if (isSavedPostsJsonPath(path)) return 'saved_posts';
  if (lower.includes('saved/') || lower.includes('/saved')) return 'saved_other';
  return 'other';
}
