#!/usr/bin/env python3
"""
download_tiles.py — concurrent tile-pyramid downloader for MapGenie-style servers.

URL layout (note: y precedes x in the path):
    https://tiles.mapgenie.io/games/{game}/{map}/{tile_id}/{z}/{y}/{x}.jpg

Features
--------
* Async downloads through a bounded worker pool (concurrency you control).
* Resumable: tiles already on disk are skipped, so re-running just fills gaps.
* Retries transient errors with exponential backoff + jitter; a 404 means the
  tile is out of bounds, so it's recorded and never retried.
* Smart bounds: instead of scanning 2^z * 2^z cells per zoom, give it one
  known-good tile (--seed) and it discovers the occupied bounding box at the
  lowest zoom, then derives the box for every higher zoom (each tile splits
  into 4, so the box simply doubles). Explicit --bounds overrides discovery.

Examples
--------
    # Discover bounds from a tile you know exists, grab zooms 0..11
    python download_tiles.py --game zelda-breath-of-the-wild --map hyrule \
        --tile-id default-v1 --max-zoom 11 --seed 11,1019,1019

    # Or pass an explicit box (interpreted at --bounds-zoom, scaled to all zooms)
    python download_tiles.py --game zelda-breath-of-the-wild --map hyrule \
        --tile-id default-v1 --max-zoom 11 \
        --bounds 1010,1030,1010,1030 --bounds-zoom 11

Requires: pip install aiohttp tqdm
"""

from __future__ import annotations

import argparse
import asyncio
import random
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import aiohttp
from tqdm import tqdm

URL_TEMPLATE = (
    "https://tiles.mapgenie.io/games/{game}/{map}/{tile_id}/{z}/{y}/{x}.jpg"
)
USER_AGENT = "tile-downloader/1.0 (+personal use; respects robots & rate limits)"

# (min_x, max_x, min_y, max_y) — all inclusive
Bounds = Tuple[int, int, int, int]


@dataclass
class Config:
    game: str
    map: str
    tile_id: str
    out: Path
    concurrency: int
    delay: float
    retries: int
    timeout: float
    flip: bool


class TileClient:
    """Thin wrapper around an aiohttp session for one map's tile space."""

    def __init__(self, session: aiohttp.ClientSession, cfg: Config):
        self.session = session
        self.cfg = cfg
        self._dirs: set[Path] = set()  # dirs already created, to skip mkdir syscalls

    def _write_tile(self, path: Path, data: bytes) -> None:
        """Blocking write (temp-file + atomic rename). Runs in a worker thread
        (via asyncio.to_thread) so the event loop keeps servicing every other
        worker's network I/O instead of stalling on disk. Directory creation is
        cached: one mkdir per directory, not one per tile."""
        d = path.parent
        if d not in self._dirs:
            d.mkdir(parents=True, exist_ok=True)
            self._dirs.add(d)  # benign cross-thread race; mkdir(exist_ok) is idempotent
        tmp = path.with_suffix(".jpg.part")
        tmp.write_bytes(data)
        tmp.replace(path)

    def url(self, z: int, y: int, x: int) -> str:
        return URL_TEMPLATE.format(
            game=self.cfg.game, map=self.cfg.map,
            tile_id=self.cfg.tile_id, z=z, y=y, x=x,
        )

    def path(self, z: int, y: int, x: int) -> Path:
        # The URL is always .../{z}/{y}/{x}.jpg; --flip changes only the on-disk
        # layout to {z}/{x}/{y}.jpg for renderers that expect that order.
        if self.cfg.flip:
            return self.cfg.out / str(z) / str(x) / f"{y}.jpg"
        return self.cfg.out / str(z) / str(y) / f"{x}.jpg"

    async def exists(self, z: int, y: int, x: int) -> bool:
        """Probe whether a tile exists (HTTP 200). Used during discovery."""
        try:
            async with self.session.get(self.url(z, y, x)) as resp:
                await resp.read()
                return resp.status == 200
        except (aiohttp.ClientError, asyncio.TimeoutError):
            return False

    async def download(self, z: int, y: int, x: int) -> str:
        """Fetch one tile. Returns: skipped | downloaded | missing | failed."""
        path = self.path(z, y, x)
        if path.exists() and path.stat().st_size > 0:
            return "skipped"

        url = self.url(z, y, x)
        backoff = 0.5
        for attempt in range(self.cfg.retries + 1):
            try:
                async with self.session.get(url) as resp:
                    if resp.status == 200:
                        data = await resp.read()
                        # Temp-file + rename (so an interrupted run never leaves
                        # a half-written tile), off the event loop in a thread.
                        await asyncio.to_thread(self._write_tile, path, data)
                        return "downloaded"
                    if resp.status == 404:
                        await resp.read()
                        return "missing"
                    await resp.read()  # drain non-200 (e.g. 429/5xx) and retry
            except (aiohttp.ClientError, asyncio.TimeoutError):
                pass
            if attempt < self.cfg.retries:
                await asyncio.sleep(backoff + random.random() * 0.3)
                backoff *= 2
        return "failed"


# --------------------------------------------------------------------------- #
# Bounds discovery & scaling
# --------------------------------------------------------------------------- #
async def _find_edge(
    client: TileClient, z: int, fixed: int, start: int,
    direction: int, axis: str, limit: int,
) -> int:
    """
    From a known-good index, walk outward along one axis (x with y fixed, or
    y with x fixed) using exponential steps, then binary-search the last index
    that still exists. Assumes the occupied region is a contiguous rectangle.
    """
    cache: Dict[int, bool] = {}

    async def ok(idx: int) -> bool:
        if idx < 0 or idx > limit:
            return False
        if idx not in cache:
            cache[idx] = await (
                client.exists(z, fixed, idx) if axis == "x"
                else client.exists(z, idx, fixed)
            )
        return cache[idx]

    good, step = start, 1
    while True:
        nxt = good + direction * step
        if await ok(nxt):
            good, step = nxt, step * 2
        else:
            bad = nxt
            break

    lo, hi = good, bad  # lo exists, hi does not
    while abs(hi - lo) > 1:
        mid = (lo + hi) // 2
        if await ok(mid):
            lo = mid
        else:
            hi = mid
    return lo


async def discover_bounds(client: TileClient, z: int, sy: int, sx: int) -> Bounds:
    limit = (1 << z) - 1
    if not await client.exists(z, sy, sx):
        raise RuntimeError(
            f"Seed tile z={z} y={sy} x={sx} not found. "
            "Pass a --seed that exists, or supply explicit --bounds."
        )
    min_x = await _find_edge(client, z, sy, sx, -1, "x", limit)
    max_x = await _find_edge(client, z, sy, sx, +1, "x", limit)
    min_y = await _find_edge(client, z, sx, sy, -1, "y", limit)
    max_y = await _find_edge(client, z, sx, sy, +1, "y", limit)
    return (min_x, max_x, min_y, max_y)


def scale_bounds(bounds: Bounds, ref_z: int, target_z: int) -> Bounds:
    """Project an inclusive box from one zoom to another (quadtree pyramid)."""
    min_x, max_x, min_y, max_y = bounds
    if target_z >= ref_z:
        f = 1 << (target_z - ref_z)
        return (min_x * f, (max_x + 1) * f - 1,
                min_y * f, (max_y + 1) * f - 1)
    f = 1 << (ref_z - target_z)
    return (min_x // f, max_x // f, min_y // f, max_y // f)


# --------------------------------------------------------------------------- #
# Download pipeline
# --------------------------------------------------------------------------- #
async def download_pyramid(
    client: TileClient, cfg: Config,
    min_zoom: int, max_zoom: int, ref_z: int, ref_bounds: Bounds,
) -> None:
    zoom_bounds: Dict[int, Bounds] = {}
    total = 0
    for z in range(min_zoom, max_zoom + 1):
        b = scale_bounds(ref_bounds, ref_z, z)
        zoom_bounds[z] = b
        mnx, mxx, mny, mxy = b
        total += (mxx - mnx + 1) * (mxy - mny + 1)

    print(f"Planning {total:,} tiles across zooms {min_zoom}\u2013{max_zoom}")
    for z in range(min_zoom, max_zoom + 1):
        mnx, mxx, mny, mxy = zoom_bounds[z]
        print(f"  z={z:>2}: x[{mnx}..{mxx}] y[{mny}..{mxy}] "
              f"= {(mxx-mnx+1)*(mxy-mny+1):,} tiles")

    queue: asyncio.Queue = asyncio.Queue(maxsize=cfg.concurrency * 4)
    stats = {"downloaded": 0, "skipped": 0, "missing": 0, "failed": 0}
    failures: List[Tuple[int, int, int]] = []
    bar = tqdm(total=total, unit="tile", smoothing=0.05)

    async def worker() -> None:
        while True:
            item = await queue.get()
            if item is None:
                queue.task_done()
                return
            z, y, x = item
            result = await client.download(z, y, x)
            stats[result] += 1
            if result == "failed":
                failures.append((z, y, x))
            bar.update(1)
            bar.set_postfix(ok=stats["downloaded"], skip=stats["skipped"],
                            miss=stats["missing"], fail=stats["failed"],
                            refresh=False)
            if cfg.delay:
                await asyncio.sleep(cfg.delay)
            queue.task_done()

    workers = [asyncio.create_task(worker()) for _ in range(cfg.concurrency)]

    for z in range(min_zoom, max_zoom + 1):
        mnx, mxx, mny, mxy = zoom_bounds[z]
        for y in range(mny, mxy + 1):
            for x in range(mnx, mxx + 1):
                await queue.put((z, y, x))

    await queue.join()
    for _ in workers:
        await queue.put(None)
    await asyncio.gather(*workers)
    bar.close()

    print("\nDone: " + ", ".join(f"{k}={v:,}" for k, v in stats.items()))
    if failures:
        fp = cfg.out / "_failures.txt"
        fp.write_text("\n".join(f"{z}/{y}/{x}" for z, y, x in failures))
        print(f"{len(failures):,} tiles failed after retries; "
              f"wrote list to {fp} (re-run to retry — successes are skipped).")


async def main_async(
    cfg: Config, min_zoom: int, max_zoom: int, *,
    bounds: Optional[Bounds] = None, bounds_zoom: Optional[int] = None,
    seed: Optional[Tuple[int, int]] = None, seed_zoom: Optional[int] = None,
) -> None:
    timeout = aiohttp.ClientTimeout(total=cfg.timeout)
    connector = aiohttp.TCPConnector(limit=cfg.concurrency, ttl_dns_cache=300)
    async with aiohttp.ClientSession(
        timeout=timeout, connector=connector,
        headers={"User-Agent": USER_AGENT},
    ) as session:
        client = TileClient(session, cfg)

        if bounds is not None:
            ref_z, ref_bounds = bounds_zoom, bounds
        else:
            sy, sx = seed
            ref_z = seed_zoom
            print(f"Discovering bounds at zoom {ref_z} "
                  f"from seed y={sy} x={sx} ...")
            ref_bounds = await discover_bounds(client, ref_z, sy, sx)
            print(f"Discovered z={ref_z}: x[{ref_bounds[0]}..{ref_bounds[1]}] "
                  f"y[{ref_bounds[2]}..{ref_bounds[3]}]")

        await download_pyramid(client, cfg, min_zoom, max_zoom, ref_z, ref_bounds)


def main() -> None:
    p = argparse.ArgumentParser(
        description="Download a MapGenie-style tile pyramid concurrently.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--game", required=True, help="e.g. zelda-breath-of-the-wild")
    p.add_argument("--map", required=True, help="e.g. hyrule")
    p.add_argument("--tile-id", required=True, help="e.g. default-v1")
    p.add_argument("--min-zoom", type=int, default=0)
    p.add_argument("--max-zoom", type=int, required=True)
    p.add_argument("--seed", default="9,254,254", help="known-good tile 'Z,Y,X' for bounds discovery")
    p.add_argument("--bounds", help="explicit 'MINX,MAXX,MINY,MAXY'")
    p.add_argument("--bounds-zoom", type=int, help="zoom that --bounds refers to")
    p.add_argument("--out", type=Path, default=Path("tiles"))
    p.add_argument("--concurrency", type=int, default=32,
                   help="parallel in-flight requests; try 64-128 if the CDN keeps up")
    p.add_argument("--delay", type=float, default=0.0,
                   help="seconds each worker waits after a tile (politeness)")
    p.add_argument("--retries", type=int, default=3)
    p.add_argument("--timeout", type=float, default=30.0)
    p.add_argument("--flip", action="store_true",
                   help="store tiles as {z}/{x}/{y}.jpg instead of {z}/{y}/{x}.jpg "
                        "(download URL is unaffected)")
    args = p.parse_args()

    cfg = Config(
        game=args.game, map=args.map, tile_id=args.tile_id, out=args.out,
        concurrency=args.concurrency, delay=args.delay,
        retries=args.retries, timeout=args.timeout, flip=args.flip,
    )

    try:
        if args.bounds:
            if args.bounds_zoom is None:
                p.error("--bounds requires --bounds-zoom")
            mnx, mxx, mny, mxy = (int(v) for v in args.bounds.split(","))
            asyncio.run(main_async(
                cfg, args.min_zoom, args.max_zoom,
                bounds=(mnx, mxx, mny, mxy), bounds_zoom=args.bounds_zoom,
            ))
        elif args.seed:
            sz, sy, sx = (int(v) for v in args.seed.split(","))
            # Discover bounds at the seed's OWN zoom, where the tile is known to
            # exist. Expansion + binary search is logarithmic, so it's cheap at
            # any zoom. Bounds are then scaled to every requested zoom. This
            # avoids assuming the pyramid reaches --min-zoom: many maps only have
            # tiles from some native zoom upward, so a seed scaled down to z=0
            # would land on a 404.
            asyncio.run(main_async(
                cfg, args.min_zoom, args.max_zoom,
                seed=(sy, sx), seed_zoom=sz,
            ))
        else:
            p.error("provide either --seed Z,Y,X or "
                    "--bounds MINX,MAXX,MINY,MAXY with --bounds-zoom")
    except KeyboardInterrupt:
        print("\nInterrupted. Re-run the same command to resume "
              "(downloaded tiles are skipped).", file=sys.stderr)
        sys.exit(130)


if __name__ == "__main__":
    main()