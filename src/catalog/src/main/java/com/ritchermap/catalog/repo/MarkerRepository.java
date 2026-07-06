package com.ritchermap.catalog.repo;

import com.ritchermap.catalog.domain.Marker;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MarkerRepository extends JpaRepository<Marker, Long>, MarkerRepositoryCustom {
    List<Marker> findAllByMapId(Long mapId);
    long countByMapId(Long mapId);
    long countByCategoryId(Long categoryId);

    @Modifying
    @Query("DELETE FROM Marker m WHERE m.mapId = :mapId")
    int deleteAllByMapId(@Param("mapId") Long mapId);

    /**
     * Popularity: +1 click, atomically in the database (the entity column is
     * read-only to JPA, so counts can't be lost to concurrent stale flushes).
     * Returns 0 when the marker doesn't exist.
     */
    @Modifying
    @Query(value = "UPDATE markers SET click_count = click_count + 1 WHERE id = :id",
           nativeQuery = true)
    int incrementClickCount(@Param("id") long id);
}