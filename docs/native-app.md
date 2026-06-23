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

## Co je HOTOVÉ navíc (toolchain + projekty) ✅
- Nainstalovaný toolchain: **JDK 21** (`openjdk@21`), **Android SDK** (cmdline-tools,
  platform-tools, android-35, build-tools 35.0.0), **CocoaPods** (pro jistotu; Capacitor 8
  iOS ale používá **Swift Package Manager**, Pody nejsou potřeba).
- **Nativní projekty `android/` i `ios/` vygenerované a v repu** (`cap add`).
- **Android APK se úspěšně builduje** (`./gradlew assembleDebug` → `app-debug.apk`, ověřeno).
- iOS projekt (`ios/App/App.xcodeproj` + SPM `CapApp-SPM/Package.swift`) připravený k
  otevření v Xcode.
- Ikony + splash vygenerované do obou projektů (android 100, ios 13).

## Co NEMÁME / je potřeba dodělat ⚠️
- **iOS build/spuštění** — potřebuje **plný Xcode** (na tomto stroji byly jen Command Line
  Tools; Xcode nejde nainstalovat z CLI). Na tvém Macu: `npm run cap:open:ios` → Run.
- **Push notifikace** nativně — plán níže (APNs klíč + FCM projekt).
- **Účty:** Apple Developer Program (99 $/rok), Google Play (25 $ jednorázově).
- **Podpis (signing), screenshoty, popisy, odeslání do storů** — jen na tvém Macu.
- (Volitelně) **Service worker** pro plné PWA offline — pro Capacitor hybrid není nutný.

## Build — krok za krokem

Projekty už jsou vygenerované a v repu. Po `git clone` na jiném stroji stačí
`npm install` a `npm run cap:sync`.

**Android (funguje i z příkazové řádky):**
```bash
export JAVA_HOME="$(brew --prefix openjdk@21)"
export ANDROID_HOME="$(brew --prefix)/share/android-commandlinetools"
npm run cap:sync
cd android && ./gradlew assembleDebug     # → app/build/outputs/apk/debug/app-debug.apk
# nebo ./gradlew bundleRelease pro AAB do Play Store (potřebuje keystore/podpis)
```

**iOS (potřebuje plný Xcode):**
```bash
npm run cap:sync
npm run cap:open:ios     # → Xcode: vyber Team (Signing & Capabilities), Run / Archive
```

**Po změně ikony** (`assets/icon.png` ideálně 1024²): `npm run native:assets && npm run cap:assets && npm run cap:sync`.

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
