# CrewSplit — iOS / Android (Capacitor)

Jak je appka připravená na nativní obal a co zbývá udělat na tvém Macu.

## Architektura: Capacitor „hybrid / live"

Appka je **Next.js SSR** (`output: 'standalone'`), takže se **nedělá statický export**.
Nativní obal (Capacitor) místo toho načítá **nasazený web** (`server.url =
https://crewsplit.vercel.app`) v nativním WebView a navrch přidává nativní vrstvu
(status bar, splash, back button, push…).

Důsledky:
- ✅ **Nulové přepisování frontendu**, jeden codebase.
- ✅ **Okamžité aktualizace**: deploy webu → appky se aktualizují bez nového buildu/storu.
- ✅ Session cookie (iron-session) funguje normálně — WebView má origin produkční domény.
- ⚠️ Vyžaduje internet (offline jen fallback obrazovka `native/www/index.html`).
- ⚠️ Apple guideline 4.2 (min. funkčnost) — riziko snižuje nativní push + nativní chování;
  do storu pošli appku, co působí jako appka, ne „web v rámečku".

## Co MÁME ✅
- PWA: `manifest.ts`, ikony (192/512, apple-touch), `viewport-fit: cover`, safe-area
  (spodní nav), dark mode, `appleWebApp.capable`.
- **Capacitor 8** nainstalovaný + `capacitor.config.ts` (hybrid/live na produkci).
- Pluginy: `app`, `status-bar`, `splash-screen`, `browser`, `keyboard`.
- **Native bridge** (`src/components/native/native-bridge.tsx`, mountnutý v root layoutu):
  status bar dle theme, skrytí splash, Android back button, externí odkazy do
  systémového prohlížeče. Na webu je inertní (no-op).
- Zdrojové native assety (`assets/icon.png` 1024, `assets/splash*.png` 2732) + generátor
  `npm run native:assets`.
- Offline fallback obrazovka.
- npm scripty pro celý Capacitor workflow.

## Co NEMÁME / je potřeba dodělat ⚠️
- **Nativní projekty `ios/` a `android/`** — generují se příkazem `cap add` (potřebují
  Xcode / Android Studio, na tomto stroji nebyly k dispozici).
- **Push notifikace** nativně — připravený plán níže (potřebuje APNs klíč + FCM projekt).
- **Účty:** Apple Developer Program (99 $/rok), Google Play (25 $ jednorázově).
- **Podpis, build, screenshoty, popisy, odeslání do storů** — jen na tvém Macu.
- (Volitelně) **Service worker** pro plné PWA offline — pro Capacitor hybrid není nutný.

## Build — krok za krokem (na Macu)

Předpoklady: **Xcode** (iOS) + **Android Studio**/JDK 21 (Android), CocoaPods (`sudo gem
install cocoapods` nebo `brew install cocoapods`).

```bash
# 1) přidat nativní platformy (jednorázově)
npm run cap:add:ios
npm run cap:add:android

# 2) vygenerovat ikony a splash do nativních projektů
npm run native:assets   # (přepíše assets/* ze stávající ikony — můžeš nahradit 1024² originálem)
npm run cap:assets

# 3) sync (po každé změně configu/pluginů)
npm run cap:sync

# 4) otevřít v IDE a spustit/podepsat
npm run cap:open:ios       # → Xcode: vybrat tým, Run na zařízení/simulátoru
npm run cap:open:android   # → Android Studio: Run, build APK/AAB
```

Pozn.: appId je `cz.unify.crewsplit`, název „CrewSplit" — změň v `capacitor.config.ts`,
pokud chceš jiné (před prvním `cap add`).

### Lokální test proti `npm run dev`
Dočasně v `capacitor.config.ts`: `server.url = 'http://<LAN-ip>:3000'`, `cleartext: true`,
`npm run dev`, `cap sync`, spustit na zařízení ve stejné síti. Pak vrátit zpět na produkci.

## Push notifikace (další krok)
Appka už má vlastní in-app notifikace (zvonek) přes `/api/notifications`. Pro **nativní
push**:
1. `npm i @capacitor/push-notifications`.
2. iOS: APNs Auth Key v Apple Developer + zapnout Push v Xcode capabilities.
3. Android: Firebase projekt → `google-services.json` do `android/app/`.
4. Při startu (v native bridge) requestnout práva, zaregistrovat token, poslat na backend
   (nová tabulka `device_tokens`), a posílat push při událostech (uzavření peněženky,
   schválení výdaje…). Doručování přes FCM (Android) a APNs (iOS) z backendu/cronu.

## Store assety (k doplnění)
- Ikona 1024² (App Store), feature graphic (Play), screenshoty (různé velikosti),
  popis, klíčová slova, privacy policy URL, věkové hodnocení.
- Privacy: appka ukládá jména/e-maily/avatary → potřebuje **zásady ochrany údajů** (URL).

## Kde co je
- `capacitor.config.ts` — konfigurace (appId, server.url, splash).
- `src/components/native/native-bridge.tsx` — nativní chování (web-side).
- `native/www/index.html` — offline fallback.
- `assets/` — zdrojové ikony/splash; `scripts/gen-native-assets.mjs` je generuje.
- `ios/`, `android/` — vzniknou po `cap add` (gitignorované build artefakty).
