/**
 * Canonical text blob we embed for semantic search — caption + labels from the post.
 */

export function buildSearchText({ caption, hashtags, username } = {}) {
  const parts = [];

  if (caption?.trim()) {
    parts.push(caption.replace(/#([\w\u00C0-\u024F]+)/g, '$1'));
  }

  if (Array.isArray(hashtags) && hashtags.length > 0) {
    const tags = hashtags
      .map((h) => String(h).replace(/^#/, '').trim())
      .filter(Boolean);
    if (tags.length) parts.push(tags.join(' '));
  }

  if (username?.trim()) {
    parts.push(`@${username.replace(/^@/, '')}`);
  }

  return parts.join('\n').trim().slice(0, 8000);
}
