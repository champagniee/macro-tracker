# Macro Tracker

A calorie and macro tracking web app. Next.js (App Router) full-stack, Neon Postgres (via Drizzle) for data, MCP integration planned for auto-importing food/recipes and fetching macros from an external service.

## Status

Food entries and macro goals are still `localStorage`-backed UI state with mock seed data in [`src/lib/mock-data.ts`](src/lib/mock-data.ts) — not migrated to the database yet. Auth is real: email/password with JWT sessions, backed by a `users` table in Neon Postgres via Drizzle.

See [TODO.md](TODO.md) for the full backlog.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Tailwind CSS v4** for styling, design tokens in [`src/app/globals.css`](src/app/globals.css)
- **[motion](https://motion.dev)** for spring animations and the drag-to-dismiss Add Food sheet
- **[@base-ui/react](https://base-ui.com)**, **[sonner](https://sonner.emilkowal.ski)**, **next-themes**, **lucide-react**
- **Neon Postgres** + **Drizzle ORM** for persistence
- **jose** (JWT) + **bcryptjs** (password hashing) for auth — email/password for now, OAuth planned (see [TODO.md](TODO.md))
- UI follows the Apple Design + Emil Kowalski design-engineering skills in `.claude/skills/` (spring-based motion, translucent materials, press feedback, etc.)

## Pages

- `/` — Today: calorie ring, protein/carbs/fat bars, meal sections (Breakfast/Lunch/Dinner/Snacks), Add Food sheet
- `/history` — last 7 days summary (mock data)
- `/settings` — daily macro goals, light/dark/system theme, account (log out)
- `/login`, `/register` — email/password auth

## Getting Started

Copy `.env.example` to `.env.local` and fill in `DATABASE_URL` (a [Neon](https://neon.tech) project connection string) and `JWT_SECRET` (e.g. `openssl rand -base64 32`), then push the schema:

```bash
npm run db:push
```

Then start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
