-- Semantic search for SaveAtlas (run once in Supabase SQL editor)
-- Enables vector similarity search over post text embeddings.

create extension if not exists vector;

alter table saves
  add column if not exists search_text text,
  add column if not exists caption_embedding vector(1536);

-- Backfill search_text from existing captions (safe to re-run)
update saves
set search_text = trim(
  coalesce(caption, '') || ' ' ||
  coalesce(
    (select string_agg(replace(h, '#', ''), ' ')
     from unnest(hashtags) as h),
    ''
  )
)
where search_text is null and caption is not null;

create index if not exists idx_saves_caption_embedding
  on saves using hnsw (caption_embedding vector_cosine_ops);

create index if not exists idx_saves_search_text_fts
  on saves using gin(to_tsvector('english', coalesce(search_text, '')));

-- Match saves by embedding similarity (caption indexed as search_text)
create or replace function match_saves(
  query_embedding vector(1536),
  match_user_id uuid,
  match_category text default null,
  match_subcategory text default null,
  match_media_type text default null,
  match_count int default 50,
  match_offset int default 0,
  match_threshold float default 0.32
)
returns table (
  id uuid,
  similarity float,
  total_count bigint
)
language sql
stable
as $$
  with ranked as (
    select
      s.id,
      (1 - (s.caption_embedding <=> query_embedding))::float as similarity
    from saves s
    where s.user_id = match_user_id
      and s.caption_embedding is not null
      and (match_category is null or s.ai_category = match_category)
      and (match_subcategory is null or s.ai_subcategory = match_subcategory)
      and (match_media_type is null or s.media_type = match_media_type)
      and (1 - (s.caption_embedding <=> query_embedding)) > match_threshold
    order by s.caption_embedding <=> query_embedding
  )
  select
    ranked.id,
    ranked.similarity,
    count(*) over() as total_count
  from ranked
  limit match_count
  offset match_offset;
$$;
