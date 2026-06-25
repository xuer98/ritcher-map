import Link from 'next/link';
import { gameTitle } from '@/lib/games';
import { CategoryManager } from '@/lib/panels/CategoryManager';
import { fetchGame } from '@/lib/server';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function AdminGamePage({ params }: Props) {
  const { slug } = await params;
  const game = await fetchGame(slug);
  const title = game?.title ?? gameTitle(slug);

  return (
    <>
      <nav className="mb-4 flex items-center gap-1 text-sm text-fg-dim">
        <Link href="/admin/games">Games</Link>
        <span aria-hidden="true"> / </span>
        <span>{slug}</span>
      </nav>

      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{title} — categories</h1>
        <Link className="btn btn-sm" href="/admin/games">
          Branding →
        </Link>
      </div>

      <div className="max-w-2xl">
        <CategoryManager gameSlug={slug} />
      </div>
    </>
  );
}
