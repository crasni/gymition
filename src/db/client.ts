import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: postgres.Sql | null = null;

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  return databaseUrl;
}

export function getDb() {
  if (!client) {
    client = postgres(getDatabaseUrl(), { prepare: false });
  }

  return drizzle(client, { schema });
}

export type DbClient = ReturnType<typeof getDb>;
