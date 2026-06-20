# Database And Security

## Data Access

Runtime database access goes through `src/db/client.ts` using `DATABASE_URL` and Drizzle. Application writes are done through server actions, not browser-side Supabase clients.

Authentication comes from Clerk. `requireCurrentAppUser()` maps the Clerk user id to `users.id`.

## RLS

Supabase RLS is enabled by:

- `drizzle/0004_secure_public_tables.sql`
- `drizzle/0005_cleanup_rls_advisors.sql`

Current policy intent:

- Catalog tables (`exercises`, `quests`, `rewards`) are readable when active.
- User-owned tables are readable only when the JWT `sub` matches the row owner.
- Direct client writes are not enabled by RLS policy. Writes are expected to go through server actions.

Important configuration note: the RLS policies compare against `auth.jwt() ->> 'sub'`. Because the app uses Clerk, Supabase client access only works as intended if Supabase receives a Clerk-compatible JWT where `sub` is the Clerk user id.

## Migrations

Use Drizzle migrations:

```bash
npm run db:generate
npm run db:migrate
```

Seed catalog data:

```bash
npm run db:seed
```

The seed script upserts exercises, quests, and rewards. It also deactivates rewards that are no longer in `seedRewards`.

## Server Action Safeguards

Current mutations use:

- Zod validation for user inputs
- server-side current-user checks
- transaction boundaries for reward-sensitive writes
- unique constraints and `onConflict` for idempotency
- SQL-side coin/XP increments or guarded deductions

## Reset Data

`resetProfileDataAction` is intentionally destructive and intended for testing. It clears user-owned progress data but keeps the profile row.
