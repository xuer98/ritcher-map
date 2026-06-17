-- Named polygonal areas within a map (e.g. "Forest of Wolves", "Bamboo Grove").
-- Rendered as outlined/filled overlays in the viewer; clicking one zooms the
-- camera to fit its bounds. geom is a pixel-space polygon (SRID 0), same CRS as
-- markers. sort_order controls list order; ties broken by name.
CREATE TABLE regions (
    id          BIGSERIAL PRIMARY KEY,
    map_id      BIGINT     NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
    name        TEXT       NOT NULL,
    sort_order  INT        NOT NULL DEFAULT 0,
    geom        geometry(Polygon, 0) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX regions_geom_gix ON regions USING GIST (geom);
CREATE INDEX regions_map_idx  ON regions (map_id, sort_order);
