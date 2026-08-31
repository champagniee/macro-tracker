# Macro Tracker

A calorie and macro tracking web app. Next.js (App Router) full-stack, Neon Postgres for data (not wired up yet), MCP integration planned for auto-importing food/recipes and fetching macros from an external service.

## Status

Frontend only for now — UI is built against local component state (persisted to `localStorage` for a working demo), with mock seed data in [`src/lib/mock-data.ts`](src/lib/mock-data.ts). No database or API routes yet.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Tailwind CSS v4** for styling, design tokens in [`src/app/globals.css`](src/app/globals.css)
- **[motion](https://motion.dev)** for spring animations and the drag-to-dismiss Add Food sheet
- **[@base-ui/react](https://base-ui.com)**, **[sonner](https://sonner.emilkowal.ski)**, **next-themes**, **lucide-react**
- UI follows the Apple Design + Emil Kowalski design-engineering skills in `.claude/skills/` (spring-based motion, translucent materials, press feedback, etc.)

## Pages

- `/` — Today: calorie ring, protein/carbs/fat bars, meal sections (Breakfast/Lunch/Dinner/Snacks), Add Food sheet
- `/history` — last 7 days summary (mock data)
- `/settings` — daily macro goals, light/dark/system theme

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Next steps

- Neon Postgres + an ORM (Drizzle recommended) for real persistence, replacing the `localStorage` demo state
- API routes / server actions for food entries and goals
- MCP server integration for auto-inputting food/recipes and fetching macros from an external nutrition service
