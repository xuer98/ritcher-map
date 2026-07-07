package com.ritchermap.catalog.api;

import com.ritchermap.catalog.domain.Category;
import com.ritchermap.catalog.domain.Game;
import com.ritchermap.catalog.domain.GameMap;
import com.ritchermap.catalog.domain.Marker;
import com.ritchermap.catalog.domain.MapStatus;
import com.ritchermap.catalog.domain.Region;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

/**
 * Wire DTOs for the catalog API. Records throughout — they're immutable,
 * pattern-match-friendly, and Jackson handles them natively.
 *
 * <p>Entities are deliberately not exposed; conversion happens here in static
 * {@code from(...)} methods. This keeps lazy-loading and Hibernate proxy
 * concerns inside the persistence layer.
 */
public final class Dtos {
    private Dtos() {}

    // ---------- Map ----------

    public record CreateMapRequest(
            @NotBlank @Pattern(regexp = "[a-z0-9-]+") @Size(max = 60) String gameSlug,
            @NotBlank @Pattern(regexp = "[a-z0-9-]+") @Size(max = 60) String mapSlug,
            @NotBlank @Size(max = 200) String name
    ) {}

    /** Editor edit: all fields optional — only the present ones are applied. */
    public record UpdateMapRequest(
            @Size(max = 200) String name,
            @PositiveOrZero Integer minZoom,
            @PositiveOrZero Integer sortOrder
    ) {}

    public record RequestTilingRequest(
            @NotBlank String sourceBucket,
            @NotBlank String sourceKey,
            String format     // optional; defaults to webp
    ) {}

    /**
     * Editor uploaded a pre-built {@code {z}/{x}/{y}} pyramid straight to tile
     * storage (no source image to tile). Carries the dimensions the worker
     * would otherwise have computed so the map can go READY directly.
     */
    public record MarkImportedRequest(
            @NotNull @Positive Long width,
            @NotNull @Positive Long height,
            @NotNull @PositiveOrZero Integer maxZoom,
            @PositiveOrZero Integer minZoom,   // optional; defaults to 0
            @Positive Integer tileSize,        // optional; defaults to 256
            String format                      // optional; defaults to webp
    ) {}

    /**
     * {@code popularity} is the map's total marker clicks (see V8), aggregated
     * on the read endpoints (list/get) to power the webapp's Popular sort.
     * Write-path echoes (create/update/tiling) report 0 rather than paying the
     * aggregate query — the admin console doesn't display it.
     */
    public record MapResponse(
            long id,
            String gameSlug,
            String mapSlug,
            String name,
            String prefix,
            MapStatus status,
            Long width,
            Long height,
            Integer maxZoom,
            int minZoom,
            int sortOrder,
            int tileSize,
            String format,
            Instant createdAt,
            Instant updatedAt,
            long popularity
    ) {
        public static MapResponse from(GameMap m) {
            return from(m, 0L);
        }

        public static MapResponse from(GameMap m, long popularity) {
            return new MapResponse(
                    m.getId(), m.getGameSlug(), m.getMapSlug(), m.getName(), m.getPrefix(),
                    m.getStatus(), m.getWidth(), m.getHeight(), m.getMaxZoom(),
                    m.getMinZoom(), m.getSortOrder(), m.getTileSize(), m.getFormat(),
                    m.getCreatedAt(), m.getUpdatedAt(), popularity
            );
        }
    }

    // ---------- Game ----------

    public record CreateGameRequest(
            @NotBlank @Pattern(regexp = "[a-z0-9-]+") @Size(max = 60) String slug,
            @NotBlank @Size(max = 200) String title,
            @Size(max = 32) String primaryColor,
            @Size(max = 32) String accentColor,
            @Size(max = 120) String fontFamily,
            @Size(max = 500) String fontUrl,
            @Size(max = 500) String logoUrl,
            @Size(max = 500) String thumbnailUrl
    ) {}

    public record UpdateGameRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 32) String primaryColor,
            @Size(max = 32) String accentColor,
            @Size(max = 120) String fontFamily,
            @Size(max = 500) String fontUrl,
            @Size(max = 500) String logoUrl,
            @Size(max = 500) String thumbnailUrl
    ) {}

    public record GameResponse(
            Long id,
            String slug,
            String title,
            String primaryColor,
            String accentColor,
            String fontFamily,
            String fontUrl,
            String logoUrl,
            String thumbnailUrl,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static GameResponse from(Game g) {
            return new GameResponse(
                    g.getId(), g.getSlug(), g.getTitle(),
                    g.getPrimaryColor(), g.getAccentColor(), g.getFontFamily(),
                    g.getFontUrl(), g.getLogoUrl(), g.getThumbnailUrl(),
                    g.getCreatedAt(), g.getUpdatedAt()
            );
        }
    }

    // ---------- Category ----------

    public record CategoryRequest(
            @NotBlank @Pattern(regexp = "[a-z0-9-]+") @Size(max = 60) String slug,
            @NotBlank @Size(max = 200) String name,
            @Size(max = 200) String icon,
            int sortOrder,
            Long parentId,
            // Nullable on the wire: omitted -> defaults to true (a new category is
            // trackable unless the editor opts out). See CategoryController.
            Boolean trackable
    ) {}

    public record CategoryResponse(
            long id, String gameSlug, Long parentId,
            String slug, String name, String icon, int sortOrder, boolean trackable
    ) {
        public static CategoryResponse from(Category c) {
            return new CategoryResponse(
                    c.getId(), c.getGameSlug(), c.getParentId(),
                    c.getSlug(), c.getName(), c.getIcon(), c.getSortOrder(), c.isTrackable()
            );
        }
    }

    // ---------- Marker ----------

    public record MarkerRequest(
            @NotNull Long categoryId,
            @NotNull Double x,
            @NotNull Double y,
            @Size(max = 200) String title,
            // Markdown body (rich text + image/video embeds); generous cap.
            @Size(max = 50000) String description
    ) {}

    public record MarkerResponse(
            long id, long mapId, long categoryId,
            double x, double y,
            String title, String description,
            long clickCount
    ) {
        public static MarkerResponse from(Marker m) {
            return new MarkerResponse(
                    m.getId(), m.getMapId(), m.getCategoryId(),
                    m.getGeom().getX(), m.getGeom().getY(),
                    m.getTitle(), m.getDescription(),
                    m.getClickCount()
            );
        }
    }

    public record BulkImportRow(
            @NotNull Long categoryId,
            @NotNull Double x,
            @NotNull Double y,
            String title,
            String description
    ) {}

    public record BulkImportRequest(@NotNull List<BulkImportRow> markers) {}

    public record BulkImportResponse(int inserted) {}

    // ---------- Region ----------

    /** Exterior ring as `[[x, y], ...]` (pixel space); auto-closed server-side. */
    public record CreateRegionRequest(
            @NotBlank @Size(max = 200) String name,
            int sortOrder,
            @NotNull List<List<Double>> polygon
    ) {}

    /** Editor edit: all fields optional — only the present ones are applied. */
    public record UpdateRegionRequest(
            @Size(max = 200) String name,
            @PositiveOrZero Integer sortOrder,
            List<List<Double>> polygon
    ) {}

    public record RegionResponse(
            long id,
            long mapId,
            String name,
            int sortOrder,
            List<double[]> polygon,
            double[] bbox
    ) {
        public static RegionResponse from(Region r) {
            org.locationtech.jts.geom.Polygon g = r.getGeom();
            List<double[]> ring = new java.util.ArrayList<>();
            for (org.locationtech.jts.geom.Coordinate c : g.getExteriorRing().getCoordinates()) {
                ring.add(new double[] { c.x, c.y });
            }
            var env = g.getEnvelopeInternal();
            return new RegionResponse(
                    r.getId(), r.getMapId(), r.getName(), r.getSortOrder(),
                    ring,
                    new double[] { env.getMinX(), env.getMinY(), env.getMaxX(), env.getMaxY() }
            );
        }
    }

    public record RegionBulkRow(
            @NotBlank @Size(max = 200) String name,
            int sortOrder,
            @NotNull List<List<Double>> polygon
    ) {}

    public record RegionBulkImportRequest(@NotNull List<RegionBulkRow> regions) {}
}
