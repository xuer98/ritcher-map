import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { BrandTheme } from "@/lib/branding/BrandTheme";
import { gameTitle } from "@/lib/games";
import { GATEWAY_URL, TILE_SIZE } from "@/lib/config";
import { resolveAssetUrl } from "@/lib/icons";
import { breadcrumbJsonLd, JsonLd, videoGameJsonLd } from "@/lib/seo/JsonLd";
import { fetchGame, fetchMaps } from "@/lib/server";
import type { MapResponse } from "@/lib/types";

interface Props {
  params: Promise<{ gameSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gameSlug } = await params;
  const game = await fetchGame(gameSlug);
  const title = game?.title ?? gameTitle(gameSlug);
  const description = `Free interactive ${title} maps — find every location, collectible and boss, and check off your progress as you go.`;
  const url = `/${gameSlug}`;
  const image = resolveAssetUrl(game?.thumbnailUrl ?? null);
  return {
    title: `${title} Interactive Map`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} Interactive Map`,
      description,
      url,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/**
 * Thumbnail for a map card: a single detail tile near the map's center. We pick
 * the zoom 3 levels above where the whole map fits one tile (`fitZoom`), so the
 * tile is a frame-filling, content-rich crop (the bare overview tile is mostly
 * the source art's black padding). The map center is always within bounds, so
 * the tile always exists; the tiler builds the full 0..maxZoom pyramid, so a
 * sub-minZoom level is still served.
 */
function mapThumbUrl(m: MapResponse): string | null {
  if (
    m.status !== "READY" ||
    m.width == null ||
    m.height == null ||
    m.maxZoom == null
  ) {
    return null;
  }
  const maxSide = Math.max(m.width, m.height);
  const fitZoom = m.maxZoom - Math.ceil(Math.log2(maxSide / TILE_SIZE));
  const z = Math.max(0, Math.min(m.maxZoom, fitZoom + 3));
  const scale = 2 ** (m.maxZoom - z);
  const x = Math.floor(m.width / 2 / scale / TILE_SIZE);
  const y = Math.floor(m.height / 2 / scale / TILE_SIZE);
  return `${GATEWAY_URL}/tiles/${m.prefix}/${z}/${x}/${y}.${m.format}`;
}

export default async function GamePage({ params }: Props) {
  const { gameSlug } = await params;
  const [allMaps, game] = await Promise.all([fetchMaps(), fetchGame(gameSlug)]);
  const maps = allMaps
    .filter((m) => m.gameSlug === gameSlug)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  if (maps.length === 0) notFound();

  const title = game?.title ?? gameTitle(gameSlug);
  const thumb = resolveAssetUrl(game?.thumbnailUrl ?? null);
  const logo = resolveAssetUrl(game?.logoUrl ?? null);

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "All games", path: "/" },
            { name: title, path: `/${gameSlug}` },
          ]),
          videoGameJsonLd({
            title,
            gameSlug,
            description: `Free interactive ${title} maps — find every location, collectible and boss, and check off your progress as you go.`,
            image: thumb,
          }),
        ]}
      />
      <SiteHeader />
      <BrandTheme
        game={game}
        className="mx-auto w-full max-w-6xl flex-1 px-6 py-6"
      >
        <nav className="flex items-center gap-1.5 text-sm text-fg-dim">
          <Link href="/">All games</Link>
          <span aria-hidden="true">/</span>
          <span className="text-fg">{title}</span>
        </nav>

        <section className="relative mt-4 flex min-h-44 flex-col justify-end overflow-hidden rounded-card border border-edge bg-panel p-6">
          {thumb && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-black/20"
              />
            </>
          )}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 bg-brand"
          />
          <div className="relative z-10">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={title}
                className="max-h-20 w-auto max-w-full object-contain object-left drop-shadow-lg"
              />
            ) : (
              <h1 className="text-3xl font-bold text-white">{title}</h1>
            )}
          </div>
        </section>

        <h2 className="panel-title mt-6 mb-3">Maps</h2>
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
          {maps.map((m) => {
            const thumb = mapThumbUrl(m);
            return m.status === "READY" ? (
              <Link
                key={m.id}
                href={`/${m.gameSlug}/map/${m.mapSlug}`}
                className="group relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-card border border-edge bg-panel transition-colors hover:border-brand"
              >
                {thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent"
                />
                <div className="relative z-10 flex items-center gap-2 p-4">
                  <span className="text-lg font-bold text-white drop-shadow-md">
                    {m.name}
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-white/85 transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </div>
              </Link>
            ) : (
              <div
                key={m.id}
                className="relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-card border border-edge bg-panel opacity-60"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent"
                />
                <div className="relative z-10 flex flex-col gap-1 p-4">
                  <span className="text-lg font-bold text-white">{m.name}</span>
                  <span className="text-xs text-fg-dim">Not published yet</span>
                </div>
              </div>
            );
          })}
        </div>
      </BrandTheme>
    </div>
  );
}
