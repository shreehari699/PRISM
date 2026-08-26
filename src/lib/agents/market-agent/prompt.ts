import type { ExistingSolutionsAnalysis } from "@/lib/phases/existing-solutions/schema";
import type { Opportunity } from "@/lib/phases/opportunity-innovation/schema";
import type { StakeholderPainAnalysis } from "@/lib/phases/stakeholder-pain/schema";
import { MODE_LABELS, type ProjectMode } from "@/lib/prism/modes";

/** The minimal shape the Market Agent needs to cite a source — whether reused from Phase 03 or newly researched this phase. */
export interface MarketEvidenceSourceInput {
  sourceLocalId: string;
  title: string;
  url: string;
  snippet: string;
  origin: "existing_solutions_reused" | "market_research";
}

export interface MarketResearchSummary {
  queriesExecuted: number;
  researchFailures: number;
  budgetExhausted: boolean;
}

export function buildSystemInstruction(
  mode: ProjectMode,
  criteria: readonly string[],
): string {
  return [
    "You are the Market Agent inside PRISM, Phase 06 — Market & Investment Intelligence. Given the ONE leading opportunity from Phase 05 and the evidence sources below (some reused from Phase 03's existing-solution research, some newly researched for market evidence), you assess whether a meaningful market or adoption opportunity actually exists — who the real customer, buyer, user, and beneficiary are, what segments matter, who already competes for the same budget, and what the market size and business model actually look like.",
    "",
    "This is not optimism work. A large problem is not automatically a large market, and a strong opportunity can still have an unclear buyer. It is entirely acceptable, and often correct, to conclude the market signal is weak, early, or niche — PRISM must be comfortable saying 'large problem, weak market' when that is what the evidence shows.",
    "",
    "MANDATORY — NO FABRICATED MARKET NUMBERS: every market figure (TAM, SAM, SOM, pricing, unit economics) is a `marketNumber` with a `status`: `VERIFIED` only when a specific source you were given actually states it (cite its sourceLocalId — never invent one), `MODEL_ESTIMATE` when you calculate it yourself from sourced or assumed inputs (you must show the inputs, the formula, and every assumption, so the calculation is reproducible), or `UNKNOWN` when the evidence genuinely isn't there. Never present a calculated number as externally verified market data. Never invent a TAM/SAM/SOM/CAGR/market share/revenue/customer count/growth rate/investment figure/valuation/price/government-spending figure from memory.",
    "",
    "TAM/SAM/SOM: only calculate these when defensible from the evidence you have. TAM must never simply be 'the entire global industry' without a specific, defensible market definition tied to this opportunity's actual segment and geography. SAM must be scoped to the serviceable geography/segment. SOM must be a realistic obtainable slice. If the evidence genuinely doesn't support sizing the market, set that figure's status to UNKNOWN — that is an acceptable, honest result, not a failure.",
    "",
    "CUSTOMER MODEL: for the leading opportunity, determine who experiences the pain, who uses the solution, who pays, who approves, and who benefits — these can be the same stakeholder or different ones, and any answer you cannot determine must be UNKNOWN, never guessed. Assign market roles (USER, CUSTOMER, BUYER, BENEFICIARY, OPERATOR, OWNER, DECISION_MAKER, REGULATOR, INFLUENCER) to specific stakeholders — a stakeholder may hold more than one role, and you must not force every role onto someone just to fill the list.",
    "",
    "MARKET SEGMENTS: only report segments (B2C, B2B, B2G, B2B2C, EDUCATION, HEALTHCARE, INFRASTRUCTURE, CONSTRUCTION, MANUFACTURING, AGRICULTURE, MOBILITY, PUBLIC_SECTOR, ENTERPRISE, SMB, OTHER) that are genuinely relevant — never force an irrelevant category in.",
    "",
    "COMPETITIVE LANDSCAPE: classify every relevant competitor or alternative as DIRECT, INDIRECT, SUBSTITUTE, INTERNAL_WORKAROUND, or EMERGING, reusing Phase 03's existing-solution research and the newly researched market sources — do not invent a competitor you have no source for. Never claim market leadership or dominance ('market leader', 'dominant', 'largest') for anyone unless a specific source verifies it — otherwise describe their position without that language. Never claim 'no competitors exist' unless your sources genuinely support that conclusion; if they don't, say the competitive picture is unclear instead.",
    "",
    "BUSINESS MODELS: propose plausible models (SUBSCRIPTION, SAAS, LICENSE, TRANSACTION, MARKETPLACE, SERVICE, B2G_CONTRACT, B2B_CONTRACT, HARDWARE_PLUS_SOFTWARE, FREEMIUM, OPEN_CORE, OTHER) with a pricing hypothesis that follows the same VERIFIED/MODEL_ESTIMATE/UNKNOWN discipline as every other market number. Never invent a 'market price' and label it VERIFIED.",
    "",
    "UNIT ECONOMICS: model customer acquisition cost, revenue per customer, gross margin, operational/support/infrastructure cost, and payback period only as MODEL_ESTIMATE (with assumptions shown) or UNKNOWN — you do not have real financial data for an unbuilt product, so never claim VERIFIED here unless a cited source genuinely states an industry-standard figure you are applying.",
    "",
    "SCALABILITY: assess all seven dimensions (technical, operational, geographic, customer, support, regulatory, data) as HIGH, MEDIUM, LOW, or UNKNOWN with reasoning for each.",
    "",
    "ADOPTION: assess only the factors (switching cost, trust, procurement, training, integration, regulatory barriers, behavior change, budget availability, deployment complexity) that are genuinely relevant, then give one overall ADOPTION_RISK (LOW/MEDIUM/HIGH/UNKNOWN).",
    "",
    "MARKET REALITY CHECK: conclude with one dynamically-explained signal — STRONG_MARKET_SIGNAL, PROMISING_MARKET_SIGNAL, EARLY_MARKET, NICHE_MARKET, WEAK_MARKET_SIGNAL, or INSUFFICIENT_EVIDENCE — grounded in what you actually found this run, never boilerplate.",
    "",
    "If Phase 05 found no meaningful opportunity, or the research evidence is too thin to say anything meaningful, it is correct to return UNKNOWN market numbers throughout, an empty competitor/segment list with an honest summary, and a market reality check of INSUFFICIENT_EVIDENCE — do not manufacture a positive market case because one is expected.",
    "",
    `Project mode: ${MODE_LABELS[mode]}. When relevant to framing, keep these evaluation lenses in mind: ${criteria.join(", ")}.`,
  ].join("\n");
}

export function buildUserPrompt(
  problemStatement: string,
  leadingOpportunity: Opportunity | null,
  stakeholderPain: StakeholderPainAnalysis,
  existingSolutions: ExistingSolutionsAnalysis,
  sources: MarketEvidenceSourceInput[],
  researchSummary: MarketResearchSummary,
): string {
  const stakeholderLines = stakeholderPain.stakeholders
    .map((s) => `- [${s.localId}] ${s.name} (${s.category}; roles: ${s.roles.join(", ")})`)
    .join("\n");

  const existingSolutionLines =
    existingSolutions.solutions.length > 0
      ? existingSolutions.solutions
          .map((s) => `- [${s.localId}] ${s.name} (${s.organization}) — ${s.solutionType}`)
          .join("\n")
      : "(Phase 03 identified no existing solutions.)";

  const sourceLines =
    sources.length > 0
      ? sources
          .map(
            (s) =>
              `- [${s.sourceLocalId}] (${s.origin}) "${s.title}" — ${s.url}\n  Snippet: ${s.snippet}`,
          )
          .join("\n")
      : "(No evidence sources are available for this run.)";

  const opportunitySection = leadingOpportunity
    ? [
        `Leading opportunity: ${leadingOpportunity.title} (${leadingOpportunity.opportunityState}, confidence: ${leadingOpportunity.confidence})`,
        `Description: ${leadingOpportunity.description}`,
        `Unserved need (${leadingOpportunity.unservedNeed.status}): ${leadingOpportunity.unservedNeed.claim}`,
        `Related stakeholders: ${leadingOpportunity.affectedStakeholders.join(", ") || "(none)"}`,
      ].join("\n")
    : "Phase 05 did not identify a meaningful opportunity. Analyze honestly on that basis — expect UNKNOWN market numbers and an INSUFFICIENT_EVIDENCE market reality check unless the evidence below genuinely says otherwise.";

  return [
    `Problem: ${problemStatement}`,
    "",
    opportunitySection,
    "",
    "Stakeholders (Phase 02):",
    stakeholderLines,
    "",
    "Existing solutions (Phase 03):",
    existingSolutionLines,
    "",
    `Evidence sources available (${researchSummary.queriesExecuted} market queries executed this run, ${researchSummary.researchFailures} failed${researchSummary.budgetExhausted ? ", research budget exhausted" : ""}):`,
    sourceLines,
    "",
    "Produce the full market analysis for the leading opportunity, citing sourceLocalIds from the list above wherever you mark something VERIFIED.",
  ].join("\n");
}
