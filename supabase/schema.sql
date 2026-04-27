-- SaveAtlas Database Schema
-- Run this in your Supabase SQL editor

-- Users table (for multi-user support later)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE,
  instagram_username TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- The core saves table
CREATE TABLE IF NOT EXISTS saves (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  instagram_id    TEXT NOT NULL,
  username        TEXT,
  caption         TEXT,
  media_type      TEXT CHECK (media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL')),
  thumbnail_url   TEXT,
  video_url       TEXT,
  hashtags        TEXT[]    DEFAULT '{}',
  likes           INTEGER   DEFAULT 0,
  location        TEXT,
  permalink       TEXT,
  timestamp       TIMESTAMPTZ,

  -- AI categorization fields
  ai_category     TEXT,
  ai_subcategory  TEXT,
  ai_tags         TEXT[]    DEFAULT '{}',
  ai_materials    TEXT[]    DEFAULT '{}',
  ai_style        TEXT,
  ai_confidence   FLOAT,
  ai_processed    BOOLEAN   DEFAULT FALSE,
  ai_processed_at TIMESTAMPTZ,

  synced_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (instagram_id, user_id)
);

-- Index for fast search and filtering
CREATE INDEX IF NOT EXISTS idx_saves_user_id        ON saves (user_id);
CREATE INDEX IF NOT EXISTS idx_saves_instagram_id   ON saves (instagram_id);
CREATE INDEX IF NOT EXISTS idx_saves_ai_category    ON saves (ai_category);
CREATE INDEX IF NOT EXISTS idx_saves_ai_processed   ON saves (ai_processed);
CREATE INDEX IF NOT EXISTS idx_saves_timestamp      ON saves (timestamp DESC);

-- Full-text search index (search by caption + ai_tags)
CREATE INDEX IF NOT EXISTS idx_saves_fts ON saves
  USING gin(to_tsvector('english', coalesce(caption, '') || ' ' || coalesce(ai_category, '') || ' ' || coalesce(ai_style, '')));

-- Sync sessions — track each extension sync event for audit/debugging
CREATE TABLE IF NOT EXISTS sync_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id),
  saves_count  INTEGER DEFAULT 0,
  new_saves    INTEGER DEFAULT 0,
  source       TEXT DEFAULT 'extension',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Anonymous/default user for single-user mode (no auth yet)
INSERT INTO users (id, instagram_username)
VALUES ('00000000-0000-0000-0000-000000000001', 'default')
ON CONFLICT DO NOTHING;

-- Row Level Security (enable when adding auth later)
-- ALTER TABLE saves ENABLE ROW LEVEL SECURITY;
