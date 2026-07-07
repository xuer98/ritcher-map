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

    /** One row of the per-map popularity rollup. */
    interface MapClicks {
        long getMapId();
        long getClicks();
    }

    /**
     * Popularity rollup: total marker clicks per map, one aggregate query for
     * the whole catalog (the map list is small; no per-map fan-out). Maps with
     * no markers have no row — callers treat missing as 0.
     */
    @Query("SELECT m.mapId AS mapId, SUM(m.clickCount) AS clicks FROM Marker m GROUP BY m.mapId")
    List<MapClicks> sumClickCountByMap();

    @Query("SELECT COALESCE(SUM(m.clickCount), 0) FROM Marker m WHERE m.mapId = :mapId")
    long sumClickCountForMap(@Param("mapId") long mapId);
}