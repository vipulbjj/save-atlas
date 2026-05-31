/**
 * OpenAI text embeddings for semantic search over post text.
 * Requires OPENAI_API_KEY and pgvector column on saves (see supabase/semantic_search.sql).
 */

const MODEL = 'text-embedding-3-small';
const DIM = 1536;

export function isEmbeddingsConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function embeddingDimensions() {
  return DIM;
}

async function callEmbeddingsApi(inputs) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not configured');

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, input: inputs }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embeddings API error (${res.status}): ${err.slice(0, 200)}`);
  }

  const json = await res.json();
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((row) => row.embedding);
}

export async function embedText(text) {
  if (!text?.trim()) return null;
  const [embedding] = await callEmbeddingsApi([text.slice(0, 8000)]);
  return embedding ?? null;
}

/** @param {string[]} texts */
export async function embedTexts(texts) {
  const cleaned = texts.map((t) => (t || '').slice(0, 8000));
  if (cleaned.length === 0) return [];
  return callEmbeddingsApi(cleaned);
}
