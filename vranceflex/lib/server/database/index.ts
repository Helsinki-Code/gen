import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

type DatabaseState = {
  client: Sql;
  database: PostgresJsDatabase<typeof schema>;
};

declare global {
  // eslint-disable-next-line no-var
  var __vranceflexDatabase: DatabaseState | undefined;
}

export class DatabaseConfigurationError extends Error {}

export function hasDatabaseConfiguration() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new DatabaseConfigurationError(
      "DATABASE_URL is not configured. Add a managed PostgreSQL connection in the hosting platform.",
    );
  }

  if (!globalThis.__vranceflexDatabase) {
    const client = postgres(connectionString, {
      max: 5,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    globalThis.__vranceflexDatabase = {
      client,
      database: drizzle(client, { schema }),
    };
  }

  return globalThis.__vranceflexDatabase.database;
}
