-- ---------------------------------------------------------------------------
-- Category "trackable" flag
-- ---------------------------------------------------------------------------
-- A trackable category (the default) renders on the map by default and its
-- markers count toward the player's discovery-progress total. A non-trackable
-- category is an informational / overlay layer: hidden on the map by default
-- (the player can still toggle it on) and excluded from discovery progress.
-- All existing categories are trackable.

ALTER TABLE categories
    ADD COLUMN trackable BOOLEAN NOT NULL DEFAULT true;
