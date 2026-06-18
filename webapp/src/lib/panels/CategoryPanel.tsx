'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CategoryResponse } from '../types';
import { CategoryIcon } from './CategoryIcon';

export interface CategoryPanelProps {
  categories: CategoryResponse[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  /** Select (add) or deselect (remove) a batch of ids at once — group toggles. */
  onToggleMany: (ids: number[], select: boolean) => void;
  onToggleAll: () => void;
}

interface CategoryNode {
  category: CategoryResponse;
  children: CategoryResponse[];
}

/**
 * Build a one-level nesting tree from the flat category list. Top-level
 * categories are those with no parentId (or whose parent is absent from the
 * list). A top-level category WITH children renders as a group; without
 * children it's an ordinary selectable category. Both levels sort by sortOrder
 * then name for stable display.
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

/** A checkbox that supports the tri-state (indeterminate) DOM flag. */
function TriCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange} />
  );
}

/** Down chevron that rotates to point right when the group is collapsed. */
function Chevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`flex-none text-fg-dim transition-transform ${
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
 * Category filter list. Convention: an EMPTY selection means "show ALL".
 * The "All" toggle clears the selection (back to showing everything). Parent
 * categories render as collapsible groups whose master toggle selects/clears
 * every member (the parent plus its children) at once.
 */
export const CategoryPanel: React.FC<CategoryPanelProps> = ({
  categories,
  selected,
  onToggle,
  onToggleMany,
  onToggleAll,
}) => {
  const tree = useMemo(() => buildTree(categories), [categories]);
  const allActive = selected.size === 0;
  // Collapsed group ids; groups start expanded.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  if (categories.length === 0) {
    return (
      <div className="panel">
        <div className="panel-title">Categories</div>
        <div className="text-sm text-fg-dim">No categories for this map.</div>
      </div>
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
  const renderRow = (
    category: CategoryResponse,
    nested: boolean,
  ): React.JSX.Element => {
    const isSelected = selected.has(category.id);
    return (
      <label
        key={category.id}
        className={`flex items-center gap-2 text-sm px-1.5 py-1 rounded-md cursor-pointer select-none hover:bg-white/5${
          nested ? ' ml-[26px]' : ''
        }${isSelected ? ' bg-accent/[0.14]' : ''}`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(category.id)}
        />
        <CategoryIcon icon={category.icon} categoryId={category.id} />
        <span className="flex-1 min-w-0 truncate">{category.name}</span>
      </label>
    );
  };

  const renderGroup = (node: CategoryNode): React.JSX.Element => {
    const memberIds = [node.category.id, ...node.children.map((c) => c.id)];
    const selCount = memberIds.filter((id) => selected.has(id)).length;
    const allSelected = selCount === memberIds.length;
    const someSelected = selCount > 0;
    const isCollapsed = collapsed.has(node.category.id);

    return (
      <div key={node.category.id} className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 text-sm px-1.5 py-1 rounded-md hover:bg-white/5">
          <TriCheckbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={() => onToggleMany(memberIds, !allSelected)}
          />
          <button
            type="button"
            className="flex flex-1 min-w-0 items-center gap-2 cursor-pointer select-none text-left"
            aria-expanded={!isCollapsed}
            onClick={() => toggleCollapse(node.category.id)}
          >
            <Chevron collapsed={isCollapsed} />
            <CategoryIcon icon={node.category.icon} categoryId={node.category.id} />
            <span className="flex-1 min-w-0 truncate font-semibold">
              {node.category.name}
            </span>
            <span className="flex-none text-xs text-fg-dim tabular-nums">
              {node.children.length}
            </span>
          </button>
        </div>
        {!isCollapsed && node.children.map((child) => renderRow(child, true))}
      </div>
    );
  };

  return (
    <div className="panel">
      <div className="panel-title">Categories</div>
      <label
        className={`flex items-center gap-2 text-sm px-1.5 py-1 cursor-pointer select-none hover:bg-white/5 border-b border-edge rounded-none pb-2 font-semibold${
          allActive ? ' bg-accent/[0.14]' : ''
        }`}
      >
        <input type="checkbox" checked={allActive} onChange={onToggleAll} />
        <span className="flex-1 min-w-0 truncate">All</span>
      </label>
      <div className="flex flex-col gap-1.5 max-h-[40vh] overflow-y-auto">
        {tree.map((node) =>
          node.children.length > 0
            ? renderGroup(node)
            : renderRow(node.category, false),
        )}
      </div>
    </div>
  );
};
