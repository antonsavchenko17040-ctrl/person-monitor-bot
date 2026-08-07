import { neon } from "@neondatabase/serverless";

let client = null;

export function db() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!client) {
    client = neon(databaseUrl);
  }

  return client;
}
