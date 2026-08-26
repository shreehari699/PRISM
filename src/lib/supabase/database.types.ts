/**
 * Placeholder Supabase database types.
 *
 * Once the migrations in supabase/migrations have been applied to a real
 * project, regenerate this file for real (do not hand-edit it):
 *
 *   npx supabase gen types typescript --project-id <project-ref> > src/lib/supabase/database.types.ts
 *
 * Until then, this file only carries the shape the rest of the app
 * compiles against; it intentionally does not enumerate every table so
 * that a stale hand-written type can't silently drift from the real
 * schema and be mistaken for a source of truth.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
