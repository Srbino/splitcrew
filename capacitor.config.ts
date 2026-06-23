import type { CapacitorConfig } from '@capacitor/cli';

/**
 * CrewSplit native (iOS/Android) — "hybrid / live" mode.
 *
 * The app is a Next.js SSR app, so we don't bundle a static export. Instead the
 * native shell loads the deployed site (server.url) inside a managed WebView and
 * the native bridge (status bar, splash, back button, push…) is injected on top.
 * Deploy the web app → the native apps update instantly, no rebuild needed.
 *
 * webDir points to a tiny offline fallback shown only if the live site is
 * unreachable. For local device testing against `npm run dev`, temporarily set
 * server.url to http://<your-LAN-ip>:3000 and server.cleartext = true.
 */
const config: CapacitorConfig = {
  appId: 'cz.unify.crewsplit',
  appName: 'CrewSplit',
  webDir: 'native/www',
  server: {
    url: 'https://crewsplit.vercel.app',
    cleartext: false,
  },
  backgroundColor: '#000000',
  ios: {
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#000000',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    Keyboard: {
      resize: 'native',
    },
  },
};

export default config;
