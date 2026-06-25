'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createCategory,
  deleteCategory,
  presignUpload,
  updateCategory,
  uploadToPresignedUrl,
  type CategoryInput,
} from '@/lib/api/admin';
import { getCategories } from '@/lib/api/maps';
import { resolveIconUrl } from '@/lib/icons';
import { CategoryIcon } from '@/lib/panels/CategoryIcon';
import { IconPicker } from '@/lib/panels/IconPicker';
import { ToastViewport, useToasts } from '@/lib/ui/Toast';
import type { CategoryResponse } from '@/lib/types';

function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Game-scoped category CRUD. Categories are shared across every map of the
 * game, so they're managed here (per-game) rather than on a single map. Renders
 * a grouped, collapsible list plus a create/edit form with the icon picker.
 */
export function CategoryManager({ gameSlug }: { gameSlug: string }) {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toasts, notify, dismiss } = useToasts();

  const reload = useCallback(() => {
    getCategories(gameSlug)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [gameSlug]);
  useEffect(() => {
    reload();
  }, [reload]);

  // --- form state -----------------------------------------------------------
  const [editing, setEditing] = useState<CategoryResponse | null>(null);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [sort, setSort] = useState('0');
  const [parent, setParent] = useState('');
  const [iconUploading, setIconUploading] = useState(false);

  // Group ids whose children are hidden in the list; groups start expanded.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggleCollapse = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // How many children each category has — a root with children is a "group".
  const childCountById = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of categories) {
      if (c.parentId !== null) m.set(c.parentId, (m.get(c.parentId) ?? 0) + 1);
    }
    return m;
  }, [categories]);

  // Tree-ordered rows: each root immediately followed by its children, both
  // sorted by sortOrder then name, so the list groups properly.
  const orderedCats = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const sortFn = (a: CategoryResponse, b: CategoryResponse): number =>
      a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    const roots: CategoryResponse[] = [];
    const childrenOf = new Map<number, CategoryResponse[]>();
    for (const c of categories) {
      if (c.parentId === null || !byId.has(c.parentId)) {
        roots.push(c);
      } else {
        const list = childrenOf.get(c.parentId) ?? [];
        list.push(c);
        childrenOf.set(c.parentId, list);
      }
    }
    roots.sort(sortFn);
    const rows: {
      cat: CategoryResponse;
      depth: number;
      childCount: number;
    }[] = [];
    for (const root of roots) {
      const kids = (childrenOf.get(root.id) ?? []).sort(sortFn);
      rows.push({ cat: root, depth: 0, childCount: kids.length });
      for (const kid of kids) rows.push({ cat: kid, depth: 1, childCount: 0 });
    }
    return rows;
  }, [categories]);

  // A group (category with children) can't itself be nested — keep one level.
  const editingHasChildren = editing
    ? (childCountById.get(editing.id) ?? 0) > 0
    : false;

  // --- handlers -------------------------------------------------------------
  const onPickIcon = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setIconUploading(true);
    try {
      const grant = await presignUpload(file.name, 'tiles');
      await uploadToPresignedUrl(grant.url, file);
      const url = resolveIconUrl(grant.key);
      setIcon(url ?? grant.key);
      if (url) {
        notify('success', 'Icon uploaded.');
      } else {
        setError(
          'Icon uploaded, but NEXT_PUBLIC_ASSET_BASE_URL is unset — paste a public URL for the object, or configure the asset base so keys resolve.',
        );
      }
    } catch (e) {
      notify('error', errMsg(e, 'icon upload failed'));
    } finally {
      setIconUploading(false);
    }
  };

  const formReset = () => {
    setEditing(null);
    setSlug('');
    setName('');
    setIcon('');
    setSort('0');
    setParent('');
  };

  const formLoad = (c: CategoryResponse) => {
    setEditing(c);
    setSlug(c.slug);
    setName(c.name);
    setIcon(c.icon ?? '');
    setSort(String(c.sortOrder));
    setParent(c.parentId === null ? '' : String(c.parentId));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input: CategoryInput = {
      slug: slug.trim(),
      name: name.trim(),
      icon: icon.trim() === '' ? null : icon.trim(),
      sortOrder: Number(sort) || 0,
      parentId: parent === '' ? null : Number(parent),
    };
    const wasEditing = editing;
    try {
      if (wasEditing) await updateCategory(wasEditing.id, input);
      else await createCategory(gameSlug, input);
      formReset();
      reload();
      notify(
        'success',
        wasEditing ? `Saved "${input.name}".` : `Added "${input.name}".`,
      );
    } catch (err) {
      notify('error', errMsg(err, 'category save failed'));
    }
  };

  const remove = async (c: CategoryResponse) => {
    if (!window.confirm(`Delete category "${c.name}"?`)) return;
    try {
      await deleteCategory(c.id);
      if (editing?.id === c.id) formReset();
      reload();
      notify('success', `Deleted "${c.name}".`);
    } catch (err) {
      // The catalog 409s while markers still reference it — surface that.
      notify('error', errMsg(err, 'category delete failed'));
    }
  };

  // --- render ---------------------------------------------------------------
  return (
    <div className="panel">
      <div className="panel-title">Categories</div>
      <p className="text-[13px] text-fg-dim">
        Shared across every map of this game.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}

      {categories.length === 0 ? (
        <p className="text-sm text-fg-dim">
          None yet — markers need a category, so add one below.
        </p>
      ) : (
        <table className="w-full text-sm [&_td]:border-t [&_td]:border-edge [&_td]:py-1.5 [&_td]:align-middle [&_tr:first-child_td]:border-t-0">
          <tbody>
            {orderedCats
              .filter(
                (row) =>
                  row.depth === 0 ||
                  !collapsed.has(row.cat.parentId as number),
              )
              .map(({ cat: c, depth, childCount }) => {
                const isGroup = childCount > 0;
                const isCollapsed = collapsed.has(c.id);
                return (
                  <tr key={c.id}>
                    <td style={{ width: 22 }}>
                      <CategoryIcon icon={c.icon} categoryId={c.id} size={16} />
                    </td>
                    <td>
                      <div
                        className="flex items-center gap-1"
                        style={{ paddingLeft: depth ? 18 : 0 }}
                      >
                        {isGroup ? (
                          <button
                            type="button"
                            className="flex-none cursor-pointer text-fg-dim hover:text-fg"
                            aria-expanded={!isCollapsed}
                            aria-label={
                              isCollapsed
                                ? `Expand ${c.name}`
                                : `Collapse ${c.name}`
                            }
                            onClick={() => toggleCollapse(c.id)}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              className={`transition-transform ${
                                isCollapsed ? '-rotate-90' : ''
                              }`}
                            >
                              <path
                                d="M6 9l6 6 6-6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        ) : depth ? (
                          <span className="flex-none text-fg-dim">↳</span>
                        ) : null}
                        <span className={depth ? '' : 'font-medium'}>
                          {c.name}
                        </span>
                        {isGroup && (
                          <span className="ml-1 text-[11px] text-fg-dim">
                            · group of {childCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-[13px] text-fg-dim">{c.slug}</td>
                    <td className="text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="btn btn-sm ml-1.5"
                        onClick={() => formLoad(c)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm ml-1.5"
                        onClick={() => remove(c)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}

      <form className="flex flex-col gap-2" onSubmit={submit}>
        <div className="panel-title">
          {editing ? `Edit "${editing.name}"` : 'New category'}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input"
            placeholder="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            disabled={editing !== null}
          />
          <input
            className="input"
            placeholder="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CategoryIcon
            icon={icon.trim() === '' ? null : icon.trim()}
            categoryId={editing?.id ?? 0}
            size={20}
          />
          <input
            className="input"
            placeholder="icon URL / key (optional)"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
          />
          <label className="btn">
            {iconUploading ? 'Uploading…' : 'Upload'}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={iconUploading}
              onChange={(e) => onPickIcon(e.target.files?.[0])}
            />
          </label>
        </div>
        <IconPicker value={icon} onPick={setIcon} />
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input"
            placeholder="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          />
          <select
            className="select"
            value={parent}
            onChange={(e) => setParent(e.target.value)}
            disabled={editingHasChildren}
            aria-label="Group"
            title={
              editingHasChildren
                ? 'This category is a group (has children) and can’t be nested.'
                : 'Group (parent category)'
            }
          >
            <option value="">— top level (no group) —</option>
            {categories
              .filter((c) => c.parentId === null && c.id !== editing?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" type="submit">
            {editing ? 'Save' : 'Add category'}
          </button>
          {editing && (
            <button type="button" className="btn" onClick={formReset}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
