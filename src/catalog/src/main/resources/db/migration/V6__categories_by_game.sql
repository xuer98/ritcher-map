-- ---------------------------------------------------------------------------
-- Categories move from map-scoped to game-scoped
-- ---------------------------------------------------------------------------
-- Previously a category belonged to one map (categories.map_id, UNIQUE(map_id,
-- slug)), so every map of a game re-declared its own "Chests"/"Bosses". They
-- now belong to the GAME and are shared across all its maps. We key by
-- game_slug (TEXT) to mirror how maps.game_slug links to games — no FK, since
-- a games row may not exist for every slug (see V3).
--
-- Markers are unchanged: they still carry map_id + category_id, and the Rust
-- read path keeps filtering on (map_id, category_id). Only the *ownership* of a
-- category changes.

ALTER TABLE categories ADD COLUMN game_slug TEXT;

-- Backfill each category's game from its owning map.
UPDATE categories c
SET game_slug = m.game_slug
FROM maps m
WHERE c.map_id = m.id;

-- Collapsing per-map categories into one set per game means the same
-- (game_slug, slug) can now appear once per map. Merge duplicates: keep the
-- lowest id as the survivor, repoint markers and child parent_id references to
-- it, then delete the rest. Each statement re-derives the survivor from the
-- (still unchanged) table, so ids are stable across the first two updates.

-- 1. Repoint markers off the duplicate categories.
WITH survivor AS (
    SELECT id, min(id) OVER (PARTITION BY game_slug, slug) AS keep_id
    FROM categories
)
UPDATE markers mk
SET category_id = s.keep_id
FROM survivor s
WHERE mk.category_id = s.id
  AND s.id <> s.keep_id;

-- 2. Repoint children whose parent was a duplicate onto the survivor parent.
WITH survivor AS (
    SELECT id, min(id) OVER (PARTITION BY game_slug, slug) AS keep_id
    FROM categories
)
UPDATE categories c
SET parent_id = s.keep_id
FROM survivor s
WHERE c.parent_id = s.id
  AND s.id <> s.keep_id;

-- 3. Delete the now-orphaned duplicates.
WITH survivor AS (
    SELECT id, min(id) OVER (PARTITION BY game_slug, slug) AS keep_id
    FROM categories
)
DELETE FROM categories c
USING survivor s
WHERE c.id = s.id
  AND s.id <> s.keep_id;

-- Guard the edge case where a repoint made a category its own parent.
UPDATE categories SET parent_id = NULL WHERE parent_id = id;

ALTER TABLE categories ALTER COLUMN game_slug SET NOT NULL;

-- Drop the old map linkage. Dropping the column cascades the FK to maps, the
-- UNIQUE(map_id, slug) constraint, and the (map_id) index that depend on it.
ALTER TABLE categories DROP COLUMN map_id CASCADE;

ALTER TABLE categories
    ADD CONSTRAINT uq_categories_game_slug UNIQUE (game_slug, slug);

CREATE INDEX categories_game_idx ON categories (game_slug);
