import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

/**
 * These read the actual deployed SQL rather than re-describing it, so a
 * future edit that weakens the `profiles` security model — widening the
 * INSERT check, dropping the `auth.uid()` default, or introducing a
 * `using (true)`/`with check (true)` escape hatch — fails a test instead
 * of only being caught in a live database. Mocked-client unit tests
 * (investigations.test.ts) can't exercise real RLS at all, since RLS is
 * enforced by Postgres itself; this is the next best thing available
 * without a live database connection.
 */

const migrationsDir = join(currentDir, "..", "..", "..", "supabase", "migrations");

function readMigration(filename: string): string {
  return readFileSync(join(migrationsDir, filename), "utf-8");
}

describe("profiles RLS invariants", () => {
  it("enables row level security on profiles", () => {
    const sql = readMigration("0002_profiles.sql");
    expect(sql).toMatch(/alter table public\.profiles enable row level security/i);
  });

  it("only ever grants an authenticated user INSERT on their own row — never a public/unconditional check", () => {
    const sql = readMigration("0009_profiles_insert_policy_and_backfill.sql");

    expect(sql).toMatch(/create policy "profiles_insert_own" on public\.profiles/i);
    expect(sql).toMatch(/for insert with check \(id = auth\.uid\(\)\)/i);

    // Guard against ever loosening this to "any row" or "always true" —
    // a client can only ever assert ownership of a row whose id is their
    // own auth.uid(), never another user's id and never unconditionally.
    expect(sql).not.toMatch(/with check\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/for insert with check \(id = '[0-9a-f-]+'\)/i);
  });

  it("derives profiles.id from auth.uid() itself, so a client can never supply a mismatched id", () => {
    const sql = readMigration("0010_profiles_id_defaults_to_auth_uid.sql");
    expect(sql).toMatch(/alter table public\.profiles alter column id set default auth\.uid\(\)/i);
  });

  it("never grants SELECT/UPDATE on profiles to anyone other than the row's own owner", () => {
    const sql = readMigration("0007_row_level_security.sql");
    const profilesSection = sql.slice(sql.indexOf("-- profiles"), sql.indexOf("-- projects"));

    expect(profilesSection).toMatch(/for select using \(id = auth\.uid\(\)\)/i);
    expect(profilesSection).toMatch(
      /for update using \(id = auth\.uid\(\)\) with check \(id = auth\.uid\(\)\)/i,
    );
    expect(profilesSection).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });
});
