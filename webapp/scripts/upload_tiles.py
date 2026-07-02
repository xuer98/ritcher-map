#!/usr/bin/env python3
"""
upload_tiles.py — process a local tile pyramid and upload it straight to R2,
then mark the map READY. The local equivalent of the admin console's "Import
directly" button, minus the browser: no tab-memory ceiling, no 503 throttling,
rclone-driven uploads that overwrite existing tiles (--no-replace for an
incremental, resumable skip-if-identical pass instead).

Pipeline (mirrors the webapp's useDirectImport + pyramid logic):
  1. Scan a {z}/{y}/{x} (MapGenie / download_tiles.py default) or {z}/{x}/{y}
     tile folder and bucket by zoom.
  2. Normalize each level's coords to 0-based; optionally flip rows (TMS).
  3. Transcode every tile to WebP (or PNG) and pad partial edge tiles to a full
     square, so the served pyramid is uniform (MapLibre assumes square tiles).
     Output is written as {z}/{x}/{y}.<fmt> — transposed from a {z}/{y}/{x} input.
  4. rclone copy the processed pyramid to r2:<bucket>/<prefix>/.
  5. POST /api/v1/maps/<id>/imported so the map flips to READY.

Steps 4 and 5 are optional (--no-upload / --no-mark) so you can inspect the
staged output first.

Examples
--------
  # Process download_tiles.py output, upload, and mark map 7 READY.
  # --prefix is derived from the map when omitted (needs --gateway [+ --token]).
  python upload_tiles.py --src ./hyrule --map-id 7 \
      --gateway https://communist-bevvy-ritchermap-12836c60.koyeb.app \
      --token "$ADMIN_JWT"

  # Just stage + upload (no mark); input already in {z}/{x}/{y} order.
  python upload_tiles.py --src ./tiles --prefix hyrule --axis xy --no-mark

  # Stage only, to eyeball the result before uploading.
  python upload_tiles.py --src ./tiles --prefix hyrule --no-upload --no-mark \
      --out ./staged
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

try:
    import requests
except ImportError:  # only needed for --mark
    requests = None  # type: ignore

IMAGE_EXTS = {".png", ".webp", ".jpg", ".jpeg", ".gif"}
# Pillow save params per output format.
WEBP_QUALITY = 90


@dataclass
class Cell:
    z: int
    col: int
    row: int
    path: Path


@dataclass
class Level:
    z: int
    cells: list[Cell]
    cols: int
    rows: int


def ext_of(path: Path) -> str:
    """Normalized lowercase extension without the dot; jpeg -> jpg."""
    e = path.suffix.lower().lstrip(".")
    return "jpg" if e == "jpeg" else e


def parse_tiles(src: Path, axis: str) -> dict[int, list[Cell]]:
    """Walk `{z}/{a}/{b}.ext` tiles under `src`, bucketed by zoom.

    axis 'yx' (MapGenie / download_tiles.py default): a=row(y), b=col(x).
    axis 'xy': a=col(x), b=row(y).
    """
    by_zoom: dict[int, list[Cell]] = {}
    for z_dir in src.iterdir():
        if not z_dir.is_dir() or not z_dir.name.isdigit():
            continue
        z = int(z_dir.name)
        for a_dir in z_dir.iterdir():
            if not a_dir.is_dir() or not a_dir.name.isdigit():
                continue
            a = int(a_dir.name)
            for f in a_dir.iterdir():
                if f.suffix.lower() not in IMAGE_EXTS or not f.stem.isdigit():
                    continue
                b = int(f.stem)
                col, row = (b, a) if axis == "yx" else (a, b)
                by_zoom.setdefault(z, []).append(Cell(z, col, row, f))
    return by_zoom


def normalize_level(cells: list[Cell], flip_y: bool) -> Level:
    """Shift coords to start at (0,0); optionally flip rows (TMS)."""
    min_col = min(c.col for c in cells)
    min_row = min(c.row for c in cells)
    shifted = [Cell(c.z, c.col - min_col, c.row - min_row, c.path) for c in cells]
    cols = max(c.col for c in shifted) + 1
    rows = max(c.row for c in shifted) + 1
    if flip_y:
        shifted = [Cell(c.z, c.col, rows - 1 - c.row, c.path) for c in shifted]
    return Level(cells[0].z, shifted, cols, rows)


def measure_top(top: Level) -> tuple[int, int, int]:
    """Full map width/height + tile size from the highest zoom level. Interior
    tiles are square `tile_size`; the right column / bottom row may be partial,
    so measure those rather than assuming a multiple of tile_size."""
    interior = next(
        (c for c in top.cells if c.col < top.cols - 1 and c.row < top.rows - 1),
        top.cells[0],
    )
    with Image.open(interior.path) as im:
        tile_size = im.width or 256

    w_edge = h_edge = tile_size
    right = next((c for c in top.cells if c.col == top.cols - 1), None)
    bottom = next((c for c in top.cells if c.row == top.rows - 1), None)
    if right:
        with Image.open(right.path) as im:
            w_edge = im.width
    if bottom:
        with Image.open(bottom.path) as im:
            h_edge = im.height
    width = (top.cols - 1) * tile_size + w_edge
    height = (top.rows - 1) * tile_size + h_edge
    return width, height, tile_size


def choose_fmt(levels: list[Level], override: str) -> str:
    """webp unless the source is uniformly png (matches the webapp)."""
    if override != "auto":
        return override
    exts = {ext_of(c.path) for lvl in levels for c in lvl.cells}
    return "png" if exts == {"png"} else "webp"


def process_tile(cell: Cell, dst: Path, tile_size: int, out_fmt: str, is_edge: bool) -> None:
    """Write one tile to `dst` in `out_fmt`. Interior tiles already in the
    output format are copied byte-for-byte (no re-encode). Everything else is
    decoded; edge tiles are padded onto a full transparent square."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not is_edge and ext_of(cell.path) == out_fmt:
        shutil.copyfile(cell.path, dst)
        return
    with Image.open(cell.path) as im:
        im.load()
        if is_edge:
            canvas = Image.new("RGBA", (tile_size, tile_size), (0, 0, 0, 0))
            canvas.paste(im, (0, 0))
            im = canvas
        if out_fmt == "webp":
            im.save(dst, "WEBP", quality=WEBP_QUALITY, method=6)
        else:
            im.save(dst, "PNG")


def fetch_prefix(gateway: str, map_id: int, token: str | None) -> str:
    if requests is None:
        sys.exit("the 'requests' package is required to derive --prefix; pip install requests")
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r = requests.get(f"{gateway.rstrip('/')}/api/v1/maps/{map_id}", headers=headers, timeout=30)
    r.raise_for_status()
    prefix = r.json().get("prefix")
    if not prefix:
        sys.exit(f"map {map_id} has no prefix in the response")
    return prefix


def mark_imported(gateway: str, map_id: int, token: str, body: dict) -> None:
    if requests is None:
        sys.exit("the 'requests' package is required for --mark; pip install requests")
    r = requests.post(
        f"{gateway.rstrip('/')}/api/v1/maps/{map_id}/imported",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    if not r.ok:
        sys.exit(f"mark-imported failed: {r.status_code} {r.text[:400]}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", required=True, type=Path, help="local tile folder ({z}/{y}/{x} or {z}/{x}/{y})")
    ap.add_argument("--prefix", help="map's R2 storage prefix; derived from --map-id when omitted")
    ap.add_argument("--axis", choices=["yx", "xy"], default="yx", help="input path order (default yx = MapGenie)")
    ap.add_argument("--flip-y", action="store_true", help="rows numbered bottom-up (TMS)")
    ap.add_argument("--format", choices=["auto", "webp", "png"], default="auto", help="output tile format")
    ap.add_argument("--out", type=Path, help="staging dir (default: a temp dir, removed after upload)")
    ap.add_argument("--jobs", type=int, default=8, help="parallel transcode workers")
    ap.add_argument("--remote", default="r2", help="rclone remote name (default r2)")
    ap.add_argument("--bucket", default="tiles", help="R2 bucket ('' if the remote is bucket-scoped)")
    ap.add_argument("--transfers", type=int, default=32, help="rclone parallel transfers")
    ap.add_argument("--no-replace", action="store_true",
                    help="skip tiles already in R2 with identical content (incremental/resumable); "
                         "default replaces/overwrites every tile")
    ap.add_argument("--map-id", type=int, help="catalog map id (to derive --prefix and/or mark READY)")
    ap.add_argument("--gateway", help="gateway base URL (for --prefix derivation and --mark)")
    ap.add_argument("--token", help="admin bearer token (for authed map fetch / mark)")
    ap.add_argument("--no-upload", action="store_true", help="stage only; skip rclone upload")
    ap.add_argument("--no-mark", action="store_true", help="skip POST /imported")
    args = ap.parse_args()

    if not args.src.is_dir():
        sys.exit(f"--src not a directory: {args.src}")

    # Resolve the storage prefix (explicit, or fetched from the map).
    prefix = args.prefix
    if not prefix and not args.no_upload:
        if args.map_id and args.gateway:
            prefix = fetch_prefix(args.gateway, args.map_id, args.token)
            print(f"derived prefix '{prefix}' from map {args.map_id}")
        else:
            sys.exit("need --prefix (or --map-id + --gateway to derive it) for upload")

    # 1-2. Parse + normalize every level.
    by_zoom = parse_tiles(args.src, args.axis)
    if not by_zoom:
        sys.exit("no {z}/{a}/{b} tiles found under --src")
    levels = [normalize_level(by_zoom[z], args.flip_y) for z in sorted(by_zoom)]
    top = levels[-1]
    width, height, tile_size = measure_top(top)
    out_fmt = choose_fmt(levels, args.format)
    total = sum(len(lvl.cells) for lvl in levels)
    min_zoom, max_zoom = levels[0].z, top.z
    print(
        f"{total} tiles · z{min_zoom}..{max_zoom} · {width}x{height}px · "
        f"tile {tile_size}px · -> {out_fmt}"
    )

    # 3. Transcode/pad into the staging dir as {z}/{x}/{y}.<fmt>.
    staging = args.out or Path(tempfile.mkdtemp(prefix="rm-tiles-"))
    staging.mkdir(parents=True, exist_ok=True)
    level_by_z = {lvl.z: lvl for lvl in levels}
    done = 0

    def work(cell: Cell) -> None:
        # Edge = right column or bottom row of the cell's level (may be partial).
        lvl = level_by_z[cell.z]
        is_edge = cell.col == lvl.cols - 1 or cell.row == lvl.rows - 1
        dst = staging / str(cell.z) / str(cell.col) / f"{cell.row}.{out_fmt}"
        process_tile(cell, dst, tile_size, out_fmt, is_edge)

    with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
        for _ in pool.map(work, (c for lvl in levels for c in lvl.cells)):
            done += 1
            if done % 500 == 0 or done == total:
                print(f"\r  processed {done}/{total}", end="", flush=True)
    print()

    # 4. Upload with rclone.
    if args.no_upload:
        print(f"staged at {staging} (upload skipped)")
    else:
        dest = f"{args.remote}:{args.bucket}/{prefix}" if args.bucket else f"{args.remote}:{prefix}"
        # Replace existing tiles by default: --ignore-times forces rclone to
        # re-upload every tile (copy always overwrites the destination). --no-replace
        # restores the incremental skip-if-identical behavior (--checksum).
        compare = "--checksum" if args.no_replace else "--ignore-times"
        cmd = ["rclone", "copy", str(staging), dest, "--transfers", str(args.transfers), compare, "-P"]
        print("+ " + " ".join(cmd))
        rc = subprocess.run(cmd).returncode
        if rc != 0:
            sys.exit(f"rclone exited {rc}")

    # 5. Mark the map READY.
    if args.no_mark:
        print("mark-imported skipped")
    elif args.map_id and args.gateway and args.token:
        mark_imported(
            args.gateway,
            args.map_id,
            args.token,
            {
                "width": width,
                "height": height,
                "maxZoom": max_zoom,
                "minZoom": min_zoom,
                "tileSize": tile_size,
                "format": out_fmt,
            },
        )
        print(f"map {args.map_id} marked READY")
    else:
        print("mark-imported needs --map-id + --gateway + --token; skipped")

    if not args.out and not args.no_upload:
        shutil.rmtree(staging, ignore_errors=True)


if __name__ == "__main__":
    main()
