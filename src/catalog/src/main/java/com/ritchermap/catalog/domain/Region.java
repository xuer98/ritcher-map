package com.ritchermap.catalog.domain;

import jakarta.persistence.*;
import org.locationtech.jts.geom.Polygon;

import java.time.Instant;

/**
 * A named polygonal area within a map (e.g. "Forest of Wolves"). {@code geom} is
 * a pixel-space polygon (SRID 0), the same CRS as {@link Marker} points. The
 * viewer renders these as overlays and zooms to a region's bounds on click.
 */
@Entity
@Table(name = "regions")
public class Region {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "map_id", nullable = false)
    private Long mapId;

    @Column(nullable = false)
    private String name;

    /** Display order within the map (ascending; ties broken by name). */
    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false, columnDefinition = "geometry(Polygon,0)")
    private Polygon geom;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false)
    private Instant updatedAt;

    protected Region() {}

    public Region(Long mapId, String name, int sortOrder, Polygon geom) {
        this.mapId = mapId;
        this.name = name;
        this.sortOrder = sortOrder;
        this.geom = geom;
    }

    public Long getId() { return id; }
    public Long getMapId() { return mapId; }
    public String getName() { return name; }
    public int getSortOrder() { return sortOrder; }
    public Polygon getGeom() { return geom; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void update(String name, int sortOrder, Polygon geom) {
        this.name = name;
        this.sortOrder = sortOrder;
        this.geom = geom;
    }
}
