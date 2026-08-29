/**
 * Turns a phase failure's raw, technical message (composer validation
 * text like `Opportunity "OPP-001" has a claim citing unknown source
 * "GAP-001".`, a provider/usage failure, or a generic error) into a
 * human headline and explanation for the primary UI, while preserving
 * the raw text for an expandable "Technical details" section — never
 * discarding it, only not leading with it.
 *
 * This is presentation only. It never changes what failed or why —
 * every category here maps to a real failure the phase engine already
 * produces; this only decides how to word it for a user who isn't
 * expected to parse a Zod-shaped validation message.
 */
export interface HumanizedPhaseError {
  headline: string;
  detail: string;
  raw: string;
}

const EVIDENCE_REFERENCE_PATTERN =
  /unknown (source|gap|stakeholder|pain|opportunity|solution|point|assumption|validation claim|failure mode|jury question)|cites? unknown|references? unknown|has no innovation assessment|more than one .* assessment|missing from the .* landscape|superlative differentiation|is a contradiction|NO_GAP_ESTABLISHED|cannot exceed (TAM|SAM)/i;

const UPSTREAM_REVALIDATION_PATTERN = /could not be re-validated/i;

const USAGE_LIMIT_PATTERN = /usage limit|rate limit|request limit|limit reached/i;

// Distinct from PRISM's own internal usage cap (USAGE_LIMIT_PATTERN above):
// this is the AI provider itself (Gemini) returning HTTP 429. The phase's
// own analysis was never invalid — the provider just couldn't be reached
// enough times in a row — so this must never read like an evidence or
// schema failure.
const RATE_LIMITED_PATTERN = /rate-limited|HTTP 429/i;

const CONFLICT_PATTERN = /already (has output|running)|is not awaiting approval|never run|not ready to run/i;

const SCHEMA_FAILURE_PATTERN = /failed schema validation|invalid_output|did not match the expected/i;

// These two are already client-authored, human-facing copy (see
// investigation-dashboard.tsx's request-timeout/network-failure catch) —
// not a raw composer/service message. They get a short headline but keep
// their own wording as the detail, rather than being demoted behind a
// generic fallback line they don't deserve.
const CLIENT_TIMEOUT_PATTERN = /taking far longer than expected/i;
const CLIENT_NETWORK_PATTERN = /network error stopped/i;

/** True when a phase failure message is the AI provider itself being rate-limited (HTTP 429) — used to drive a client-side retry cooldown, not just the display copy. */
export function isRateLimitedMessage(raw: string | null | undefined): boolean {
  return !!raw && RATE_LIMITED_PATTERN.test(raw);
}

export function humanizePhaseError(raw: string | null | undefined): HumanizedPhaseError {
  const message = raw?.trim() || "An unknown error occurred.";

  if (CLIENT_TIMEOUT_PATTERN.test(message)) {
    return { headline: "This phase is taking longer than expected", detail: message, raw: message };
  }

  if (CLIENT_NETWORK_PATTERN.test(message)) {
    return { headline: "A network error occurred", detail: message, raw: message };
  }

  if (EVIDENCE_REFERENCE_PATTERN.test(message)) {
    return {
      headline: "This phase's analysis couldn't be completed",
      detail:
        "PRISM detected an invalid or unsupported evidence reference while validating the previous phase's results. No unsupported conclusion was accepted.",
      raw: message,
    };
  }

  if (UPSTREAM_REVALIDATION_PATTERN.test(message)) {
    return {
      headline: "An earlier phase's results couldn't be re-confirmed",
      detail:
        "PRISM couldn't re-verify an earlier phase's output while running this one, so it stopped rather than build on unconfirmed evidence.",
      raw: message,
    };
  }

  if (RATE_LIMITED_PATTERN.test(message)) {
    return {
      headline: "AI provider is temporarily rate-limited",
      detail: "Please try again shortly.",
      raw: message,
    };
  }

  if (USAGE_LIMIT_PATTERN.test(message)) {
    return {
      headline: "PRISM has reached its usage limit for now",
      detail: "Try this phase again once your usage limit resets.",
      raw: message,
    };
  }

  if (CONFLICT_PATTERN.test(message)) {
    return {
      headline: "This phase isn't in a state that action can be taken on",
      detail: "Refresh this phase's status and try the appropriate action (run, regenerate, or approve).",
      raw: message,
    };
  }

  if (SCHEMA_FAILURE_PATTERN.test(message)) {
    return {
      headline: "PRISM's analysis didn't pass its own validation checks",
      detail:
        "The result PRISM generated for this phase failed an internal integrity check before it could be accepted, so nothing unverified was saved. Retrying often resolves this.",
      raw: message,
    };
  }

  return {
    headline: "This phase couldn't be completed",
    detail: "Something went wrong while running this phase. Retrying often resolves transient issues.",
    raw: message,
  };
}
