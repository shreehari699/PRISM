export type UsageKind = "ai" | "research";

export interface UsageCheckResult {
  allowed: boolean;
  safeMode: boolean;
  /** Present when allowed is false or safeMode is true — always shown to the user, never swallowed. */
  reason?: string;
  remaining: {
    daily: number;
    monthly: number;
  };
}
