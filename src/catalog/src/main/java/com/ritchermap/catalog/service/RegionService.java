package com.ritchermap.catalog.service;

import com.ritchermap.catalog.domain.Region;
import com.ritchermap.catalog.error.NotFoundException;
import com.ritchermap.catalog.repo.MapRepository;
import com.ritchermap.catalog.repo.RegionRepository;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Polygon;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class RegionService {

    /** SRID 0 = no CRS (pixel space), matching markers. */
    private static final GeometryFactory GEOM = new GeometryFactory(new PrecisionModel(), 0);

    private final RegionRepository regions;
    private final MapRepository maps;

    public RegionService(RegionRepository regions, MapRepository maps) {
        this.regions = regions;
        this.maps = maps;
    }

    /**
     * Build a SRID-0 polygon from an exterior ring of {@code [x, y]} pairs.
     * The ring is auto-closed (first point appended) if the caller didn't close
     * it. Throws on fewer than 3 distinct vertices.
     */
    static Polygon polygon(List<List<Double>> ring) {
        if (ring == null || ring.size() < 3) {
            throw new IllegalArgumentException("region polygon needs at least 3 points");
        }
        List<Coordinate> coords = new ArrayList<>(ring.size() + 1);
        for (List<Double> pt : ring) {
            if (pt == null || pt.size() < 2 || pt.get(0) == null || pt.get(1) == null) {
                throw new IllegalArgumentException("region polygon point must be [x, y]");
            }
            coords.add(new Coordinate(pt.get(0), pt.get(1)));
        }
        Coordinate first = coords.get(0);
        Coordinate last = coords.get(coords.size() - 1);
        if (!first.equals2D(last)) coords.add(new Coordinate(first));
        Polygon p = GEOM.createPolygon(coords.toArray(new Coordinate[0]));
        p.setSRID(0);
        return p;
    }

    private void requireMap(long mapId) {
        if (!maps.existsById(mapId)) throw NotFoundException.of("map", mapId);
    }

    @Transactional(readOnly = true)
    public List<Region> list(long mapId) {
        requireMap(mapId);
        return regions.findAllByMapIdOrderBySortOrderAscNameAsc(mapId);
    }

    @Transactional
    public Region create(long mapId, String name, int sortOrder, List<List<Double>> ring) {
        requireMap(mapId);
        return regions.save(new Region(mapId, name.strip(), Math.max(0, sortOrder), polygon(ring)));
    }

    @Transactional
    public Region update(long id, String name, Integer sortOrder, List<List<Double>> ring) {
        Region r = regions.findById(id).orElseThrow(() -> NotFoundException.of("region", id));
        String newName = (name != null && !name.isBlank()) ? name.strip() : r.getName();
        int newOrder = sortOrder != null ? Math.max(0, sortOrder) : r.getSortOrder();
        Polygon newGeom = ring != null ? polygon(ring) : r.getGeom();
        r.update(newName, newOrder, newGeom);
        return r;
    }

    @Transactional
    public void delete(long id) {
        if (!regions.existsById(id)) throw NotFoundException.of("region", id);
        regions.deleteById(id);
    }

    /** Bulk-create regions (map seeding). Regions are low-cardinality, so plain saveAll. */
    @Transactional
    public int bulkImport(long mapId, List<BulkRegion> rows) {
        requireMap(mapId);
        List<Region> entities = rows.stream()
                .map(r -> new Region(mapId, r.name().strip(), Math.max(0, r.sortOrder()), polygon(r.polygon())))
                .toList();
        regions.saveAll(entities);
        return entities.size();
    }

    /** Flat bulk-import row. */
    public record BulkRegion(String name, int sortOrder, List<List<Double>> polygon) {}
}
