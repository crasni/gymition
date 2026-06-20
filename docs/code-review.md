# Code Review Notes

Reviewed after commit `c5c4268`.

## Summary

The codebase is in a reasonable state for a personal app. Auth boundaries, server actions, validation, RLS, optimistic UI, and reward transactions are substantially better than the initial version.

The next risks are maintainability and scale, not immediate critical security issues.

## Findings

### 1. Medium: App state loading is unbounded

`loadGymitionAppState` currently loads all workouts, ledgers, quests, check-ins, and life habit rows for a user before rendering. See `src/features/app/app-state.ts:50`.

Impact: this will get slower as real usage grows, especially `workoutRows`, `coinLedgerRows`, `xpLedgerRows`, and `lifeHabitCheckinRows`.

Recommended fix: add limits and view-specific loaders. Dashboard does not need full history; history can paginate.

### 2. Medium: Main client component is too large

`GymitionPrototype` owns routing views, optimistic state, action orchestration, dashboard, workout, life, rewards, history, profile, and helper rendering. See `src/features/prototype/GymitionPrototype.tsx:182`.

Impact: future changes are more likely to create accidental coupling or UI regressions.

Recommended fix: split into feature view components and move optimistic reducers/helpers into smaller hooks.

### 3. Medium: Optimistic client reward logic duplicates server reward logic

The client calculates optimistic rewards and quest outcomes while server actions independently calculate authoritative rewards. See the optimistic state paths around `src/features/prototype/GymitionPrototype.tsx:314` and server reward paths around `src/features/workouts/workout-actions.ts:152`.

Impact: reward rule changes can drift between optimistic display and persisted server outcome.

Recommended fix: keep all reward constants centralized and add unit tests around optimistic/server parity for major actions.

### 4. Medium: RLS depends on Clerk JWT compatibility

RLS policies compare row ownership against JWT `sub`. See `drizzle/0005_cleanup_rls_advisors.sql:1`.

Impact: server actions work because they use `DATABASE_URL`, but browser-side Supabase reads require a Clerk-compatible JWT passed to Supabase.

Recommended fix: document the Supabase/Clerk JWT setup before adding any browser Supabase client.

### 5. Low: Seed script deactivates all non-seeded rewards

The seed script marks any reward not in `seedRewards` inactive. See `scripts/seed.ts:104`.

Impact: this is fine for a catalog controlled by source code, but it will deactivate manually added production rewards.

Recommended fix: keep this behavior while rewards are source-controlled. If admin-created rewards are added later, scope deactivation to seeded/system rewards only.

### 6. Low: Date keys depend on runtime timezone

`localDateKey` uses `toLocaleDateString("en-CA")`. See `src/lib/dates.ts:1`.

Impact: streaks and week starts depend on the server/runtime timezone. This can surprise users if production runs in a different timezone from local development.

Recommended fix: choose an explicit app timezone or user timezone model before expanding streak features.

## What Looks Solid

- Protected routes are handled in `src/proxy.ts`.
- Server actions call `requireCurrentAppUser`.
- User input is validated with Zod before mutation.
- Reward purchase uses guarded SQL deduction.
- Daily check-in and life check-ins use conflict-aware writes.
- RLS is enabled for public tables.
- Supabase advisor cleanup indexes were added.
- The reward economy is now capped and title-focused.

## Recommended Next Steps

1. Add small tests for `calculateStreakBonus`, `calculateLifeStreak`, `nextLoginStreak`, and quest progress.
2. Split `GymitionPrototype` into feature components.
3. Add pagination or limits to history and ledger reads.
4. Decide whether to implement true workout/cardio streaks.
5. Add weekly reward claims only after the daily economy feels stable.
