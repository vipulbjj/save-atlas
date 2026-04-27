/**
 * SaveAtlas Extension — Content Script
 * 
 * Injected into instagram.com at document_start.
 * Intercepts Instagram's internal fetch/XHR calls to capture saved post data.
 * Relays captured saves to the background service worker.
 */

(function () {
  'use strict';

  // Intercept fetch requests made by Instagram's own frontend
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

      // Instagram saved posts API endpoints
      const isSavedEndpoint =
        url.includes('/api/v1/feed/saved/posts/') ||
        url.includes('/api/v1/feed/saved/') ||
        (url.includes('/graphql/query') && url.includes('saved'));

      if (isSavedEndpoint) {
        const clone = response.clone();
        clone.json().then((data) => {
          const posts = extractPostsFromResponse(data);
          if (posts.length > 0) {
            chrome.runtime.sendMessage({
              type: 'SAVES_INTERCEPTED',
              payload: posts,
            });
          }
        }).catch(() => {});
      }
    } catch (e) {
      // Silently fail — never break Instagram's own functionality
    }

    return response;
  };

  // Also intercept XMLHttpRequest (older Instagram code paths)
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
        const isSavedEndpoint =
          url.includes('/api/v1/feed/saved/posts/') ||
          url.includes('/api/v1/feed/saved/');

        if (isSavedEndpoint) {
          const data = JSON.parse(this.responseText);
          const posts = extractPostsFromResponse(data);
          if (posts.length > 0) {
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

  /**
   * Normalize Instagram API response into a clean save object
   * Handles both v1 feed/saved and GraphQL response shapes
   */
  function extractPostsFromResponse(data) {
    const posts = [];

    // Shape: { items: [...] } — Instagram v1 API
    const items = data?.items || data?.data?.user?.edge_saved_media?.edges || [];

    const normalize = (item) => {
      // v1 API shape
      if (item?.media_type !== undefined) {
        return {
          instagram_id: item.id || item.pk,
          username: item.user?.username || item.owner?.username || null,
          caption: item.caption?.text || null,
          media_type: item.media_type === 1 ? 'IMAGE' : item.media_type === 2 ? 'VIDEO' : 'CAROUSEL',
          thumbnail_url: getBestImageUrl(item),
          video_url: item.video_versions?.[0]?.url || null,
          hashtags: extractHashtags(item.caption?.text || ''),
          timestamp: item.taken_at ? new Date(item.taken_at * 1000).toISOString() : new Date().toISOString(),
          location: item.location?.name || null,
          likes: item.like_count || 0,
          permalink: `https://www.instagram.com/p/${item.code || item.shortcode}/`,
          raw: item,
        };
      }

      // GraphQL shape
      const node = item?.node;
      if (node) {
        return {
          instagram_id: node.id,
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
          likes: node.edge_liked_by?.count || 0,
          permalink: `https://www.instagram.com/p/${node.shortcode}/`,
          raw: node,
        };
      }

      return null;
    };

    for (const item of items) {
      const normalized = normalize(item);
      if (normalized) posts.push(normalized);
    }

    return posts;
  }

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
    const matches = text.match(/#[a-zA-Z0-9_]+/g) || [];
    return matches.map((h) => h.toLowerCase());
  }

  // Notify background that the content script is alive
  chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY', url: window.location.href });

  console.log('[SaveAtlas] Content script active on Instagram.');
})();
