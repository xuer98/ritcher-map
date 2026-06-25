'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastKind = 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

// Module-level monotonic id — survives re-renders without a ref and is unique
// across every hook instance on the page.
let nextToastId = 1;

/**
 * Transient success/error notifications. Self-contained (no context/provider):
 * a component calls `useToasts()` and renders <ToastViewport> with the result.
 * Each toast auto-dismisses after `timeoutMs`; clicking it dismisses early.
 */
export function useToasts(timeoutMs = 3500) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextToastId++;
      setToasts((list) => [...list, { id, kind, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), timeoutMs),
      );
      return id;
    },
    [dismiss, timeoutMs],
  );

  // Clear any pending timers if the host unmounts mid-toast.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const handle of map.values()) clearTimeout(handle);
      map.clear();
    };
  }, []);

  return { toasts, notify, dismiss };
}

/** Fixed bottom-right stack of toasts. Renders nothing when the list is empty. */
export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-[2000] flex w-[min(92vw,360px)] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onDismiss(t.id)}
          className={`flex w-full items-start gap-2 rounded-card border bg-panel px-3 py-2.5 text-left text-sm text-fg shadow-panel backdrop-blur-md transition-colors hover:bg-white/[0.06] ${
            t.kind === 'success' ? 'border-success/50' : 'border-danger/50'
          }`}
        >
          <span
            aria-hidden="true"
            className={`flex-none font-bold ${
              t.kind === 'success' ? 'text-success' : 'text-danger'
            }`}
          >
            {t.kind === 'success' ? '✓' : '✕'}
          </span>
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            {t.message}
          </span>
        </button>
      ))}
    </div>
  );
}
