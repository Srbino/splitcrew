# ⛵ SplitCrew

**Self-hosted trip management for crews and groups.**
Expense splitting, shopping lists, meal planning, sailing logbook & more.

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

- **Expense Splitting** — Multi-currency expenses with automatic splitting, daily exchange rates (ECB), balances & settlements
- **Shopping Lists** — Per-boat lists with categories, assignments, buy tracking
- **Meal Planning** — Daily meal planner with cook assignments
- **Sailing Logbook** — Track nautical miles, routes, skippers, conditions
- **Itinerary** — Trip day planner with Google Maps links
- **Checklist** — Personal, boat, and trip-wide packing lists
- **Car Pooling** — Organize rides to/from the marina
- **Crew Management** — Roles (Admin / Captain / Crew), per-user passwords
- **Trip Export** — CSV + HTML report with all data
- **i18n** — English & Czech, switchable by any user
- **Dark Mode** — System-aware with manual toggle
- **Mobile First** — Responsive design, bottom nav, touch-friendly
- **Setup Wizard** — First-run onboarding, no manual DB setup needed

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (App Router, React 19) |
| Language | TypeScript 6.0 (strict mode) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Animations | Framer Motion 12 |
| Database | PostgreSQL 16 (direct queries via `pg`) |
| Auth | iron-session (encrypted cookies) |
| Icons | Lucide React |

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/Srbino/splitcrew.git
cd splitcrew
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) → Setup wizard starts automatically.

**Dev with sample data:**
```bash
docker compose up -d  # Includes seed data (10 users, 2 boats, demo expenses)
# Admin: admin123 | All users: pass1234
```

**Production (clean start):**
```bash
docker compose -f docker-compose.prod.yml up -d
# First visit → setup wizard → configure everything from UI
```

### Manual Setup

```bash
# Prerequisites: Node.js 22+, PostgreSQL 16+

git clone https://github.com/Srbino/splitcrew.git
cd splitcrew
npm install

# Database
createdb splitcrew
psql splitcrew < scripts/schema.sql

# Environment
cp .env.example .env
# Edit .env with your DATABASE_URL and SESSION_SECRET

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → Setup wizard guides you through initial configuration.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | dev fallback | 64-char hex string for cookie encryption |
| `NODE_ENV` | No | development | Set to `production` for optimized build |

## Scripts

```bash
npm run dev            # Development server (port 3000)
npm run build          # Production build
npm run start          # Start production server
npm run db:init        # Initialize DB (schema + seed)
npm run db:reset       # Drop all tables + recreate + seed
npm run test:currencies # Run currency conversion tests
```

## Project Structure

```
src/
├── app/
│   ├── (app)/              # Protected routes (require auth)
│   │   ├── dashboard/      # Home — stats, recent expenses, meals
│   │   ├── wallet/         # Expenses, balances, settlements
│   │   ├── shopping/       # Shopping lists per boat
│   │   ├── menu/           # Meal planning
│   │   ├── logbook/        # Sailing log
│   │   ├── itinerary/      # Trip day planner
│   │   ├── checklist/      # Packing lists (personal/boat/trip)
│   │   ├── cars/           # Car pooling
│   │   ├── crews/          # Crew roster
│   │   └── admin/          # Settings, users, boats, export
│   ├── api/                # REST API routes
│   ├── setup/              # First-run setup wizard
│   └── page.tsx            # Login page
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # App shell (topbar, sidebar, nav)
│   └── shared/             # Reusable components (modal, toast, etc.)
├── lib/
│   ├── auth.ts             # Session management (iron-session)
│   ├── db.ts               # PostgreSQL queries
│   ├── currencies.ts       # 26 currencies with metadata
│   ├── exchange.ts         # Daily exchange rates (Frankfurter/ECB)
│   └── i18n/               # Internationalization (EN + CS)
└── scripts/
    ├── schema.sql          # Database schema
    ├── seed.sql            # Development sample data
    └── test-currencies.mjs # Currency conversion test suite
```

## Currency System

- **Base currency** configurable per trip (EUR, CZK, USD, etc.)
- **Daily exchange rates** from ECB via Frankfurter API, archived per day
- **Date-specific conversion** — each expense uses the rate from its date
- **Admin controls** which currencies are available in the UI
- **Export** in any currency (admin chooses export currency)

## Roles

| Role | Can do |
|------|--------|
| **Crew** | Own expenses, shopping, logbook, meal assignments |
| **Captain** | + Edit/delete others' expenses on their boat, settle debts |
| **Admin** | + Full settings, user management, export, all boats |

## Screenshots

*Coming soon*

## Contributing

Pull requests welcome! Please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)
