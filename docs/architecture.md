# Architecture

## Request Flow

The app uses Next.js App Router pages under `src/app/*`. Protected pages render `GymitionApp`, which loads all required server state and passes it into the client prototype shell.

Core path:

1. `src/proxy.ts` protects app routes with Clerk.
2. `src/features/app/GymitionApp.tsx` loads app state and wires server actions.
3. `src/features/app/app-state.ts` reads user-scoped data from Postgres.
4. `src/features/prototype/GymitionPrototype.tsx` renders the main UI and optimistic interactions.
5. Feature server actions persist mutations and call `revalidatePath`.

## Main Areas

- `src/db/schema.ts`: Drizzle schema for users, workouts, rewards, quests, ledgers, goals, and life habits.
- `src/features/auth`: Clerk current-user helpers.
- `src/features/users`: app-user lookup and creation.
- `src/features/workouts`: workout validation and completion server action.
- `src/features/economy`: reward rules, XP rules, daily check-in action, shared types.
- `src/features/quests`: daily quest definitions and progress calculation.
- `src/features/rewards`: title reward catalog and purchase action.
- `src/features/life`: life habit check-ins and life streak calculation.
- `src/features/profile`: profile updates and testing reset.
- `src/components/app-shell`: shared sidebar/topbar shell.

## State Model

Server-backed pages pass a `GymitionState` snapshot into the client. The client applies optimistic state for fast interactions, then keeps that optimistic state visible until a refreshed server payload arrives.

This makes interactions feel immediate while keeping the database as the source of truth.

## Current Streak Semantics

- `currentStreak` is a daily check-in streak, not a workout streak.
- Life streak is derived from days where both life habits are completed.
- Workout/cardio streaks are not currently modeled.

## UI Notes

The main client component is currently large and owns multiple page views. This is practical for quick iteration, but future feature work should split dashboard, workout, life, rewards, history, and profile views into separate components.
