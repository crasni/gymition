# Gymition

Gymition is a small gamified fitness and life-tracking app built with Next.js, Clerk, Drizzle, and Postgres/Supabase.

## Features

- Daily check-in streak with capped coin bonus
- Workout logging in detailed mode or simple time mode
- Daily quests and weekly workout/cardio goals
- Life tracker for washing face and brushing teeth
- Coins, XP, levels, ledger history, and title rewards
- Clerk authentication and server-action based writes
- Supabase/Postgres RLS migrations for public tables

## Stack

- Next.js 16 App Router
- React 19
- Clerk auth
- Drizzle ORM
- Postgres/Supabase
- Zod validation

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` with at least:

```bash
DATABASE_URL=postgres://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

3. Apply migrations and seed catalog data:

```bash
npm run db:migrate
npm run db:seed
```

4. Start development:

```bash
npm run dev
```

## Common Commands

```bash
npm run lint
npm run build
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
```

## Documentation

- [Architecture](docs/architecture.md)
- [Database and Security](docs/database-security.md)
- [Reward System](docs/reward-system.md)
- [Code Review Notes](docs/code-review.md)
