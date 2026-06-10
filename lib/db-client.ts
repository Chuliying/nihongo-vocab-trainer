import postgres from "postgres";

let cachedSql: ReturnType<typeof postgres> | null = null;

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for VOCAB_DATA_SOURCE=db");
  }
  return databaseUrl;
}

export function getSql() {
  if (!cachedSql) {
    cachedSql = postgres(getDatabaseUrl(), {
      max: 5,
      prepare: false,
    });
  }
  return cachedSql;
}
