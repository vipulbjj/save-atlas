/**
 * SaveAtlas Extension — Content Script v2
 *
 * Strategy: Intercept ALL Instagram fetch/XHR calls, then inspect the
 * response shape for saved-post data. Instagram's URL patterns change
 * often; the response shape is more stable.
 */

(function () {
  'use strict';

  // ── Fetch Interceptor ──────────────────────────────────────────────────────

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');

      // Intercept any Instagram internal API or GraphQL call
      const isRelevant =
        url.includes('instagram.com') ||
        url.includes('/api/v1/') ||
        url.includes('/graphql/query') ||
        url.includes('/graphql/') ||
        url.includes('graph.instagram.com');

      if (isRelevant) {
        const clone = response.clone();
        clone.json().then((data) => {
          const posts = extractSavedPosts(data, url);
          if (posts.length > 0) {
            console.log(`[SaveAtlas] Found ${posts.length} saved posts from:`, url);
            chrome.runtime.sendMessage({
              type: 'SAVES_INTERCEPTED',
              payload: posts,
            });
          }
        }).catch(() => {});
      }
    } catch (e) {
      // Never break Instagram's own functionality
    }

    return response;
  };

  // ── XHR Interceptor ───────────────────────────────────────────────────────

  const XHROpen = XMLHttpRequest.prototype.open;
  const XHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._saveAtlasUrl = url;
    return XHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        const url = this._saveAtlasUrl || '';
        const isRelevant =
          url.includes('/api/v1/') ||
          url.includes('/graphql/') ||
          url.includes('instagram.com');

        if (isRelevant) {
          const data = JSON.parse(this.responseText);
          const posts = extractSavedPosts(data, url);
          if (posts.length > 0) {
            console.log(`[SaveAtlas XHR] Found ${posts.length} saved posts from:`, url);
            chrome.runtime.sendMessage({
              type: 'SAVES_INTERCEPTED',
              payload: posts,
            });
          }
        }
      } catch (e) {}
    });

    return XHRSend.apply(this, args);
  };

  // ── Response Shape Detection ───────────────────────────────────────────────

  /**
   * Try every known Instagram response shape to extract saved post data.
   * Returns an array of normalized save objects (empty if none found).
   */
  function extractSavedPosts(data, url) {
    const posts = [];

    // ── Shape 1: v1 feed/saved — { items: [...] }
    if (Array.isArray(data?.items) && data.items.length > 0) {
      const first = data.items[0];
      // Verify it looks like a media object (has media_type or pk)
      if (first?.media_type !== undefined || first?.pk !== undefined) {
        for (const item of data.items) {
          const n = normalizeV1(item);
          if (n) posts.push(n);
        }
      }
    }

    // ── Shape 2: GraphQL legacy — { data: { user: { edge_saved_media: { edges } } } }
    const edges1 = data?.data?.user?.edge_saved_media?.edges;
    if (Array.isArray(edges1)) {
      for (const edge of edges1) {
        const n = normalizeGraphQL(edge?.node);
        if (n) posts.push(n);
      }
    }

    // ── Shape 3: GraphQL newer — { data: { xdt_api__v1__feed__saved__posts__connection: { edges } } }
    const xdtEdges = data?.data?.xdt_api__v1__feed__saved__posts__connection?.edges;
    if (Array.isArray(xdtEdges)) {
      for (const edge of xdtEdges) {
        const node = edge?.node;
        if (node) {
          const n = normalizeV1(node) || normalizeGraphQL(node);
          if (n) posts.push(n);
        }
      }
    }

    // ── Shape 4: Bloks / newer API — look for nested media arrays
    const bloksSaves = findSavedMediaInBloks(data);
    for (const item of bloksSaves) {
      const n = normalizeV1(item) || normalizeGraphQL(item);
      if (n) posts.push(n);
    }

    // ── Shape 5: Any top-level response with a 'media' key and saved indicator
    if (data?.media && (data?.collection_type === 'ALL_MEDIA_AUTO_COLLECTION' || url.includes('saved'))) {
      const n = normalizeV1(data.media);
      if (n) posts.push(n);
    }

    return posts;
  }

  /**
   * Recursively walk a bloks/newer API response to find media arrays
   * that look like saved posts
   */
  function findSavedMediaInBloks(obj, depth = 0) {
    const results = [];
    if (depth > 8 || !obj || typeof obj !== 'object') return results;

    // Look for arrays that contain media-like objects
    for (const key of Object.keys(obj)) {
      const val = obj[key];

      if (Array.isArray(val)) {
        for (const item of val) {
          if (item && typeof item === 'object') {
            // Does it look like an Instagram media item?
            if (
              (item.pk || item.id) &&
              (item.media_type !== undefined || item.image_versions2 || item.carousel_media)
            ) {
              results.push(item);
            }
            // Recurse into nested objects
            results.push(...findSavedMediaInBloks(item, depth + 1));
          }
        }
      } else if (val && typeof val === 'object') {
        results.push(...findSavedMediaInBloks(val, depth + 1));
      }
    }

    return results;
  }

  // ── Normalizers ────────────────────────────────────────────────────────────

  function normalizeV1(item) {
    if (!item) return null;
    const id = item.id || item.pk;
    if (!id) return null;

    return {
      instagram_id: String(id),
      username: item.user?.username || item.owner?.username || null,
      caption: item.caption?.text || null,
      media_type: item.media_type === 1 ? 'IMAGE' : item.media_type === 2 ? 'VIDEO' : item.media_type === 8 ? 'CAROUSEL' : 'IMAGE',
      thumbnail_url: getBestImageUrl(item),
      video_url: item.video_versions?.[0]?.url || null,
      hashtags: extractHashtags(item.caption?.text || ''),
      timestamp: item.taken_at ? new Date(item.taken_at * 1000).toISOString() : new Date().toISOString(),
      location: item.location?.name || null,
      likes: item.like_count || 0,
      permalink: `https://www.instagram.com/p/${item.code || item.shortcode || id}/`,
    };
  }

  function normalizeGraphQL(node) {
    if (!node?.id) return null;

    return {
      instagram_id: String(node.id),
      username: node.owner?.username || null,
      caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || null,
      media_type: node.__typename === 'GraphVideo' ? 'VIDEO' : 'IMAGE',
      thumbnail_url: node.thumbnail_src || node.display_url || null,
      video_url: node.video_url || null,
      hashtags: extractHashtags(node.edge_media_to_caption?.edges?.[0]?.node?.text || ''),
      timestamp: node.taken_at_timestamp
        ? new Date(node.taken_at_timestamp * 1000).toISOString()
        : new Date().toISOString(),
      location: null,
      likes: node.edge_liked_by?.count || node.like_count || 0,
      permalink: `https://www.instagram.com/p/${node.shortcode || node.id}/`,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getBestImageUrl(item) {
    if (item.image_versions2?.candidates?.length > 0) {
      return item.image_versions2.candidates[0].url;
    }
    if (item.carousel_media?.[0]?.image_versions2?.candidates?.length > 0) {
      return item.carousel_media[0].image_versions2.candidates[0].url;
    }
    return null;
  }

  function extractHashtags(text) {
    if (!text) return [];
    return (text.match(/#[a-zA-Z0-9_]+/g) || []).map((h) => h.toLowerCase());
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY', url: window.location.href });
  console.log('[SaveAtlas] Content script v2 active — broad interception enabled.');

})();
