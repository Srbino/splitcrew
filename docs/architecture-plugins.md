# Architektura — plugin-ready moduly + kernel

> Jak postavit featury (kalendář, notifikace, pravidelné platby, výdaje, kasa…) jako
> **pluginy** nad malým sdíleným jádrem. Cíl: přidat novou featuru = zaregistrovat modul,
> ne sahat do zbytku. Stack: Next.js 16 (App Router) + Postgres (pg). Žádný těžký framework
> — „plugin" = manifest + zapojení do kernel služeb.

## 1. Princip
- **Kernel (platforma)** = pár sdílených služeb: Workspace, Entitlementy, Event/Kalendář bus,
  Notifikace, Scheduler (cron), Platby/QR.
- **Modul (plugin)** = samostatná featura (výdaje, kasa, kalendář, nákupy, deník…), která:
  1. má **manifest** (id, nav, entitlement, šablony, hooky),
  2. má vlastní tabulky (vždy s `workspace_id`),
  3. **emituje** události do kernelu (kalendář, notifikace) a **registruje** scheduler joby,
  4. nikdy nevolá jiný modul přímo — jen přes kernel (decoupling).

## 2. Manifest modulu (kontrakt)
```ts
// src/modules/<id>/manifest.ts
export interface ModuleManifest {
  id: string;                         // 'expenses' | 'calendar' | 'recurring' | 'kitty' | ...
  name: string;
  icon: string;
  core?: boolean;                     // true = vždy zapnuto (expenses)
  entitlement?: 'free' | 'pro' | 'business';   // gating; default 'free'
  nav?: { label: string; order: number };      // tab v workspace; bez nav = jen služba na pozadí
  templates?: string[];               // šablony, kde je default zapnutý: ['household','sailing']
  settingsSchema?: JSONSchema;        // per-workspace konfigurace modulu

  hooks?: {
    // modul DODÁVÁ datované události do kalendáře (kernel je sesbírá ze všech modulů)
    calendarEvents?(ctx: Ctx): Promise<CalendarEvent[]>;
    // scheduler tick (cron) — modul si dělá svou periodickou práci (idempotentně)
    onSchedule?(ctx: Ctx, now: string): Promise<void>;
    // reakce na vznik/změnu entity v jiném modulu (volitelné, přes kernel event)
    onEvent?(ctx: Ctx, evt: KernelEvent): Promise<void>;
  };
}
export interface Ctx {
  workspaceId: number;
  settings: Record<string, unknown>;  // settingsSchema hodnoty
  services: KernelServices;           // notify, calendar, payments, entitlements, db
}
```
Registry = statické pole manifestů (později dynamické/marketplace):
```ts
// src/lib/platform/registry.ts
export const MODULES: ModuleManifest[] = [expenses, kitty, calendar, recurring, shopping, ...];
```

## 3. Kernel služby (do těch se moduly zapojují)

### 3.1 Workspace + Entitlementy
```ts
getWorkspace(id) → { id, name, template, plan: 'free'|'pro'|'business', settings }
getEnabledModules(workspaceId) → ModuleManifest[]   // průnik registry × workspace_modules × entitlement
can(workspace, feature|moduleId) → boolean          // gating (free/pro/business)
```
Tabulky: `workspaces`, `workspace_members`, `workspace_modules(workspace_id, module_id, enabled, config)`.

### 3.2 Event / Kalendář bus
Jediný zdroj „co se kdy děje". Kalendář modul **nečte cizí tabulky** — jen agreguje
`calendarEvents()` ze všech zapnutých modulů.
```ts
interface CalendarEvent {
  date: string;            // ISO; den/čas
  title: string;
  moduleId: string;        // odkud to je
  refId?: string;          // id entity v modulu
  kind: 'reminder'|'due'|'info';
  remindAt?: string;       // kdy upomenout (→ scheduler → notifikace)
  audience?: Audience;
}
calendar.collect(workspaceId, range) → CalendarEvent[]   // zavolá hooky všech modulů
```

### 3.3 Notifikace (více kanálů)
Zobecnění současného in-app systému na workspace + kanály.
```ts
notify(workspaceId, audience, {
  type, title, body, link,
  channels?: ('inapp'|'email'|'push')[]   // default ['inapp','email']
})
```
- **in-app** (máme: zvonek, badge) → workspace-scoped.
- **email** (členové mají e-mail z magic-linku) → upomínky nájmu apod.
- **push** (Capacitor, později) — stejné API, jen přibude kanál.
Tabulky: `notifications` (+ `workspace_id`), `notification_reads`, `device_tokens` (push, později).

### 3.4 Scheduler (cron) — srdce pravidelných věcí
Jeden cron tick (Vercel Cron → `/api/cron/tick`) projede **všechny** workspacy × moduly:
```ts
// pro každý workspace, pro každý zapnutý modul s hookem:
await module.hooks.onSchedule(ctx, now)
// + kernel vyřeší splatné reminders z calendar.collect() → notify(...)
```
**Idempotence:** tabulka `scheduled_runs(workspace_id, key, ran_at)` — každý job má klíč
(`recurring:<ruleId>:<period>`), spustí se jen jednou. Bez toho by cron duplikoval výdaje.

### 3.5 Platby / QR
```ts
payments.qr({ iban, amount, vs, message, currency }) → spaydString   // → QR obrázek
```
Vyrovnání i kasa volají totéž. CZ = SPAYD (zdarma), EU = EPC SEPA QR (později).

## 4. Datový model (plugin-ready základ)
```
workspaces(id, name, template, owner_user_id, plan, settings_json, created_at)
workspace_members(id, workspace_id, user_id?, guest_name, email, role, joined_at)
workspace_modules(workspace_id, module_id, enabled, config_json)   PK(workspace_id,module_id)
notifications(... , workspace_id)            -- rozšíření stávající
recurring_rules(id, workspace_id, module_id, payload_json, rrule, next_run, last_run)
scheduled_runs(workspace_id, key, ran_at)    PK(workspace_id, key)
-- každá modulová tabulka má workspace_id (wallet_expenses, shopping_items, ...)
```

## 5. Jak konkrétní featury sednou jako pluginy

### Modul „recurring" (pravidelné platby)
- Tabulka `recurring_rules` (šablona výdaje + cadence: měsíčně/týdně/RRULE, `next_run`).
- `onSchedule`: kde `next_run <= now` → vytvoří reálný výdaj (**reuse `insertExpenseWithSplits`**)
  → `notify(...)` → posune `next_run`. Idempotentně přes `scheduled_runs`.
- `calendarEvents`: vrátí příští `next_run` jako `due` událost (ukáže se v kalendáři).
- Šablony: default v `household`, `auto`.

### Modul „calendar" (kalendář + upomínky)
- Žádná vlastní data o cizích entitách — jen UI + `calendar.collect()` (agregace ze všech).
- Reminders: události s `remindAt` → scheduler je v ten čas pošle přes `notify` (email+inapp).
- Default v `household`, `auto`, `sailing` (itinerář), `trip`.

### Notifikace
- Není „modul" s tabem, ale **kernel služba** + UI zvonek (máme). Moduly jen volají `notify`.
- Kanály: in-app (hotovo) → email (máme adresy) → push (Capacitor, později).

### Výdaje + Kasa (kitty)
- `expenses` = core modul (jádro, vždy). `kitty` = ledger nad stejným principem (příspěvky vs
  útraty ze společné kasy, zůstatek dopočítán, vyrovnání přes `payments.qr`). Bez držení peněz.

## 6. Mapování na Next.js
```
src/lib/platform/        # KERNEL: registry, workspace, entitlements, events, notify, scheduler, payments
src/modules/<id>/
  manifest.ts            # plugin kontrakt
  page.tsx               # UI tab (lazy)
  api.ts                 # handlery (volané z /api/workspace/[id]/[module])
  schema.sql             # tabulky modulu (workspace_id)
src/app/(app)/w/[workspaceId]/[module]/page.tsx   # generický router → modul.page
src/app/api/cron/tick/route.ts                    # Vercel Cron → scheduler
```
Workspace layout načte `getEnabledModules()` → vykreslí navi taby z manifestů. Přidání modulu
= nový `src/modules/<id>` + zápis do registry. (Marketplace = registry plněný z DB, P4+.)

## 7. Pořadí stavby (kernel first)
1. **Workspace + members + entitlements** (P0 multi-tenant).
2. **Module registry + workspace_modules** + generický workspace router/navigace.
3. **Notify service** (workspace-scoped, in-app + email).
4. **Scheduler** (`/api/cron/tick` + `scheduled_runs`).
5. **Event/Calendar bus** (`calendarEvents` hooky) + calendar modul.
6. **Recurring modul** (nad schedulerem + insertExpenseWithSplits).
7. **Payments/QR** služba → napojit na vyrovnání + kasu.
Pak migrace stávajících featur (wallet, shopping, …) na moduly s `workspace_id`.
