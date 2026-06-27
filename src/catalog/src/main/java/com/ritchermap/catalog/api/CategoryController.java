package com.ritchermap.catalog.api;

import com.ritchermap.catalog.api.Dtos.CategoryRequest;
import com.ritchermap.catalog.api.Dtos.CategoryResponse;
import com.ritchermap.catalog.service.CategoryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class CategoryController {

    private final CategoryService categories;

    public CategoryController(CategoryService categories) { this.categories = categories; }

    @GetMapping("/games/{gameSlug}/categories")
    public List<CategoryResponse> list(@PathVariable String gameSlug) {
        return categories.list(gameSlug).stream().map(CategoryResponse::from).toList();
    }

    @PostMapping("/games/{gameSlug}/categories")
    public ResponseEntity<CategoryResponse> create(
            @PathVariable String gameSlug,
            @Valid @RequestBody CategoryRequest req) {
        var saved = categories.create(gameSlug, req.slug(), req.name(), req.icon(),
                req.sortOrder(), req.parentId(), trackable(req));
        return ResponseEntity
                .created(URI.create("/api/v1/categories/" + saved.getId()))
                .body(CategoryResponse.from(saved));
    }

    @PutMapping("/categories/{id}")
    public CategoryResponse update(@PathVariable long id, @Valid @RequestBody CategoryRequest req) {
        var c = categories.update(id, req.name(), req.icon(), req.sortOrder(),
                req.parentId(), trackable(req));
        return CategoryResponse.from(c);
    }

    /** Trackable is nullable on the wire; omitted defaults to true. */
    private static boolean trackable(CategoryRequest req) {
        return req.trackable() == null || req.trackable();
    }

    @DeleteMapping("/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        categories.delete(id);
    }
}
