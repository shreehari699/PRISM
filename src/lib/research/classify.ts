import type { ResearchSourceType } from "./types";

/**
 * Best-effort domain-based classification for providers (like generic web
 * search APIs) that don't report a source category themselves. This is a
 * heuristic label on a real, retrieved URL — not a fabricated fact — and
 * always falls back to "industry" rather than guessing something more
 * specific than the domain actually supports.
 */
export function classifySourceType(url: string): ResearchSourceType {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "industry";
  }

  if (host.endsWith(".gov") || host.includes(".gov.")) return "government";
  if (
    host.endsWith(".edu") ||
    /arxiv\.org|ncbi\.nlm\.nih\.gov|springer\.com|ieee\.org|acm\.org|sciencedirect\.com|nature\.com|jstor\.org/.test(
      host,
    )
  )
    return "academic";
  if (/github\.com|gitlab\.com|sourceforge\.net/.test(host))
    return "open_source";
  if (host.endsWith(".int") || /\.un\.org|worldbank\.org|oecd\.org/.test(host))
    return "international";
  if (
    /techcrunch\.com|producthunt\.com|ycombinator\.com|crunchbase\.com/.test(
      host,
    )
  )
    return "startup";
  if (/statista\.com|gartner\.com|mckinsey\.com|forrester\.com/.test(host))
    return "market";

  return "industry";
}
