'use client';

import { useEffect } from 'react';

/**
 * Wires native niceties when the web app runs inside the Capacitor shell
 * (iOS/Android). On the plain web it does nothing — every Capacitor call is
 * guarded by isNativePlatform() and the plugin packages are imported lazily so
 * they never touch the server render or bloat the initial bundle.
 *
 * Handles: status-bar style (follows dark mode), hiding the splash screen once
 * the page is interactive, the Android hardware back button, and opening
 * external links in the system browser instead of navigating away inside the app.
 */
export function NativeBridge() {
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;

      // Status bar — match the current theme
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        const apply = async () => {
          const dark = document.documentElement.classList.contains('dark');
          await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
        };
        await apply();
        const observer = new MutationObserver(apply);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        cleanups.push(() => observer.disconnect());
      } catch { /* plugin missing — ignore */ }

      // Hide the splash screen once we're up
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide();
      } catch { /* ignore */ }

      // Android hardware back button → browser history, or exit at the root
      try {
        const { App } = await import('@capacitor/app');
        const sub = await App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else App.exitApp();
        });
        cleanups.push(() => { sub.remove(); });
      } catch { /* ignore */ }

      // External links → open in the system browser (don't trap them in the WebView)
      try {
        const { Browser } = await import('@capacitor/browser');
        const onClick = (e: MouseEvent) => {
          const anchor = (e.target as HTMLElement)?.closest?.('a') as HTMLAnchorElement | null;
          if (!anchor?.href) return;
          let url: URL;
          try { url = new URL(anchor.href); } catch { return; }
          if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
          const external = url.host !== window.location.host || anchor.target === '_blank';
          if (external) {
            e.preventDefault();
            Browser.open({ url: url.href }).catch(() => {});
          }
        };
        document.addEventListener('click', onClick);
        cleanups.push(() => document.removeEventListener('click', onClick));
      } catch { /* ignore */ }
    })();

    return () => { for (const c of cleanups) c(); };
  }, []);

  return null;
}
