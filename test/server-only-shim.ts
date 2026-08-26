// Vitest runs in a plain Node context, not inside Next.js's "react-server"
// bundler condition, so the real `server-only` package (which throws
// unconditionally outside that condition) would fail on import. This
// shim replaces it in tests only — see vitest.config.ts — so
// server-only modules stay testable without weakening the real guard
// Next.js enforces at build time.
export {};
