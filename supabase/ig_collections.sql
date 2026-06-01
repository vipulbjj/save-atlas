-- Instagram saved-collection folder names (from data export saved_collections.json)
ALTER TABLE saves
  ADD COLUMN IF NOT EXISTS ig_collections TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_saves_ig_collections
  ON saves USING gin (ig_collections);
