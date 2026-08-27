import { vi } from "vitest";

import type { DbClient } from "@/lib/supabase/admin";

type QueryResult = { data: unknown; error: { message: string } | null };

/**
 * A minimal stand-in for a Supabase query builder chain. Real
 * `@supabase/supabase-js` builders are "thenable" — `await
 * client.from(t).select().eq(...)` resolves without ever calling
 * `.maybeSingle()` for a multi-row query, while a single-row query
 * chains `.maybeSingle()` on the end. This mock supports both: every
 * chain method returns itself, and awaiting the chain (or calling
 * `.maybeSingle()`) both resolve to the one queued result for that
 * `.from()` call.
 *
 * Not a relational database — each `.from(table)` call pops the next
 * result queued for that table name, in call order. Tests queue exactly
 * as many responses as the code under test is expected to request.
 */
export function createMockDb(
  queues: Record<string, QueryResult[]>,
): DbClient {
  const from = vi.fn((table: string) => {
    const queue = queues[table];
    if (!queue || queue.length === 0) {
      throw new Error(
        `Mock DB: no response queued for table "${table}" (call ${
          queue ? "beyond queued responses" : "unexpected table"
        })`,
      );
    }
    const result = queue.shift() as QueryResult;

    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = vi.fn(chain);
    builder.eq = vi.fn(chain);
    builder.in = vi.fn(chain);
    builder.order = vi.fn(chain);
    builder.insert = vi.fn(chain);
    builder.update = vi.fn(chain);
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    builder.then = (
      resolve: (value: QueryResult) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject);
    return builder;
  });

  return { from } as unknown as DbClient;
}

export function row<T extends Record<string, unknown>>(data: T): QueryResult {
  return { data, error: null };
}

export function rows<T extends Record<string, unknown>>(
  data: T[],
): QueryResult {
  return { data, error: null };
}

export const noRow: QueryResult = { data: null, error: null };

export function dbError(message: string): QueryResult {
  return { data: null, error: { message } };
}
