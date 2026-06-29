'use client';

import { useState } from 'react';
import type { CustomMarker } from '../api/customMarkers';
import {
  CUSTOM_MARKER_DEFAULT_COLOR,
  CUSTOM_MARKER_PALETTE,
} from '../map/customMarkers';

/** What the editor is editing: a brand-new pin at a point, or an existing one. */
export type CustomMarkerTarget =
  | { kind: 'new'; x: number; y: number }
  | { kind: 'edit'; marker: CustomMarker };

export interface CustomMarkerEditorProps {
  target: CustomMarkerTarget;
  /** A save/delete request is in flight. */
  busy: boolean;
  /** A failed save/delete message to show inline (e.g. the per-map cap). */
  error?: string | null;
  onSave: (values: {
    label: string | null;
    note: string | null;
    color: string | null;
  }) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Bottom-sheet editor for a user's custom marker — same container styling as
 * MarkerDetail. Field state is local and seeded from `target`; MapScreen remounts
 * this (via a `key`) when the target changes, so the seed always matches.
 */
export const CustomMarkerEditor: React.FC<CustomMarkerEditorProps> = ({
  target,
  busy,
  error,
  onSave,
  onDelete,
  onClose,
}) => {
  const existing = target.kind === 'edit' ? target.marker : null;
  const [label, setLabel] = useState(existing?.label ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [color, setColor] = useState(
    existing?.color ?? CUSTOM_MARKER_DEFAULT_COLOR,
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      label: label.trim() === '' ? null : label.trim(),
      note: note.trim() === '' ? null : note.trim(),
      color,
    });
  };

  return (
    // Matches MarkerDetail: mobile bottom sheet (≤50dvh), floating card on sm+.
    <div className="absolute inset-x-0 bottom-0 z-20 flex max-h-[60dvh] flex-col gap-2.5 overflow-y-auto rounded-t-card border border-edge bg-panel p-4 shadow-panel backdrop-blur-md sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-80 sm:max-w-[calc(100vw-32px)] sm:rounded-card">
      <button
        type="button"
        className="absolute right-3 top-2.5 cursor-pointer border-0 bg-transparent text-[22px] leading-none text-fg-dim hover:text-fg"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-fg-dim">
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white"
          style={{ background: color }}
        />
        {existing ? 'Edit my marker' : 'New marker'}
      </div>

      <form className="flex flex-col gap-2.5" onSubmit={submit}>
        <input
          className="input"
          placeholder="Label"
          value={label}
          maxLength={120}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
        />
        <textarea
          className="textarea"
          placeholder="Note (optional)"
          rows={3}
          maxLength={4000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex flex-wrap items-center gap-1.5">
          {CUSTOM_MARKER_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              aria-pressed={c === color}
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 transition-transform${
                c === color
                  ? ' scale-110 border-white'
                  : ' border-transparent hover:scale-105'
              }`}
              style={{ background: c }}
            />
          ))}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t border-edge pt-2.5">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : existing ? 'Save' : 'Add marker'}
          </button>
          {existing && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={onDelete}
              disabled={busy}
            >
              Delete
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
