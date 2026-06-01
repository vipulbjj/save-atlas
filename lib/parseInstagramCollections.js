/**
 * Parse Instagram data-export "saved collections" JSON into shortcode → folder names.
 * Supports legacy flat saved_saved_collections and 2025 grouped string_list_data.
 */

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

function addToMap(map, shortcode, collectionName) {
  if (!shortcode || !collectionName) return;
  const name = collectionName.trim();
  if (!name) return;
  if (!map[shortcode]) map[shortcode] = new Set();
  map[shortcode].add(name);
}

function finalizeMap(map) {
  return Object.fromEntries(
    Object.entries(map).map(([sc, set]) => [sc, [...set]]),
  );
}

function parseGroupedCollections(entries) {
  const map = {};
  for (const entry of entries) {
    const collectionName =
      fixEncoding(entry.title)
      || fixEncoding(entry.name)
      || fixEncoding(entry.label)
      || '';
    if (!collectionName) continue;

    for (const item of entry.string_list_data || []) {
      const sc = shortcodeFromHref(item?.href);
      if (sc) addToMap(map, sc, collectionName);
    }

    // Some exports nest posts under string_map_data on grouped entries
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

function parseFlatCollections(entries) {
  const map = {};
  let currentCollection = null;

  for (const entry of entries) {
    const smd = entry?.string_map_data || {};
    const nameField = smd.Name || smd.name || smd.Title || smd.title;
    const href = nameField?.href ?? entry?.href ?? entry?.uri ?? null;
    const label =
      fixEncoding(nameField?.value)
      || fixEncoding(entry?.title)
      || fixEncoding(entry?.name)
      || '';

    // Collection header: name only, no post URL
    if (href == null || href === '') {
      if (label) currentCollection = label;
      continue;
    }

    const shortcode = shortcodeFromHref(href);
    if (shortcode && currentCollection) {
      addToMap(map, shortcode, currentCollection);
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

  // 2025+: [{ title: "Folder", string_list_data: [{ href, ... }] }]
  if (entries.some((e) => Array.isArray(e?.string_list_data))) {
    return parseGroupedCollections(entries);
  }

  return parseFlatCollections(entries);
}

/** Regex fallback when JSON keys differ but URLs + folder names are present. */
export function parseCollectionsFromText(text) {
  const map = {};
  let currentCollection = null;

  // Flat export: "Name":{"value":"Folder"} without href, then href on next row
  const flatPattern =
    /"Name"\s*:\s*\{([^}]*)\}/g;
  let m;
  while ((m = flatPattern.exec(text)) !== null) {
    const block = m[1];
    const hrefMatch = block.match(/"href"\s*:\s*"([^"]+)"/);
    const valueMatch = block.match(/"value"\s*:\s*"([^"]*)"/);
    if (hrefMatch) {
      const sc = shortcodeFromHref(hrefMatch[1]);
      if (sc && currentCollection) addToMap(map, sc, currentCollection);
    } else if (valueMatch) {
      const name = fixEncoding(valueMatch[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
        String.fromCharCode(parseInt(h, 16)),
      ));
      if (name) currentCollection = name;
    }
  }

  // Grouped export: "title":"Folder" ... "href":"instagram.com/..."
  const titlePattern = /"title"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  const sections = text.split(titlePattern);
  for (let i = 1; i < sections.length; i += 2) {
    const title = fixEncoding(JSON.parse(`"${sections[i]}"`));
    const body = sections[i + 1] || '';
    const hrefRe = /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/g;
    let hm;
    while ((hm = hrefRe.exec(body)) !== null) {
      addToMap(map, hm[1], title);
    }
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
    for (const n of list) names.add(n);
  }
  return names.size;
}
