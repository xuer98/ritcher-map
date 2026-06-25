import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { gameTitle } from '@/lib/games';
import { resolveAssetUrl } from '@/lib/icons';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/JsonLd';
import {
  fetchCategories,
  fetchGame,
  fetchMaps,
  fetchRegions,
} from '@/lib/server';
import { MapScreen } from './MapScreen';

interface Props {
  params: Promise<{ gameSlug: string; mapSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gameSlug, mapSlug } = await params;
  const [maps, gameRow] = await Promise.all([fetchMaps(), fetchGame(gameSlug)]);
  const map = maps.find((m) => m.gameSlug === gameSlug && m.mapSlug === mapSlug);
  const game = gameRow?.title ?? gameTitle(gameSlug);
  const title = map ? `${map.name} — ${game} Interactive Map` : `${game} Map`;
  const description = map
    ? `Free interactive ${map.name} map for ${game} — pinpoint every collectible, boss and secret, and track what you've found.`
    : undefined;
  const url = `/${gameSlug}/map/${mapSlug}`;
  const image = resolveAssetUrl(gameRow?.thumbnailUrl ?? null);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      ...(description ? { description } : {}),
      url,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function MapPage({ params }: Props) {
  const { gameSlug, mapSlug } = await params;
  const maps = await fetchMaps();
  const meta = maps.find(
    (m) => m.gameSlug === gameSlug && m.mapSlug === mapSlug,
  );
  if (!meta) notFound();

  const [categories, regions, game] = await Promise.all([
    fetchCategories(gameSlug),
    fetchRegions(meta.id),
    fetchGame(gameSlug),
  ]);
  const siblings = maps.filter((m) => m.gameSlug === gameSlug);
  const title = game?.title ?? gameTitle(gameSlug);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'All games', path: '/' },
          { name: title, path: `/${gameSlug}` },
          { name: meta.name, path: `/${gameSlug}/map/${mapSlug}` },
        ])}
      />
      <MapScreen
        meta={meta}
        categories={categories}
        siblings={siblings}
        regions={regions}
        gameTitle={title}
        game={game}
      />
    </>
  );
}
