import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createCustomMarker,
  deleteCustomMarker,
  listCustomMarkers,
  updateCustomMarker,
  type CustomMarker,
  type CustomMarkerInput,
} from '../api/customMarkers';

export interface CustomMarkersStore {
  markers: CustomMarker[];
  loading: boolean;
  /** Persist a new marker; resolves with the created row (server-assigned id). */
  create: (input: CustomMarkerInput) => Promise<CustomMarker>;
  /** Patch a marker (optimistic; rolls back on failure). */
  update: (id: string, patch: Partial<CustomMarkerInput>) => Promise<void>;
  /** Delete a marker (optimistic; restores on failure). */
  remove: (id: string) => Promise<void>;
}

/**
 * Per-user custom markers for a map. Authed-only — mirrors the progress feature:
 * an anonymous user gets an empty list and the callers gate writes behind the
 * login modal. No WebSocket sync in v1 (markers re-fetch on map change);
 * mutations apply optimistically with a guarded rollback.
 */
export function useCustomMarkers(
  mapId: number | null,
  authed: boolean,
): CustomMarkersStore {
  const [markers, setMarkers] = useState<CustomMarker[]>([]);
  const [loading, setLoading] = useState(false);

  // Latest list for handlers/rollbacks without re-subscribing the load effect.
  const markersRef = useRef<CustomMarker[]>(markers);
  markersRef.current = markers;

  // Per-id mutation sequence. A success-replace or rollback only applies if it
  // belongs to the LATEST in-flight mutation for that id — otherwise a slow
  // earlier request (e.g. a prior drag) would clobber a newer saved position.
  const seqRef = useRef<Map<string, number>>(new Map());

  const active = authed && mapId !== null;

  useEffect(() => {
    if (!active || mapId === null) {
      setMarkers([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listCustomMarkers(mapId)
      .then((list) => {
        if (!cancelled) setMarkers(list);
      })
      .catch(() => {
        if (!cancelled) setMarkers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, mapId]);

  const create = useCallback(
    async (input: CustomMarkerInput): Promise<CustomMarker> => {
      if (mapId === null || !authed) {
        throw new Error('not signed in');
      }
      const created = await createCustomMarker(mapId, input);
      setMarkers((prev) => [...prev, created]);
      return created;
    },
    [mapId, authed],
  );

  const update = useCallback(
    async (id: string, patch: Partial<CustomMarkerInput>): Promise<void> => {
      const before = markersRef.current.find((m) => m.id === id);
      if (!before) return;
      const seq = (seqRef.current.get(id) ?? 0) + 1;
      seqRef.current.set(id, seq);
      const isLatest = () => seqRef.current.get(id) === seq;
      // Optimistic.
      setMarkers((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
      try {
        const saved = await updateCustomMarker(id, patch);
        // Replace with the authoritative row (e.g. refreshed updatedAt) — but
        // only if a newer mutation for this id hasn't superseded us.
        if (isLatest()) {
          setMarkers((prev) => prev.map((m) => (m.id === id ? saved : m)));
        }
      } catch (err) {
        // Roll back to the pre-edit row, unless a newer mutation owns it now.
        if (isLatest()) {
          setMarkers((prev) => prev.map((m) => (m.id === id ? before : m)));
        }
        throw err;
      }
    },
    [],
  );

  const remove = useCallback(async (id: string): Promise<void> => {
    const snapshot = markersRef.current;
    if (!snapshot.some((m) => m.id === id)) return;
    // Optimistic.
    setMarkers((prev) => prev.filter((m) => m.id !== id));
    try {
      await deleteCustomMarker(id);
    } catch (err) {
      // Restore the full pre-delete list.
      setMarkers(snapshot);
      throw err;
    }
  }, []);

  return { markers, loading, create, update, remove };
}
