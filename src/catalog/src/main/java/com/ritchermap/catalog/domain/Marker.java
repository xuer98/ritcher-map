package com.ritchermap.catalog.domain;

import jakarta.persistence.*;
import org.locationtech.jts.geom.Point;

import java.time.Instant;

@Entity
@Table(name = "markers")
public class Marker {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "map_id", nullable = false)
    private Long mapId;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(nullable = false, columnDefinition = "geometry(Point,0)")
    private Point geom;

    /**
     * Popularity counter (player clicks). JPA never writes it — inserts take
     * the DB default (0) and increments go through an atomic native UPDATE in
     * the repository, so concurrent clicks can't lose counts to a stale flush.
     */
    @Column(name = "click_count", nullable = false, insertable = false, updatable = false)
    private long clickCount;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false)
    private Instant updatedAt;

    protected Marker() {}

    public Marker(Long mapId, Long categoryId, Point geom, String title, String description) {
        this.mapId = mapId;
        this.categoryId = categoryId;
        this.geom = geom;
        this.title = title;
        this.description = description;
    }

    public Long getId() { return id; }
    public Long getMapId() { return mapId; }
    public Long getCategoryId() { return categoryId; }
    public long getClickCount() { return clickCount; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public Point getGeom() { return geom; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void update(Long categoryId, Point geom, String title, String description) {
        this.categoryId = categoryId;
        this.geom = geom;
        this.title = title;
        this.description = description;
    }
}
