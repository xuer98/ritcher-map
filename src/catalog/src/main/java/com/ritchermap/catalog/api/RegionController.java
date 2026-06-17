package com.ritchermap.catalog.api;

import com.ritchermap.catalog.api.Dtos.CreateRegionRequest;
import com.ritchermap.catalog.api.Dtos.RegionBulkImportRequest;
import com.ritchermap.catalog.api.Dtos.RegionResponse;
import com.ritchermap.catalog.api.Dtos.UpdateRegionRequest;
import com.ritchermap.catalog.service.RegionService;
import com.ritchermap.catalog.service.RegionService.BulkRegion;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class RegionController {

    private final RegionService regions;

    public RegionController(RegionService regions) { this.regions = regions; }

    @GetMapping("/maps/{mapId}/regions")
    public List<RegionResponse> list(@PathVariable long mapId) {
        return regions.list(mapId).stream().map(RegionResponse::from).toList();
    }

    @PostMapping("/maps/{mapId}/regions")
    public ResponseEntity<RegionResponse> create(
            @PathVariable long mapId,
            @Valid @RequestBody CreateRegionRequest req) {
        var saved = regions.create(mapId, req.name(), req.sortOrder(), req.polygon());
        return ResponseEntity
                .created(URI.create("/api/v1/regions/" + saved.getId()))
                .body(RegionResponse.from(saved));
    }

    @PutMapping("/regions/{id}")
    public RegionResponse update(@PathVariable long id, @Valid @RequestBody UpdateRegionRequest req) {
        return RegionResponse.from(
                regions.update(id, req.name(), req.sortOrder(), req.polygon()));
    }

    @DeleteMapping("/regions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        regions.delete(id);
    }

    /** Bulk import — used when seeding a map from an extracted dataset. */
    @PostMapping("/maps/{mapId}/regions:bulk")
    public Dtos.BulkImportResponse bulk(@PathVariable long mapId,
                                        @Valid @RequestBody RegionBulkImportRequest req) {
        var rows = req.regions().stream()
                .map(r -> new BulkRegion(r.name(), r.sortOrder(), r.polygon()))
                .toList();
        int n = regions.bulkImport(mapId, rows);
        return new Dtos.BulkImportResponse(n);
    }
}
