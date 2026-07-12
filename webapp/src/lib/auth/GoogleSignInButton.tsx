'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { GOOGLE_CLIENT_ID } from '../config';

/** Google Identity Services script (loaded on demand, once per page). */
const GSI_SRC = 'https://accounts.google.com/gsi/client';

interface CredentialResponse {
  credential: string;
}

interface GsiIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      width?: number;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GsiIdApi } };
  }
}

/** Resolves once the GIS script is available; rejects if it fails to load. */
function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const fail = () => reject(new Error('Failed to load Google sign-in'));
    // A previous mount may have injected the tag already; piggyback on it.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SRC}"]`,
    );
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', fail, { once: true });
    if (!existing) {
      script.src = GSI_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

export interface GoogleSignInButtonProps {
  /** Called after a successful sign-in (e.g. to close the login modal). */
  onSuccess?: () => void;
  /** Called with a user-facing message when sign-in fails. */
  onError?: (message: string) => void;
}

/**
 * The official "Sign in with Google" button (GIS ID-token flow). Google hands
 * the callback a signed ID token; we exchange it at POST /auth/google for our
 * own session token. Renders nothing when NEXT_PUBLIC_GOOGLE_CLIENT_ID is
 * unset or the GIS script can't load, so password auth is never blocked.
 */
export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
}) => {
  const { loginWithGoogle } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  // Keep the latest callbacks in refs: GIS `initialize` captures its callback
  // once, and re-initializing on every render would be wasteful.
  const loginRef = useRef(loginWithGoogle);
  loginRef.current = loginWithGoogle;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    loadGsiScript()
      .then(() => {
        if (cancelled) return;
        const gsi = window.google?.accounts?.id;
        const container = containerRef.current;
        if (!gsi || !container) return;

        gsi.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            void (async () => {
              try {
                await loginRef.current(response.credential);
                onSuccessRef.current?.();
              } catch (err) {
                onErrorRef.current?.(
                  err instanceof Error ? err.message : 'Google sign-in failed',
                );
              }
            })();
          },
        });
        // GIS wants a fixed pixel width (200–400); track the modal's width.
        container.replaceChildren();
        gsi.renderButton(container, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width: Math.min(400, Math.max(200, container.clientWidth || 312)),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID || failed) return null;
  return <div ref={containerRef} className="min-h-10" />;
};
