package com.ritchermap.catalog.domain;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Per-game marker grouping, shared across every map of the game. Keyed by
 * {@code gameSlug} (matching {@link GameMap#getGameSlug()}); supports one level
 * of nesting via {@code parentId} so editors can build "Bosses > Field Bosses".
 */
@Entity
@Table(
        name = "categories",
        uniqueConstraints = @UniqueConstraint(name = "uq_categories_game_slug", columnNames = {"game_slug", "slug"})
)
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_slug", nullable = false)
    private String gameSlug;

    @Column(name = "parent_id")
    private Long parentId;

    @Column(nullable = false)
    private String slug;

    @Column(nullable = false)
    private String name;

    private String icon;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    /**
     * Trackable categories (the default) render on the map by default and their
     * markers count toward discovery progress. A non-trackable category is an
     * informational overlay: hidden by default and excluded from progress.
     */
    @Column(nullable = false)
    private boolean trackable = true;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false)
    private Instant updatedAt;

    protected Category() {}

    public Category(String gameSlug, String slug, String name) {
        this.gameSlug = gameSlug;
        this.slug = slug;
        this.name = name;
    }

    public Long getId() { return id; }
    public String getGameSlug() { return gameSlug; }
    public Long getParentId() { return parentId; }
    public String getSlug() { return slug; }
    public String getName() { return name; }
    public String getIcon() { return icon; }
    public int getSortOrder() { return sortOrder; }
    public boolean isTrackable() { return trackable; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void update(String name, String icon, int sortOrder, Long parentId, boolean trackable) {
        this.name = name;
        this.icon = icon;
        this.sortOrder = sortOrder;
        this.parentId = parentId;
        this.trackable = trackable;
    }
}
