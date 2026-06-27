package com.ritchermap.catalog.service;

import com.ritchermap.catalog.domain.Category;
import com.ritchermap.catalog.error.ConflictException;
import com.ritchermap.catalog.error.NotFoundException;
import com.ritchermap.proto.catalog.v1.CatalogChanged;
import com.ritchermap.catalog.repo.CategoryRepository;
import com.ritchermap.catalog.repo.GameRepository;
import com.ritchermap.catalog.repo.MapRepository;
import com.ritchermap.catalog.repo.MarkerRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CategoryService {

    private final CategoryRepository categories;
    private final GameRepository games;
    private final MapRepository maps;
    private final MarkerRepository markers;
    private final ApplicationEventPublisher events;

    public CategoryService(CategoryRepository categories, GameRepository games,
                           MapRepository maps, MarkerRepository markers,
                           ApplicationEventPublisher events) {
        this.categories = categories;
        this.games = games;
        this.maps = maps;
        this.markers = markers;
        this.events = events;
    }

    /**
     * Categories are game-wide, so a change has no single map. The read service
     * treats KIND_CATEGORY as "no tile-cache impact" and only reads map_id for a
     * debug log, so we publish a sentinel 0 rather than fanning out per map.
     */
    private static CatalogChanged categoryChanged(CatalogChanged.Action action) {
        return CatalogChanged.newBuilder()
                .setMapId(0)
                .setKind(CatalogChanged.Kind.KIND_CATEGORY)
                .setAction(action)
                .build();
    }

    /** A game "exists" if it has a branding row or at least one map. */
    private void requireGame(String gameSlug) {
        if (!games.existsBySlug(gameSlug) && !maps.existsByGameSlug(gameSlug)) {
            throw NotFoundException.of("game", gameSlug);
        }
    }

    @Transactional(readOnly = true)
    public List<Category> list(String gameSlug) {
        requireGame(gameSlug);
        return categories.findAllByGameSlugOrderBySortOrderAscNameAsc(gameSlug);
    }

    @Transactional
    public Category create(String gameSlug, String slug, String name, String icon,
                           int sortOrder, Long parentId, boolean trackable) {
        requireGame(gameSlug);
        if (categories.existsByGameSlugAndSlug(gameSlug, slug)) {
            throw new ConflictException("category exists: " + slug);
        }
        if (parentId != null && !categories.existsById(parentId)) {
            throw NotFoundException.of("parent category", parentId);
        }
        Category c = new Category(gameSlug, slug, name);
        c.update(name, icon, sortOrder, parentId, trackable);
        Category saved = categories.save(c);
        events.publishEvent(categoryChanged(CatalogChanged.Action.ACTION_CREATED));
        return saved;
    }

    @Transactional
    public Category update(long id, String name, String icon, int sortOrder, Long parentId,
                           boolean trackable) {
        Category c = categories.findById(id)
                .orElseThrow(() -> NotFoundException.of("category", id));
        if (parentId != null && parentId.equals(id)) {
            throw new ConflictException("category cannot be its own parent");
        }
        c.update(name, icon, sortOrder, parentId, trackable);
        events.publishEvent(categoryChanged(CatalogChanged.Action.ACTION_UPDATED));
        return c;
    }

    /**
     * Refuse to delete a category that still has markers — referential integrity
     * is enforced at the DB level too ({@code ON DELETE RESTRICT}), but a clean
     * 409 with a count beats a generic constraint-violation 500.
     */
    @Transactional
    public void delete(long id) {
        Category c = categories.findById(id)
                .orElseThrow(() -> NotFoundException.of("category", id));
        long count = markers.countByCategoryId(id);
        if (count > 0) {
            throw new ConflictException(
                    "category has " + count + " markers; delete or reassign them first");
        }
        categories.deleteById(id);
        events.publishEvent(categoryChanged(CatalogChanged.Action.ACTION_DELETED));
    }
}
