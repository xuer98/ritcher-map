-- Per-game display order for maps. Controls the sequence maps appear in within
-- a game (game page map list, the in-map sibling switcher, admin). Ascending;
-- ties broken by name. Existing rows default to 0 (then alpha by name), so the
-- ordering only changes once an editor sets explicit values.
ALTER TABLE maps ADD COLUMN sort_order INT NOT NULL DEFAULT 0;

CREATE INDEX maps_game_order_idx ON maps (game_slug, sort_order);
