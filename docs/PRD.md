# PRD — Platforma „sdílené výdaje + koordinace" (pracovně CrewSplit → v2)

> Verze 1.0 (konsolidováno 2026-06-23). Žijící dokument. Shrnuje veškeré know-how z analýzy,
> hloubkového competitor/monetizačního researche a produktových rozhodnutí. Slouží jako
> zadání pro v2 (nové repo vycházející ze splitcrew).
> Lokace: `docs/PRD.md` v repu splitcrew (zkopírovat do nového v2 repa).

---

## 0. TL;DR
Jedna appka pro **kompletní pohyby peněz + koordinaci skupiny** — od „rozpočítat pivka"
přes výlety/plachtění/roadtrip/domácnost/auto až po **B2B zájezdovky/zážitkovky**.
Postaveno jako **platforma: Workspace × Moduly (pluginy) × Šablony**. Jádro (dělení výdajů +
vyrovnání) **zdarma** (tak to dělají všichni lídři); peníze z **B2B operátorů + Pro upsell +
plateb**. Web-first (PWA + Capacitor), placení **na webu** (žádná Apple/Google daň), ČR killer
featura **QR Platba** u vyrovnání. „Dělat správně od začátku" = **multi-tenant + plugin kernel
+ entitlementy** jako P0.

---

## 1. Problém & příležitost (podloženo researchem)
- Dělení výdajů je **masový trh**, ale **za jádro nikdo neplatí** — Tricount (21 M uživatelů,
  175 zemí, 16,4 mld. € rozpočítáno 2024) je 100 % free; Splitwise/Settle Up dávají jádro free.
- **Peníze tečou jinde:** B2B group-travel operátoři (SquadTrip ~6 % z hodnoty + $29/měs;
  WeTravel $79/měs), consumer prémiové featury (OCR, export, recurring, bez reklam) a payment rails.
- **Nikdo nedělá „celou výpravu/akci"** (výdaje + nákupy + jídelníček + deník + itinerář +
  checklist + dokumenty + kasa) → náš moat = šířka, ne dělení účtů.
- ČR výhoda: **QR Platba/SPAYD** (otevřená, zdarma, bez licence) → vyrovnání jde reálně zaplatit.
- ⚠️ Nepoužívat jako fakt: čísla „velikost trhu bill-splittingu" (research je vyvrátil jako
  nedůvěryhodný zdroj). User/volume metriky konkurentů jsou self-reported (směrově OK).

---

## 2. Konkurence
| App | Pricing (2026) | Model | Co umí | Mezera (naše šance) |
|---|---|---|---|---|
| **Settle Up** (CZ) | free+reklama; Premium $3,49/měs / $18,99/rok; group jednorázově $5,49–$134,99 | reklama+předplatné+group | útraty, vyrovnání, export, foto; 1 M MAU | jen útraty |
| **Splitwise** | free (omezené, ~3 výdaje/den); Pro $4,99/měs / $49,99/rok | freemium | útraty, OCR, grafy, multi-měna | jen útraty |
| **Tricount** | zdarma | koupila banka bunq (funnel na kartu) | útraty, OCR, export, in-app pay request (NL/DE/FR/BE) | jen útraty |
| **Splid** | $4,99 jednorázově | one-time | offline, bez účtu, 150 měn | jen útraty |
| **SquadTrip** (B2B) | free + od $29/měs ($299/rok) + **~6 % z bookingu** | SaaS+transaction fee | splátky, upomínky, dashboard plateb | travel-only |
| **WeTravel** (B2B) | $79/měs + processing | SaaS+fee | group-travel platby/booking | travel-only |
| **mTrip / Travefy** (B2B) | white-label / $39/měs +$20/sedadlo | SaaS / per-seat | branded app, itinerář, CRM | travel-only |
| **Spendee** (CZ) | freemium | osobní+sdílené finance, **bank sync** | osobní finance kategorie | ne koordinace akce |

**Závěr:** všichni consumer lídři řeší jen dělení útrat a dávají ho zdarma → **nekonkurovat
cenou jádra, ale kategorií** („celá akce" + B2B + ČR platby).

---

## 3. Cílové segmenty
1. **Consumer skupiny** (akvizice, free): parta na výlet/roadtrip/festival, spolubydlení,
   „jen rozpočítat". Síťový efekt — člen dnes = kapitán/admin zítra. Malí zákazníci = ústní reklama.
2. **B2B malí operátoři** (hlavní příjem): zájezdovky, zážitkové firmy, retreaty, oddíly.
   Dělají hodně akcí → platí SaaS, chtějí branding + report pro klienta.

---

## 4. Jádro produktu: Workspace × Moduly × Šablony + jednotný ledger
- **Workspace** = pojmenovaná jednotka (výlet/akce/skupina/domácnost/projekt). Admin + členové.
- **Sjednocující model:** vše = **jeden ledger (transakce) + účty + členové + moduly**.
  Osobní finance = 1 člen; sdílené = víc členů; **kasa (kitty)** = sdílený účet; **recurring**
  = naplánované transakce; **banka** = importované transakce. → kompletní pohyby peněz i sdílení
  jedním modelem.
- **Moduly** = featury zapínatelné per workspace, postavené jako **pluginy** (manifest + hooky).
- **Šablony** = předvolené sady modulů + obsah. Nová use-case = konfigurace, ne nový kód.

### Generalizace ze splitcrew
- „Loď" → obecná **Skupina/Podskupina** (přejmenovatelná: loď/auto/pokoj/tým). Stávající
  `split_type both/boat1` → „všichni / skupina X" (logika dělení zůstává — je otestovaná, 79 testů).
- Plachtařská specifika (deník, lodě) = jen jeden modul/šablona, ne jádro.

---

## 5. Katalog modulů (pluginy)
- **Jádro (free, vždy):** Výdaje + vyrovnání (kdo komu dluží), QR platba.
- **Sdílené peníze:** Společná kasa (kitty, ledger), Pravidelné/opakované platby, IOU/dluhy 1:1,
  Hromadné rozúčtování (máme).
- **Koordinace (lehké):** Kalendář + upomínky, Checklist/úkoly, Nákupy/inventář, Jídelníček,
  Itinerář, Dokumenty, Deník, Skupiny/auta/pokoje.
- **Osobní finance (fáze 2):** osobní výdaje/příjmy, rozpočty, účty/zůstatky, **bank sync (PSD2)**,
  spořicí cíle, reporty/grafy (grafy máme).
- **Sociální/wallet:** peněženka člena, aktivita (feed), komentáře/chat u položek.
- **B2B/operator:** účastníci, branding/white-label, splátkové plány, report pro klienta,
  platby přes Stripe Connect.
- **Power (placené, průřezové):** OCR účtenek, multi-měna (máme), export/PDF (máme), offline, přílohy.

> Bank sync = vstup do osobních financí (konkurence Spendee/YNAB) → Pro/fáze 2, architektura
> ho má umožnit jako modul.

---

## 6. Šablony — priorita
| # | Šablona | Role | v1 | Monetizace |
|---|---|---|---|---|
| 1 | „Jen rozpočítat" / výlet | masový free core (akvizice) | ✅ | nepřímá (růst) |
| 2 | **Plachtění** (stávající, reální uživatelé) | retence/reference | ✅ | Pro |
| 3 | **Roadtrip / obytňák** | akvizice | ✅ | Pro |
| 4 | **Zájezdovka / operátor (B2B)** | **hlavní příjem** | ✅ | SaaS + % plateb |
| 5 | Domácnost / spolubydlení (nájem, energie, úklid, kalendář+upomínky) | retence (každoměsíční) | brzy | rail + Pro |
| 6 | Auto (palivo, servis, pojistka, splátky) | retence | brzy | rail + Pro |

> Festival/svatby/dárky/sporťáci/kemp/lyžovačky: levné šablony (konfigurace), **ne revenue driver**
> (research nenašel ověřená data o poptávce/penězích).

---

## 7. Monetizace
**Princip: jádro (dělení + vyrovnání + QR) ZDARMA.** Platí se nadstavba a B2B.

### 7.1 Paywall „vyber si N modulů" (zvolený model)
- **Free:** jádro vždy + **až 3 moduly z „lehkého/koordinačního poolu"** + **1 workspace** +
  nenásilné reklamy.
- **Pro (admin/kapitán):** **všechny moduly + víc workspaců** + power (OCR, export, **recurring**,
  **bank sync**, bez reklam). *Peníze-generující moduly (recurring, bank sync, OCR, export)
  NEJSOU ve free poolu.*
- **Business:** B2B (branding/white-label, účastníci, klient report, Stripe Connect).
- Gating přes `workspace_modules` + entitlementy (count/typ modulů) — čistě v plugin systému.

### 7.2 Kdo platí + trik s rozúčtováním
- **Platí admin/kapitán/operátor** (ne za hlavy — členů může být 100 zdarma → virální růst).
- **Pro/předplatné lze rozúčtovat posádce** jako sdílený výdaj → ~desítky Kč/osoba → skoro
  nulové tření (přebráno od Settle Up).

### 7.3 Cenové benchmarky (2026, ověřeno)
Consumer: Splitwise Pro $4,99/měs / $49,99/rok; Settle Up $3,49/měs / $18,99/rok, group
jednorázově $5,49–$134,99. → naše consumer Pro ≈ **$19–50/rok**.
B2B: SquadTrip $29/měs + ~6 %; WeTravel $79/měs; Travefy $39/měs +$20/sedadlo. → naše Business
≈ **$29–79/měs** + později % přes Stripe Connect.

### 7.4 Obcházení Apple/Google daně (legálně)
- Účtování **na webu** (Stripe); v iOS/Android appce **žádné in-app nákupy ani odkaz na platbu**.
  Admin upgraduje v prohlížeči, appka jen **odemkne podle účtu** (entitlement) — jako Notion/Netflix.
- **Web-first:** appka je instalovatelná **PWA** → většina uživatelů nepotřebuje store; nativní
  (Capacitor) jen pro důvěryhodnost/přítomnost. Hlavní fee-free kanál = web + registrace u nás.

### 7.5 Platby / vyrovnání (payment rails)
- **Non-custodial QR Platba/SPAYD (CZ)** — zdarma, bez licence/KYC; vygenerujeme QR, peníze tečou
  přímo mezi bankami. **v1.** EU = **EPC SEPA QR** (částečně, per-trh) později.
- **Custodial** (peníze přes nás, bereme %) = **až přes Stripe Connect pro B2B** (~6 % model);
  vlastní platební licence NEděláme (Non-goal).

---

## 8. Klíčové principy
- **Multi-tenant od první verze** (`workspace_id` na všem, izolace dat). Bez toho nelze škálovat
  ani monetizovat.
- **Web registrace** (admin/operátor = plný účet). **Členové = bez registrace, join přes odkaz +
  magic-link e-mail** (ověření e-mailem → notifikace + návrat na jiném zařízení).
- **Entitlementy** řízené serverem (free/Pro/Business + limit/typ modulů + workspacy).
- **EU data residency** (Neon Frankfurt — dnes us-east!).
- **Náklad na cloud řešit hned** (managed-first, levné free tiery; viz §11–12).
- **Plugin architektura** od začátku → pozdější mini-marketplace (P4+).

---

## 9. Architektura — plugin kernel + moduly
Detail: `docs/architecture-plugins.md`. Shrnutí:

**Kernel (sdílené služby), do kterých se moduly zapojují (a nevolají se navzájem):**
- **Workspace + Entitlementy** — `getWorkspace`, `getEnabledModules`, `can(workspace, feature)`.
- **Event/Kalendář bus** — moduly emitují `CalendarEvent`; kalendář agreguje (`calendar.collect`).
- **Notifikace** — `notify(workspaceId, audience, {type,title,body,link,channels})`; kanály
  in-app (máme) → e-mail → push.
- **Scheduler (cron)** — `/api/cron/tick` projede workspacy × moduly (`onSchedule`), idempotentně
  přes `scheduled_runs`. Pohání recurring + reminders.
- **Platby/QR** — `payments.qr({iban,amount,vs,message})` → SPAYD string → QR.

**Modul = manifest** (`id, nav, entitlement, templates, hooks{calendarEvents,onSchedule,onEvent}`)
+ vlastní tabulky (vždy `workspace_id`). Registry = pole manifestů (později z DB = marketplace).

**Mapování na Next.js:** `src/lib/platform/*` (kernel), `src/modules/<id>/*` (manifest,page,api,
schema), generický router `src/app/(app)/w/[workspaceId]/[module]`, cron `src/app/api/cron/tick`.

### Datový model (plugin-ready)
```
workspaces(id, name, template, owner_user_id, plan, settings_json, created_at)
workspace_members(id, workspace_id, user_id?, guest_name, email, role, joined_at)
workspace_modules(workspace_id, module_id, enabled, config_json)   PK(workspace_id,module_id)
notifications(..., workspace_id) ; notification_reads ; device_tokens (push, později)
recurring_rules(id, workspace_id, module_id, payload_json, rrule, next_run, last_run)
scheduled_runs(workspace_id, key, ran_at)   PK(workspace_id, key)
-- každá modulová tabulka má workspace_id (wallet_expenses, shopping_items, …)
```

---

## 10. Sdílená logika & co už máme hotové (reuse ze splitcrew)
- **`lib/wallet-calc.ts`** (čisté funkce, **79 testů**): výpočet zůstatků, vyrovnání v celých
  centech + exact-match (min. počet plateb), agregace (kategorie/plátce/loď), matice, plán
  hromadného rozúčtování. Ověřeno i na reálných datech.
- Peněženka: výdaje (multi-měna, historické kurzy), **uzávěrka + schvalovací workflow**,
  notifikace (zvonek), přehled s grafy + matice „kdo zaplatil / kolik koho stálo", položkový
  rozpis, **hromadné rozúčtování**, export `trip_report.html`.
- i18n (cs/en), design systém (komponenty), iron-session auth, Capacitor nativní obal.

---

## 11. Hosting & náklady (z researche, 2026)
- **Neon JE Postgres** (managed serverless) — ne „Neon vs Postgres". Pro multi-tenant scale OK:
  PgBouncer (až 10k klientů), autoscaling, read replicas, scale-to-zero, EU region.
- **Vercel + Neon** je technicky sladěné (Fluid compute + `attachDatabasePool`; Neon doporučuje
  `node-postgres` pool — máme). **Cloudflare nedoporučeno** (Workers nedovolí sdílený pool →
  nutný Hyperdrive, komplikace).
- **Self-host Postgres teď = ne** (stal by ses DBA: zálohy/HA/upgrady/PITR). Až při trvale vysokém
  provozu → Hetzner (CX23 ~5,49 €/měs); migrace snadná (`pg_dump`, standardní PG).
- **Odhad nákladů:** MVP $0 (Neon Free 100 CU-h, scale-to-zero; Vercel Hobby — ale komerční =
  Vercel Pro $20); stovky uživatelů ~$25–45/měs (Neon Launch pay-as-you-go $0,106/CU-h, $0,35/GB,
  bez minima); tisíce (nárazově) ~$50–150/měs.
- **Akce hned:** přesun Neonu do **EU/Frankfurt**.

---

## 12. Infra — co máme / chybí (managed-first, EU, cost-aware)
| Oblast | Stav | Doporučení |
|---|---|---|
| DB | ✅ Neon (přesun EU) | Neon Frankfurt |
| App hosting / CDN / secrets | ✅ Vercel | (později Hetzner při velkém stálém provozu) |
| **E-mail** (magic-link, upomínky) | ❌ | **Resend** / Postmark |
| **Object storage** (avatary/účtenky/dokumenty; teď base64 v DB = antipattern) | ⚠️ | **Cloudflare R2** / Vercel Blob |
| **Platby/billing** | ❌ | **Stripe** (+ Connect pro B2B) |
| **Cron / async joby** | ⚠️ Vercel Cron | Vercel Cron; **Inngest/QStash** později |
| **Error tracking** | ❌ | **Sentry** (hned, levné) |
| **Product analytics** (konverze/funnel) | ❌ | **PostHog** (EU) — pro monetizační rozhodnutí |
| Cache / rate-limit | později | Upstash Redis (EU) |
| Push notifikace | později | APNs/FCM (Capacitor) |
| Bank sync (PSD2) | fáze 2 | GoCardless Bank Account Data / Tink |

Prioritně dořešit pro v2: **e-mail + object storage + Stripe + Sentry** (+ avatary ven z DB).

---

## 13. Nativní apps (Capacitor — stav)
- **Hotovo v repu:** Capacitor 8 hybrid/live (načítá nasazený web), pluginy (app, status-bar,
  splash, browser, keyboard), NativeBridge (status bar, splash, back button, externí odkazy),
  ikony/splash, offline fallback. **Android APK i iOS build ověřeně staví.** Xcode 26.5 na
  externím SSD.
- **Zbývá:** Apple Developer Program (99 $/rok, **na firmu — Organization + DIČ → reverse charge,
  daňově uznatelné**), Google Play (25 $), podpis + odeslání. Push = další krok (APNs/FCM).
- Web-first: PWA je primární fee-free kanál; nativní jen pro store přítomnost.

---

## 14. Repo strategie
- **Nové samostatné repo pro v2**, **vycházející ze splitcrew** (fork/kopie — ne psát od nuly).
- **Splitcrew zůstane zmražený** a běží produkčně pro stávající posádku.
- v2: vlastní **GitHub repo + Vercel projekt + Neon (EU) DB**. Data posádky se migrují později
  jako **1. workspace** v v2.
- Reuse: celý kód, `wallet-calc` + testy, komponenty, i18n, Capacitor, tato dokumentace.

---

## 15. v1 scope (co reálně postavit první)
- **P0 — Kernel/základ:** multi-tenant (`workspaces`, `members`, `workspace_modules`,
  `workspace_id` všude), **web registrace (admin) + magic-link členové**, **entitlementy**
  (free/Pro/Business + paywall „N modulů"), migrace splitcrew tripu → 1. workspace bez ztráty dat.
- **P1 — Platforma:** module registry + generická navigace; **4 šablony** (jen rozpočítat/výlet,
  plachtění, roadtrip, zájezdovka); generalizace loď→skupina.
- **P2 — Monetizace (consumer + B2B paralelně):** Stripe na webu, Pro paywall, Business tier,
  **QR Platba** u vyrovnání.
- **v1 průřezové featury:** QR Platba, foto účtenek (bez OCR), **offline režim**, opakované platby,
  kalendář + upomínky (přes notify).
- **Infra v1:** Neon EU, Resend (e-mail), R2 (storage), Sentry.

---

## 16. Roadmap (fáze)
- **P0** Kernel: workspace + members + entitlementy + registrace/magic-link + migrace.
- **P1** Module registry + navigace + 4 šablony + generalizace skupin.
- **P2** Stripe billing + Pro/Business paywall + QR Platba + scheduler (recurring/reminders) + kalendář.
- **P3** B2B doplnit (branding/white-label, účastníci, klient report; později Stripe Connect %).
- **P4** Šířka: osobní finance (bank sync), další šablony, **mini-marketplace** modulů, push.

---

## 17. Rozhodnutí (konsolidováno, 2026-06-23)
- Monetizace **consumer i B2B paralelně**.
- v1 šablony: jen rozpočítat/výlet, **plachtění**, roadtrip, **zájezdovka (B2B)**.
- Branding: **zobecnit, nový anglický popisný název** — TBD (kandidáti §21).
- Platby v1: **QR Platba/SPAYD (CZ)** non-custodial; SEPA QR + Stripe Connect % později.
- Členové: odkaz + **magic-link e-mail**; admin = plný účet (web registrace).
- Free vs Pro: free = 1 workspace + jádro + QR + reklamy + **3 lehké moduly**; Pro = vše +
  workspacy + OCR/export/recurring/bank-sync/bez reklam; Business = B2B.
- Architektura: **plugin kernel + moduly**; sjednocující **ledger** model.
- DB: **Neon (EU)**, ne self-host (zatím). Infra managed-first.
- **Samostatné v2 repo** vycházející ze splitcrew; splitcrew frozen.

---

## 18. Non-goals (zatím)
- Vlastní platební licence / custodial držení cizích peněz (jdeme přes Stripe Connect, ne sami).
- Pan-EU jednotná platební QR (rail je per-trh: CZ SPAYD vs EPC SEPA QR).
- Marketplace jako produkt v early fázi (jen čistá plugin architektura teď).
- In-app nákupy přes Apple/Google.
- Šablony bez ověřené poptávky jako revenue driver.

---

## 19. Rizika & poučení
- **Rewrite-from-zero past** → řešení: fork ze splitcrew + reuse, ne psát znovu.
- **Scope creep** → kernel first; featury jsou pak jen pluginy/konfigurace.
- **Custodial peníze = licence/KYC** → ledger-first + QR; reálné peníze až přes Stripe.
- **Consumer konverze nízká** → těžiště příjmů cílit na **B2B** + Pro upsell, ne masový subscription.
- **CoreSimulator/Xcode** na externím SSD (interní disk plný); runtime iOS na interním (SIP).
- **DB single-tenant dnes** → multi-tenant je největší a nutný refaktor; dělat čistě v novém repu.

---

## 20. Zdroje (ověřeno researchem)
- Tricount/bunq 16,4 mld. €: https://press.bunq.com/246589-from-roommates-to-road-trips-tricount-tallies-16-4-billion-shared-in-2024/
- Splitwise Pro: https://www.splitwise.com/pro · Settle Up Premium: https://settleup.app/premium
- SquadTrip: https://www.squadtrip.com/ · WeTravel: https://product.wetravel.com/pricing
- mTrip white-label: https://www.mtrip.com/en/travel-agency-tour-operator-app/ · Travefy: https://travefy.com/plans/pricing
- QR Platba/SPAYD: https://qr-platba.cz/ · SEPA QR: https://github.com/derhuerst/sepa-payment-qr-code
- Settle Up monetizace 2025 (zakladatel): https://medium.com/step-up-labs/summary-of-2025-changes-in-monetization-of-settle-up-results-7ad316d559c7
- Neon plány: https://neon.com/docs/introduction/plans · Vercel↔DB pooling: https://neon.com/docs/guides/vercel-connection-methods
- Hetzner ceny: https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/

---

## 21. Otevřené / TBD
- **Název** (popisný EN): kandidáti Sharepot, GroupKitty, OurTab, Sharebase, Settly, TripKit,
  Crewly → vybrat + ověřit doménu/známku.
- Přesné ceny consumer Pro / Business pro CZ trh (A/B test).
- Custodial vs jen QR pro vyrovnání u B2B (Stripe Connect timing).
- Které lehké moduly přesně v „free poolu" (default 3).
