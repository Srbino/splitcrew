# PRD — CrewSplit → platforma „sdílené výdaje + koordinace"

> Verze 0.1 (draft, 2026-06-23). Žijící dokument. Vychází z funkční appky (dnes
> plachtařská) + hloubkového competitor/monetizačního researche.

## 1. Vize (one-liner)
Jedna appka, kde si **kdokoli rozpočítá výdaje a zkoordinuje skupinovou akci** — od
„rozpočítat pivka" přes výlet/roadtrip/festival až po **zájezdovky a zážitkové firmy**.
Postavená jako **platforma**: *Workspace × Moduly × Šablony*. Jádro (dělení + vyrovnání)
zdarma, peníze z B2B operátorů + prémiové nadstavby + plateb.

## 2. Problém & příležitost (podloženo researchem)
- Dělení výdajů je masový trh (Tricount 21 M uživatelů / 16,4 mld. € za 2024), ale
  **za jádro nikdo neplatí** — Tricount/Splitwise/Settle Up ho dávají zdarma.
- **Peníze tečou jinde:** B2B operátoři group-travel (SquadTrip ~6 % + $29/měs;
  WeTravel $79/měs), consumer prémiové featury (OCR, export, opakované, bez reklam;
  Splitwise Pro $4,99/měs, Settle Up $3,49/měs), a payment rails.
- **Nikdo nedělá „celou výpravu"** (výdaje + nákupy + jídelníček + deník + itinerář +
  checklist + dokumenty) — to je náš moat.
- ČR výhoda: **QR Platba/SPAYD** (otevřená, zdarma) → vyrovnání jde reálně zaplatit.

## 3. Cílové segmenty
1. **Consumer skupiny** (akvizice, free): party na výlet/roadtrip/festival, spolubydlení,
   „jen rozpočítat". Síťový efekt — člen dnes = kapitán zítra.
2. **B2B malí operátoři** (peníze): zájezdovky, zážitkové firmy, retreaty, kempy, oddíly.
   Dělají hodně akcí → platí SaaS, chtějí branding + report pro klienta. *Malí zákazníci
   = ústní reklama (word of mouth).*

## 4. Jádro produktu: Workspace × Moduly × Šablony
- **Workspace** = pojmenovaná jednotka (výlet/akce/skupina/projekt). Má admina + členy.
- **Moduly** (zapínatelné per workspace): **Výdaje + Vyrovnání (jádro, vždy)**, Nákupy/
  Inventář, Jídelníček, Itinerář, Checklist, Deník, Skupiny/Auta, Dokumenty, Notifikace.
- **Šablony** = předvolené sady modulů + obsah. Admin klikne šablonu → hotovo, nebo si
  moduly nakliká sám. Nová use-case = konfigurace, ne nový kód.

### Generalizace ze současného stavu
- „Loď" → obecná **Skupina/Podskupina** (přejmenovatelná: loď/auto/pokoj/tým).
  Stávající `split_type both/boat1` → „všichni / skupina X" (logika dělení zůstává, je
  otestovaná).
- Vlastní seznamy/inventář = uživatelsky definované položky (checklist už je flexibilní).
- Plachtařská specifika (deník, lodě) = jen jeden modul/šablona, ne jádro.

## 5. Šablony — priorita (podle ověřené poptávky + monetizace)
| # | Šablona | Role | Monetizace |
|---|---|---|---|
| 1 | „Jen rozpočítat" / výlet (vč. plachtění, roadtrip, festival jako varianty) | akviziční free core | nepřímá (růst) |
| 2 | **Zájezdovka / zážitkový operátor (B2B)** | **hlavní příjem** | SaaS + později % z plateb |
| 3 | Spolubydlení (opakované účty) | retence | rail + Pro |

> Festival/svatby/dárky/sporťáci/kemp/lyžovačky: drž jako levné šablony (konfigurace),
> **nestav na nich byznys** — research nenašel ověřená data o poptávce/penězích.

## 6. Monetizace
**Princip: jádro (dělení + vyrovnání) je ZDARMA.** Zpoplatňuje se nadstavba a B2B.

### a) Consumer „Captain Pro" (platí admin/kapitán, na webu)
- Odemyká: finální **PDF report**, **OCR účtenek**, **opakované platby**, grafy, multi-
  workspace, bez reklam, branding.
- Cena: ~úroveň trhu (≈ $19–50/rok). **Lze rozpočítat posádce** (tlačítko) → ~desítky Kč/os.
- Free tier: 1 aktivní workspace, neomezeně členů, základní dělení + vyrovnání.

### b) B2B „Operator / Business" (hlavní příjem)
- SaaS **~$29–79/měs** (dle tieru), víc/neomezeně workspaců, **branding/white-label**,
  správa účastníků přes odkaz, **export reportu pro klienta**, splátky/upomínky.
- Později **% z plateb** přes **Stripe Connect** (~platform fee), bez vlastní licence.

### c) Payment rails (vyrovnání → reálné placení)
- **Non-custodial QR Platba/SPAYD (CZ) + EPC SEPA QR (část EU)** — zdarma, bez licence/KYC.
  Vygenerujeme QR k zaplacení, peníze tečou přímo mezi bankami. **Dělat hned** = killer CZ
  featura + zvyšuje hodnotu Pro.
- **Custodial** (peníze přes nás, bereme %) = až přes Stripe Connect pro B2B.

### Obcházení Apple/Google daně (legálně)
- Účtování **na webu** (Stripe), v iOS/Android appce **žádné in-app nákupy ani odkaz na
  platbu**. Kapitán/operátor upgraduje v prohlížeči, appka jen odemkne podle účtu.
- **Web-first:** appka je instalovatelná **PWA** → většina uživatelů nepotřebuje store.
  Nativní (Capacitor) jen pro důvěryhodnost/přítomnost.

## 7. Klíčové principy (dělat správně od začátku)
- **Multi-tenant od první verze** (`workspace_id` na všem, izolace dat) — bez toho nelze
  škálovat ani prodávat. Migrace stávající single-trip DB pod první workspace bez ztráty dat.
- **Registrace na našem webu** (kapitán/operátor = plný účet). **Členové = bez registrace**,
  join přes odkaz/magic-link.
- **Entitlementy** (free / Pro / Business + limit workspaců) řízené serverem.
- **EU data residency** (přesun Neonu do Frankfurtu — dnes us-east).
- **Náklad na cloud řešit hned:** Vercel + Neon (scale-to-zero, pay-as-you-go) na start
  levné; přesun appky na VPS/Hetzner až při trvale vysokém provozu (viz docs/hosting research).

## 8. Architektura (stav + cíl)
- Dnes: Next.js 16 SSR + Postgres (Neon) na Vercelu; sdílená čistá logika
  `lib/wallet-calc.ts`; nativní obal Capacitor (hotovo, hybrid/live).
- Cíl: + multi-tenant vrstva, modulová konfigurace, šablony, web auth/registrace,
  entitlementy, QR vyrovnání, (později) Stripe na webu + Stripe Connect pro B2B.

## 9. Cross-cutting prémiové featury (ověřené jako placené)
OCR účtenek · převod měn (historický — máme) · opakované platby · export/report (máme PDF
základ) · grafy (máme) · bez reklam · branding/white-label (B2B) · offline režim
(plachtění/cesty bez signálu).

## 10. Non-goals (zatím)
- Vlastní platební licence / custodial peníze (jdeme přes Stripe Connect, ne sami).
- Globální pan-EU jednotná platební QR (rail je per-trh: CZ SPAYD vs EPC SEPA QR).
- Šablony, na které není ověřená poptávka, jako revenue driver.

## 11. Fázový roadmap
- **P0 — Základ:** multi-tenant (`workspace_id`), web registrace + magic-link členové,
  entitlementy, migrace dat. *(bez tohoto nic nejde monetizovat)*
- **P1 — Platforma:** moduly per workspace + šablony (vč. generalizace loď→skupina),
  „jen rozpočítat" + výlet šablona.
- **P2 — Consumer monetizace:** Captain Pro paywall (report/OCR/recurring/multi-workspace),
  Stripe na webu, „rozpočítat Pro posádce", **QR Platba u vyrovnání**.
- **P3 — B2B:** Operator/Business tier (branding, víc workspaců, účastníci, klient report),
  později Stripe Connect % z plateb.
- **P4 — Šířka:** další šablony, offline, marketplace šablon.

## 12. Otevřená rozhodnutí (k doplnění s tebou)
Viz dotazy v konverzaci — segment priority (B2B vs consumer first), v1 šablony, branding/
název, rozsah plateb (QR vs Stripe Connect), cenové hladiny, co přesně do free vs Pro.
