package com.ritchermap.catalog.repo;

import com.ritchermap.catalog.domain.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    List<Category> findAllByGameSlugOrderBySortOrderAscNameAsc(String gameSlug);
    Optional<Category> findByGameSlugAndSlug(String gameSlug, String slug);
    boolean existsByGameSlugAndSlug(String gameSlug, String slug);
}

