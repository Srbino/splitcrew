# CrewSplit — Claude Notes

## Databáze

**NIKDY nespouštěj `npm run db:init` ani `psql ... < scripts/seed.sql`**
Tyto příkazy přepíší produkční data v Neon DB původním demo seed scriptem.

Produkční data jsou nahrána přes `scripts/rzvrep-seed.sql` (není verzován — .gitignore).
Pokud je potřeba reset, použij: `psql $DATABASE_URL < scripts/rzvrep-seed.sql`

## Deployment

Produkce běží na Vercel + Neon PostgreSQL.
- App: https://crewsplit.advine.ai
- Deploy: `npx vercel --prod`
- DB: Neon (ep-divine-fog-an9e2xax-pooler, us-east-1)

## Měny a kurzy

- Base currency: EUR (nastaveno v DB settings)
- Allowed currencies: CZK, EUR (JSON array v DB settings)
- Kurzy: Frankfurter API (automaticky cachováno v `exchange_rates_daily`)
- Výdaje vždy ukládají `amount` (original) + `amount_eur` (base currency) + `exchange_rate`
- Nespouštěj `db:init` — přepíše i správné `amount_eur` hodnoty v historických výdajích

## Avatary

Avatary jsou uloženy jako base64 WebP přímo v PostgreSQL (sloupec `users.avatar TEXT`).
Upload komprimuje na 256×256px přes sharp.
