package com.ritchermap.catalog.repo;

import com.ritchermap.catalog.domain.Region;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RegionRepository extends JpaRepository<Region, Long> {
    List<Region> findAllByMapIdOrderBySortOrderAscNameAsc(Long mapId);
    long countByMapId(Long mapId);
}
