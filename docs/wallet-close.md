# Uzavření peněženky, schvalování dodatečných výdajů, přehled & notifikace

Návrhový dokument pro feature větev `feat/wallet-close-approval-charts`.

## Cíl (zadání)

Po skončení výletu chce admin **jednorázově uzavřít celou peněženku** tak, aby:

1. byl k dispozici **maximálně přehledný souhrn** — výdaje, graf celkově, za jednotlivé
   osoby, kdo komu dluží;
2. se po uzavření **přestaly volně přidávat výdaje**; člen ale může dodatečně poslat
   zapomenutý výdaj jako **žádost**, kterou **musí schválit admin**;
3. se informace **propagovala uživatelům** — dashboard banner, notifikace, odznak v navigaci.

Přehled žije na stránce **Peněženka** (rozhodnutí uživatele).

## Co už v repu existuje (vychází se z toho)

- `wallet_expenses`, `wallet_expense_splits`, `wallet_settled`, `wallet_audit_log`,
  `settlement_audit_log` — výdaje, podíly, ruční vyrovnání, audit.
- `/api/wallet` — `list / balances / settlements / audit / rate / sync_rates / full_audit`
  (GET) a `add / edit / delete / settle` (POST). Greedy výpočet „kdo komu dluží" je v
  `handleSettlements()`.
- `/api/admin/export` — generuje 12 souborů včetně `trip_report.html` (hezky nastylovaný).
- `settings` (key/value) — `trip_*`, `base_currency`, kurzy. Helpery `getSetting/setSetting`.
- Auth: iron-session, `session.isAdmin`, `session.role` (`crew|captain`), `session.userId`.
- Žádná notifikační infrastruktura — vytváří se nová (lehká).
- Testy: vitest, čisté funkce (`src/__tests__/currency-display.test.ts`). Žádná DB v testech.

## Datový model (aditivní — žádná ztráta dat)

### `settings` (nové klíče)
| klíč | hodnota |
|---|---|
| `wallet_status` | `open` \| `closed` (default `open`) |
| `wallet_closed_at` | ISO timestamp uzavření |
| `wallet_closed_by` | user id nebo `admin` |

### `wallet_pending_expenses` (nová tabulka)
Dodatečné výdaje čekající na schválení. Stejný tvar jako `wallet_expenses` + workflow pole.
Splity se ukládají jako JSON (`split_user_ids`) — finalizují se až při schválení (přepočet
kurzu a per-person proběhne stejnou cestou jako u `add`).

```
id, paid_by, amount, currency, description, category, expense_date,
split_type, split_user_ids (JSON), requested_by, note,
status ('pending'|'approved'|'rejected'),
reviewed_by, reviewed_at, created_at
```

### `notifications` (nová tabulka)
```
id, user_id (NULL = broadcast všem), type, title, body, link,
created_at, read_at (NULL = nepřečteno)
```
`type`: `wallet_closed`, `expense_pending` (adminovi), `expense_approved`,
`expense_rejected`, `wallet_reopened`.

## API

### `/api/wallet` — nové akce
GET:
- `status` → `{ status, closed_at, closed_by }`
- `summary` → agregace pro grafy: `by_category[]`, `by_payer[]`, `totals`, `settlements[]`
  (úplný seznam kdo-komu, ne jen označené). Vše v EUR + `display_rate`.
- `list_pending` → čekající žádosti (admin: vše; člen: svoje).

POST (CSRF povinné):
- `close` (admin) → `wallet_status=closed`, zapíše `closed_at/by`, broadcast notifikace.
- `reopen` (admin) → zpět na `open`, broadcast.
- `submit_pending` → kdokoli přihlášený; uloží žádost, notifikace adminovi.
- `approve_pending` (admin) → vytvoří reálný `wallet_expense` (stejná logika jako `add`,
  v transakci), označí žádost `approved`, notifikace žadateli.
- `reject_pending` (admin) → `rejected` + důvod, notifikace žadateli.

Guard: když `wallet_status=closed`, `add` pro NE-admina vrátí chybu s instrukcí použít
`submit_pending`. Admin může `add/edit/delete` i po uzavření (oprava). `settle` jde vždy.

### `/api/notifications` (nová)
- GET → notifikace pro aktuálního uživatele (vlastní + broadcast), `unread_count`.
- POST `mark_read` / `mark_all_read`.

## Čistá logika (testovatelná) — `src/lib/wallet-calc.ts`

Vytažení výpočtů z route do čistých funkcí (DRY + TDD):
- `computeBalances(users, paidMap, shareMap)` → `[{userId, paid, share, balance}]`
- `computeSettlements(balances)` → greedy `[{from,to,amount}]` (min. počet transakcí)
- `aggregateByCategory(expenses)` / `aggregateByPayer(expenses)`
- `summarize(expenses)` → `{ total, count, avgPerExpense, topCategory }`
- `donutSegments(values)` / `barScale(values)` — geometrie grafů (čisté, testovatelné)

Route i export pak volají tytéž funkce → konzistentní čísla všude.

## UI — stránka Peněženka

- **Status banner** nahoře: když zavřeno → „Peněženka uzavřena {datum}", adminovi tlačítko
  Otevřít; členům info, že dodatečný výdaj půjde jako žádost ke schválení.
- **Nový tab „Přehled"** (default po uzavření): karty se souhrnem, **donut graf kategorií**,
  **horizontální bary za osobu**, sekce **„Kdo komu dluží"** (plný seznam). Grafy jsou
  inline SVG — žádná nová závislost (recharts není nainstalován; React 19/Next 16).
- **Admin: fronta schvalování** — seznam čekajících žádostí s Approve/Reject.
- **Člen po uzavření**: tlačítko „+“ otevře stejný formulář, ale odešle `submit_pending`
  a zobrazí stav „čeká na schválení".
- Tlačítko **Uzavřít peněženku** (admin) s potvrzením.
- i18n cs/en.

## Propagace uživatelům

- **Dashboard**: banner při zavřené peněžence; adminovi počet čekajících žádostí;
  žadateli výsledek (schváleno/zamítnuto). Tlačítko → /wallet.
- **Navigace/topbar**: odznak s počtem nepřečtených notifikací.

## Export

Do `trip_report.html` přidat sekci **Přehled** (inline SVG donut + bary) a **plný seznam
kdo-komu-dluží** (dnes jen označená vyrovnání). Generuje se ze stejného `wallet-calc`.

## Okrajové případy

- Uzavření je idempotentní; opětovné `close` nepřepíše původní `closed_at`.
- Schválení žádosti přepočítá kurz k `expense_date` (historický), stejně jako `add`.
- Broadcast notifikace + per-user: člen vidí broadcast i své; „mark read" je per uživatel
  (u broadcastu se čte podle `read_at` na vlastním záznamu — broadcast se při doručení
  needituje, řeší se přes „seen" logiku: jednoduše ukládáme i broadcast jako read per user
  přes `notifications` s `user_id` při označení; MVP: broadcast má `user_id=NULL` a
  „přečteno" se drží lokálně + globální `read_at` neaplikujeme na broadcast — viz API).
- Admin nemá `userId` (FK-safe `null`) — `closed_by` ukládáme jako text `admin`.
- Migrace jen `CREATE TABLE IF NOT EXISTS` + `INSERT ... ON CONFLICT DO NOTHING` pro
  settings → bezpečné na produkci (žádné přepsání dat).
