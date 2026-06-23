/**
 * Generate Capacitor source assets (assets/icon.png, splash.png, splash-dark.png)
 * from the existing PWA icon. Run once (or after changing the icon):
 *   node scripts/gen-native-assets.mjs
 * Then, after `npx cap add ios/android`, run `npm run cap:assets` to produce the
 * platform icon/splash sets. Replace assets/icon.png with a crisp 1024×1024
 * original for best quality — this script only upscales the 512 PWA icon.
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = 'public/icon-512.png';
const OUT = 'assets';
const BG = { r: 0, g: 0, b: 0, alpha: 1 }; // black background

await mkdir(OUT, { recursive: true });

// 1024×1024 app icon
await sharp(SRC).resize(1024, 1024, { fit: 'cover' }).png().toFile(`${OUT}/icon.png`);

// 2732×2732 splash: black canvas with the logo centered (~600px)
const logo = await sharp(SRC).resize(600, 600, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const makeSplash = (file) =>
  sharp({ create: { width: 2732, height: 2732, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(`${OUT}/${file}`);

await makeSplash('splash.png');
await makeSplash('splash-dark.png');

console.log('✓ Wrote assets/icon.png, assets/splash.png, assets/splash-dark.png');
