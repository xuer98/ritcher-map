-- Marker popularity: how many times players have opened this marker.
-- Incremented by POST /api/v1/markers/{id}/click (public); powers the
-- webapp's popularity filter. IF NOT EXISTS so an out-of-band apply
-- (psql before the deploy) stays compatible with Flyway.
ALTER TABLE markers ADD COLUMN IF NOT EXISTS click_count bigint NOT NULL DEFAULT 0;
