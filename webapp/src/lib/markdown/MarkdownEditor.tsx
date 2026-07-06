'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { presignUpload, uploadToPresignedUrl } from '../api/admin';
import { resolveAssetUrl } from '../icons';
import { MarkerBody } from './MarkerBody';

/** Max matches shown in a link picker (the list is virtualization-free). */
const LINK_RESULT_LIMIT = 50;

/**
 * Searchable "link an entity" picker (markers, categories, regions). Replaces
 * a plain <select> so an author can type to find an item among hundreds.
 * Filters by label or id; picking inserts `[label](#<kind>-<id>)` into the
 * description (the insertion itself is the caller's `onPick`).
 */
function LinkPicker({
  placeholder,
  listId,
  items,
  onPick,
}: {
  placeholder: string;
  /** Unique listbox id — several pickers coexist in the toolbar. */
  listId: string;
  items: { id: number; label: string }[];
  onPick: (id: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list =
      q === ''
        ? items
        : items.filter(
            (it) =>
              it.label.toLowerCase().includes(q) ||
              String(it.id).includes(q.replace(/^#/, '')),
          );
    return list.slice(0, LINK_RESULT_LIMIT);
  }, [items, query]);

  // Close when clicking outside the picker.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (id: number) => {
    onPick(id);
    setQuery('');
    setOpen(false);
    setHighlight(0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = results[highlight];
      if (it) pick(it.id);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        className="input text-xs max-w-[180px]"
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        title={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
      />
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-20 mt-1 max-h-60 w-64 max-w-[80vw] overflow-y-auto rounded-md border border-edge bg-panel py-1 shadow-panel"
        >
          {results.map((it, i) => (
            <li key={it.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                // onMouseDown + preventDefault: fire before the input loses
                // focus, and keep the caret in the textarea after inserting.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(it.id);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs hover:bg-white/[0.08]${
                  i === highlight ? ' bg-white/[0.08]' : ''
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                <span className="flex-none text-fg-dim">#{it.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  /** Surfaced upload/config errors (shared with the host form's error line). */
  onError?: (msg: string | null) => void;
  placeholder?: string;
  rows?: number;
  /** Other markers on the map, for the "link a marker" picker. */
  markers?: { id: number; title: string | null }[];
  /** The game's categories, for the "link a category" picker. */
  categories?: { id: number; name: string }[];
  /** This map's regions, for the "link a region" picker. */
  regions?: { id: number; name: string }[];
}

type Uploading = 'image' | 'video' | null;

/**
 * Markdown source editor for marker descriptions: a textarea plus image/video
 * upload (to the public bucket via presign), link pickers for other markers /
 * categories / regions, and a live preview rendered with the same
 * {@link MarkerBody} used on the site.
 */
export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  onError,
  placeholder = 'description (Markdown) — **bold**, ![](image), or paste a YouTube/Vimeo link',
  rows = 5,
  markers,
  categories,
  regions,
}) => {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = useState<Uploading>(null);
  const [preview, setPreview] = useState(false);

  // Insert at the caret (or append), then restore the caret after the snippet.
  const insert = (snippet: string) => {
    const ta = taRef.current;
    if (!ta) {
      onChange(value + snippet);
      return;
    }
    const { selectionStart: s, selectionEnd: e } = ta;
    onChange(value.slice(0, s) + snippet + value.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = s + snippet.length;
    });
  };

  const onUpload = async (file: File | undefined, kind: 'image' | 'video') => {
    if (!file) return;
    onError?.(null);
    setUploading(kind);
    try {
      const grant = await presignUpload(file.name, 'tiles');
      await uploadToPresignedUrl(grant.url, file);
      const url = resolveAssetUrl(grant.key);
      if (!url) {
        onError?.(
          'Uploaded, but NEXT_PUBLIC_ASSET_BASE_URL is unset — set it to the public bucket base so media resolves to a URL.',
        );
        return;
      }
      // Image → markdown image; video → bare URL on its own line (auto-embeds).
      insert(kind === 'image' ? `\n![](${url})\n` : `\n${url}\n`);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'media upload failed');
    } finally {
      setUploading(null);
    }
  };

  const markerTitle = (id: number): string | null =>
    markers?.find((m) => m.id === id)?.title ?? null;
  const categoryName = (id: number): string | null =>
    categories?.find((c) => c.id === id)?.name ?? null;
  const regionName = (id: number): string | null =>
    regions?.find((r) => r.id === id)?.name ?? null;

  const linkMarker = (id: number) => {
    const label = markerTitle(id)?.trim() || `Marker #${id}`;
    insert(`[${label}](#marker-${id})`);
  };
  const linkCategory = (id: number) => {
    const label = categoryName(id)?.trim() || `Category #${id}`;
    insert(`[${label}](#category-${id})`);
  };
  const linkRegion = (id: number) => {
    const label = regionName(id)?.trim() || `Region #${id}`;
    insert(`[${label}](#region-${id})`);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="btn btn-sm">
          {uploading === 'image' ? 'Uploading…' : 'Image'}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={uploading !== null}
            onChange={(e) => onUpload(e.target.files?.[0], 'image')}
          />
        </label>
        <label className="btn btn-sm">
          {uploading === 'video' ? 'Uploading…' : 'Video'}
          <input
            type="file"
            accept="video/*"
            hidden
            disabled={uploading !== null}
            onChange={(e) => onUpload(e.target.files?.[0], 'video')}
          />
        </label>
        {markers && markers.length > 0 && (
          <LinkPicker
            placeholder="Link marker…"
            listId="rm-marker-link-list"
            items={markers.map((m) => ({
              id: m.id,
              label: m.title ?? `Marker #${m.id}`,
            }))}
            onPick={linkMarker}
          />
        )}
        {categories && categories.length > 0 && (
          <LinkPicker
            placeholder="Link category…"
            listId="rm-category-link-list"
            items={categories.map((c) => ({ id: c.id, label: c.name }))}
            onPick={linkCategory}
          />
        )}
        {regions && regions.length > 0 && (
          <LinkPicker
            placeholder="Link region…"
            listId="rm-region-link-list"
            items={regions.map((r) => ({ id: r.id, label: r.name }))}
            onPick={linkRegion}
          />
        )}
        <button
          type="button"
          className={`btn btn-sm${preview ? ' btn-active' : ''}`}
          onClick={() => setPreview((p) => !p)}
        >
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {preview ? (
        <div className="rounded-md border border-edge bg-white/[0.03] p-3 min-h-24">
          {value.trim() === '' ? (
            <span className="text-sm text-fg-dim">Nothing to preview.</span>
          ) : (
            <MarkerBody
              markdown={value}
              resolveMarkerLabel={markerTitle}
              resolveCategoryLabel={categoryName}
              resolveRegionLabel={regionName}
            />
          )}
        </div>
      ) : (
        <textarea
          ref={taRef}
          className="textarea resize-y min-h-24 font-mono text-[13px]"
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
};
