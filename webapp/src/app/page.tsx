import { MapBrowser } from '@/components/MapBrowser';
import { SiteHeader } from '@/components/SiteHeader';
import { groupByGame } from '@/lib/games';
import { JsonLd, websiteJsonLd } from '@/lib/seo/JsonLd';
import { fetchGames, fetchMaps } from '@/lib/server';

export default async function HomePage() {
  const [maps, games] = await Promise.all([fetchMaps(), fetchGames()]);
  const grouped = groupByGame(maps, games);

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <JsonLd data={websiteJsonLd()} />
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Interactive Game Maps
        </h1>
        <p className="mt-1 text-fg-dim">
          Pick a game, open a map, and track what you have found.
        </p>

        {grouped.length === 0 ? (
          <p className="mt-8 text-sm text-fg-dim">
            No maps published yet — check back soon.
          </p>
        ) : (
          <MapBrowser games={grouped} />
        )}
      </main>
    </div>
  );
}
