'use client';

import { useMemo, useState } from 'react';
import type { CategoryResponse } from '../types';
import { categoryColor } from '../map/layers';
import { CategoryIcon } from './CategoryIcon';

export interface CategoryPanelProps {
  categories: CategoryResponse[];
  /** Marker count per category id ON THIS MAP (0 if absent). */
  counts: ReadonlyMap<number, number>;
  /** Category ids currently HIDDEN; everything else is shown. */
  hidden: Set<number>;
  /** Flip one category between shown and hidden. */
  onToggle: (id: number) => void;
  /** Hide (true) or show (false) a batch of ids at once — group toggles. */
  onSetMany: (ids: number[], hidden: boolean) => void;
}

interface CategoryNode {
  category: CategoryResponse;
  children: CategoryResponse[];
}

/**
 * Build a one-level nesting tree from the flat category list. Top-level
 * categories are those with no parentId (or whose parent is absent from the
 * list). A top-level category WITH children renders as a group; without
 * children it's an ordinary category. Both levels sort by sortOrder then name
 * for stable display.
 */
function buildTree(categories: CategoryResponse[]): CategoryNode[] {
  const byId = new Map<number, CategoryResponse>();
  for (const c of categories) byId.set(c.id, c);

  const sortFn = (a: CategoryResponse, b: CategoryResponse): number =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

  const roots: CategoryResponse[] = [];
  const childrenOf = new Map<number, CategoryResponse[]>();

  for (const c of categories) {
    const isRoot = c.parentId === null || !byId.has(c.parentId);
    if (isRoot) {
      roots.push(c);
    } else {
      const list = childrenOf.get(c.parentId as number) ?? [];
      list.push(c);
      childrenOf.set(c.parentId as number, list);
    }
  }

  roots.sort(sortFn);
  return roots.map((category) => ({
    category,
    children: (childrenOf.get(category.id) ?? []).sort(sortFn),
  }));
}

/** Down chevron that rotates to point right when the group is collapsed. */
function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`flex-none text-fg transition-transform ${
        collapsed ? '-rotate-90' : ''
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
  );
}

/**
 * The colored visibility indicator at the right of a section header. Filled in
 * the category's own color with a check when shown; an empty outline when
 * hidden; filled with a dash when a group is partially shown.
 */
function ColorCheck({
  color,
  checked,
  indeterminate,
}: {
  color: string;
  checked: boolean;
  indeterminate: boolean;
}) {
  const filled = checked || indeterminate;
  return (
    <span
      aria-hidden="true"
      className="flex h-[19px] w-[19px] flex-none items-center justify-center rounded-[6px] border-2 transition-colors"
      style={{ borderColor: color, background: filled ? color : 'transparent' }}
    >
      {checked ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 13l4 4 10-12"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : indeterminate ? (
        <span className="h-[3px] w-2.5 rounded-full bg-white" />
      ) : null}
    </span>
  );
}

/**
 * Category visibility list, styled as the side-menu sections from the Figma
 * import. Each parent category is a collapsible section header with a colored
 * visibility check; its children render as a two-column grid of glyph + name +
 * per-map count. A childless category renders as a single section row. Only
 * categories with markers on THIS map appear (categories are game-scoped, so a
 * map uses a subset). Toggling a row hides/shows that category on the map.
 */
export const CategoryPanel: React.FC<CategoryPanelProps> = ({
  categories,
  counts,
  hidden,
  onToggle,
  onSetMany,
}) => {
  const tree = useMemo(() => buildTree(categories), [categories]);
  // Only categories with at least one marker ON THIS MAP appear. For groups,
  // drop empty children and keep the group when the parent or any child has
  // markers.
  const displayed = useMemo(() => {
    const has = (id: number) => (counts.get(id) ?? 0) > 0;
    return tree
      .map((node) => ({
        category: node.category,
        children: node.children.filter((c) => has(c.id)),
      }))
      .filter((node) => node.children.length > 0 || has(node.category.id));
  }, [tree, counts]);
  // Collapsed group ids; groups start expanded.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  if (displayed.length === 0) {
    return (
      <div className="px-1 text-sm text-fg-dim">No markers on this map yet.</div>
    );
  }

  const toggleCollapse = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // React.JSX (not the global JSX namespace, which React 19 types removed).
  const renderItem = (category: CategoryResponse): React.JSX.Element => {
    const isHidden = hidden.has(category.id);
    return (
      <button
        key={category.id}
        type="button"
        onClick={() => onToggle(category.id)}
        className={`flex items-center gap-1.5 rounded-md px-1 py-1 text-left text-sm hover:bg-white/5${
          isHidden ? ' opacity-40' : ''
        }`}
      >
        <CategoryIcon icon={category.icon} categoryId={category.id} size={15} />
        <span className="min-w-0 flex-1 truncate">{category.name}</span>
        <span className="flex-none text-xs font-bold tabular-nums text-fg">
          {counts.get(category.id) ?? 0}
        </span>
      </button>
    );
  };

  const renderLeaf = (category: CategoryResponse): React.JSX.Element => {
    const isHidden = hidden.has(category.id);
    return (
      <button
        key={category.id}
        type="button"
        onClick={() => onToggle(category.id)}
        className="section-row"
      >
        <CategoryIcon icon={category.icon} categoryId={category.id} size={18} />
        <span
          className={`section-title min-w-0 flex-1 truncate${
            isHidden ? ' opacity-45' : ''
          }`}
        >
          {category.name}
        </span>
        <span className="flex-none text-xs font-bold tabular-nums text-fg">
          {counts.get(category.id) ?? 0}
        </span>
        <ColorCheck
          color={categoryColor(category.id)}
          checked={!isHidden}
          indeterminate={false}
        />
      </button>
    );
  };

  const renderGroup = (node: CategoryNode): React.JSX.Element => {
    const memberIds = [node.category.id, ...node.children.map((c) => c.id)];
    const hiddenInGroup = memberIds.filter((id) => hidden.has(id)).length;
    const groupAllVisible = hiddenInGroup === 0;
    const groupAllHidden = hiddenInGroup === memberIds.length;
    const isCollapsed = collapsed.has(node.category.id);

    return (
      <div key={node.category.id} className="flex flex-col">
        <div className="flex items-center gap-1 rounded-lg px-1 hover:bg-white/5">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left"
            aria-expanded={!isCollapsed}
            onClick={() => toggleCollapse(node.category.id)}
          >
            <Chevron collapsed={isCollapsed} />
            <CategoryIcon
              icon={node.category.icon}
              categoryId={node.category.id}
              size={18}
            />
            <span
              className={`section-title min-w-0 flex-1 truncate${
                groupAllHidden ? ' opacity-45' : ''
              }`}
            >
              {node.category.name}
            </span>
          </button>
          <button
            type="button"
            className="flex-none p-1"
            aria-label={`Toggle ${node.category.name}`}
            // All visible -> hide the group; otherwise -> show all members.
            onClick={() => onSetMany(memberIds, groupAllVisible)}
          >
            <ColorCheck
              color={categoryColor(node.category.id)}
              checked={groupAllVisible}
              indeterminate={!groupAllVisible && !groupAllHidden}
            />
          </button>
        </div>
        {!isCollapsed && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pb-1 pl-6">
            {node.children.map((child) => renderItem(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-0.5">
      {displayed.map((node) =>
        node.children.length > 0 ? renderGroup(node) : renderLeaf(node.category),
      )}
    </div>
  );
};
