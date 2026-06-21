DELETE FROM "coin_ledger_entries"
WHERE "amount" = 0;

DELETE FROM "coin_ledger_entries" a
USING "coin_ledger_entries" b
WHERE a."ctid" < b."ctid"
  AND a."user_id" = b."user_id"
  AND a."reason" = b."reason"
  AND a."source_type" = b."source_type"
  AND a."source_id" = b."source_id";

DELETE FROM "xp_ledger_entries" a
USING "xp_ledger_entries" b
WHERE a."ctid" < b."ctid"
  AND a."user_id" = b."user_id"
  AND a."reason" = b."reason"
  AND a."source_type" = b."source_type"
  AND a."source_id" = b."source_id";

CREATE UNIQUE INDEX IF NOT EXISTS "coin_ledger_user_event_unique"
ON "coin_ledger_entries" USING btree ("user_id", "reason", "source_type", "source_id");

CREATE UNIQUE INDEX IF NOT EXISTS "xp_ledger_user_event_unique"
ON "xp_ledger_entries" USING btree ("user_id", "reason", "source_type", "source_id");
