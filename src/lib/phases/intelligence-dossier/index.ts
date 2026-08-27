import "server-only";

import { problemAnatomySchema } from "@/lib/agents/problem-analyst/schema";
import { runReportGenerator } from "@/lib/agents/report-generator";
import type { SectionId } from "@/lib/agents/report-generator/schema";
import { getAiProvider, type AiProvider, type AiResult } from "@/lib/ai";
import type { PhaseExecutionContext } from "@/lib/orchestrator/types";
import { existingSolutionsAnalysisSchema } from "@/lib/phases/existing-solutions/schema";
import { gapIntelligenceAnalysisSchema } from "@/lib/phases/gap-intelligence/schema";
import { marketInvestmentAnalysisSchema } from "@/lib/phases/market-investment/schema";
import { selectLeadingOpportunity } from "@/lib/phases/market-investment";
import { opportunityInnovationAnalysisSchema } from "@/lib/phases/opportunity-innovation/schema";
import { pocValidationAnalysisSchema } from "@/lib/phases/poc-validation/schema";
import { solutionConsultantAnalysisSchema } from "@/lib/phases/solution-consultant/schema";
import { stakeholderPainAnalysisSchema } from "@/lib/phases/stakeholder-pain/schema";
import { technicalFeasibilityAnalysisSchema } from "@/lib/phases/technical-feasibility/schema";
import { collectCitedSourceIds } from "@/lib/prism/evidence";
import type { ProjectMode } from "@/lib/prism/modes";

import { intelligenceDossierAnalysisSchema, type IntelligenceDossierAnalysis } from "./schema";

export * from "./schema";

function invalidOutput<T>(message: string, raw: unknown): AiResult<T> {
  return { status: "invalid_output", message, raw: JSON.stringify(raw) };
}

/** BUILD=0 (best) ... DO_NOT_BUILD=3 (worst); INSUFFICIENT_EVIDENCE is handled off-ladder. */
const LADDER_POSITION: Record<string, number> = {
  BUILD: 0,
  VALIDATED_TO_PROCEED: 0,
  BUILD_WITH_CHANGES: 1,
  PROCEED_WITH_CHANGES: 1,
  VALIDATE_BEFORE_BUILD: 2,
  RESEARCH_BEFORE_BUILD: 2,
  DO_NOT_BUILD: 3,
};

function decisionAtPosition(position: number, mode: ProjectMode): IntelligenceDossierAnalysis["finalVerdict"]["decision"] {
  if (position <= 0) return "BUILD";
  if (position === 1) return "BUILD_WITH_CHANGES";
  if (position === 2) return mode === "RESEARCH" ? "RESEARCH_BEFORE_BUILD" : "VALIDATE_BEFORE_BUILD";
  return "DO_NOT_BUILD";
}

const SECTION_TITLES: Record<SectionId, string> = {
  EXECUTIVE_SUMMARY: "Executive Summary",
  PROBLEM: "Problem",
  STAKEHOLDERS: "Stakeholders",
  PAIN: "Pain",
  EXISTING_SOLUTIONS: "Existing Solutions",
  GAPS: "Gaps",
  OPPORTUNITY: "Opportunity",
  MARKET: "Market",
  FEASIBILITY: "Feasibility",
  SOLUTION: "Solution",
  ARCHITECTURE: "Architecture",
  POC: "Proof of Concept",
  IMPLEMENTATION: "Implementation",
  RED_TEAM: "Red Team",
  JURY: "Jury",
  ASSUMPTIONS: "Assumptions",
  VALIDATION: "Validation",
  FINAL_VERDICT: "Final Verdict",
  NEXT_ACTIONS: "Next Actions",
  EVIDENCE: "Evidence",
};

/** Model summaries are keyed in camelCase; the persisted section manifest is keyed by the fixed `SectionId` enum. */
const SECTION_SUMMARY_KEYS: Record<SectionId, string> = {
  EXECUTIVE_SUMMARY: "executiveSummary",
  PROBLEM: "problem",
  STAKEHOLDERS: "stakeholders",
  PAIN: "pain",
  EXISTING_SOLUTIONS: "existingSolutions",
  GAPS: "gaps",
  OPPORTUNITY: "opportunity",
  MARKET: "market",
  FEASIBILITY: "feasibility",
  SOLUTION: "solution",
  ARCHITECTURE: "architecture",
  POC: "poc",
  IMPLEMENTATION: "implementation",
  RED_TEAM: "redTeam",
  JURY: "jury",
  ASSUMPTIONS: "assumptions",
  VALIDATION: "validation",
  FINAL_VERDICT: "finalVerdict",
  NEXT_ACTIONS: "nextActions",
  EVIDENCE: "evidence",
};

const MAX_CRITICAL_SECTIONS = 5;

/**
 * Phase 10 — Final Intelligence Dossier & Decision Synthesis. Runs the
 * single Report Generator (per the phase catalog's own
 * `agents: ["report_generator"]` roster entry). The catalog's second
 * listed agent, `jury_agent`, is not separately invoked here: Phase 09's
 * Validation Agent already produced the full red-team and five-
 * perspective jury review, and re-running a second jury simulation
 * would duplicate that work rather than synthesize it — this composer
 * reuses Phase 09's jury output directly instead.
 *
 * The model supplies narrative synthesis and, where a section needs
 * one, a selection of a real upstream id (most important gap, featured
 * pains/solutions, red-team highlights, top jury questions). Every
 * other fact — stakeholder lists, gap buckets, market numbers,
 * feasibility dimensions, the jury panel, the assumption register — is
 * copied or filtered by this composer directly from Phases 01-09's own
 * structured output, never re-authored by the model.
 */
export async function runIntelligenceDossierPhase(
  context: PhaseExecutionContext,
  provider: AiProvider = getAiProvider(),
): Promise<AiResult<IntelligenceDossierAnalysis>> {
  const problemAnatomy = problemAnatomySchema.safeParse(
    context.upstreamOutputs.problem_intelligence,
  );
  const stakeholderPain = stakeholderPainAnalysisSchema.safeParse(
    context.upstreamOutputs.stakeholder_pain,
  );
  const existingSolutions = existingSolutionsAnalysisSchema.safeParse(
    context.upstreamOutputs.existing_solutions,
  );
  const gapIntelligence = gapIntelligenceAnalysisSchema.safeParse(
    context.upstreamOutputs.gap_intelligence,
  );
  const opportunityInnovation = opportunityInnovationAnalysisSchema.safeParse(
    context.upstreamOutputs.opportunity_innovation,
  );
  const marketInvestment = marketInvestmentAnalysisSchema.safeParse(
    context.upstreamOutputs.market_investment,
  );
  const technicalFeasibility = technicalFeasibilityAnalysisSchema.safeParse(
    context.upstreamOutputs.technical_feasibility,
  );
  const solutionConsultant = solutionConsultantAnalysisSchema.safeParse(
    context.upstreamOutputs.solution_consultant,
  );
  const pocValidation = pocValidationAnalysisSchema.safeParse(
    context.upstreamOutputs.poc_validation,
  );
  if (
    !problemAnatomy.success ||
    !stakeholderPain.success ||
    !existingSolutions.success ||
    !gapIntelligence.success ||
    !opportunityInnovation.success ||
    !marketInvestment.success ||
    !technicalFeasibility.success ||
    !solutionConsultant.success ||
    !pocValidation.success
  ) {
    return {
      status: "error",
      message:
        "Phase 01 through 09 output could not be re-validated while merging Phase 10 output.",
    };
  }

  const agentResult = await runReportGenerator(context, provider);
  if (agentResult.status !== "ok") {
    return agentResult;
  }
  const agent = agentResult.data;

  const p1 = problemAnatomy.data;
  const p2 = stakeholderPain.data;
  const p3 = existingSolutions.data;
  const p4 = gapIntelligence.data;
  const p5 = opportunityInnovation.data;
  const p6 = marketInvestment.data;
  const p7 = technicalFeasibility.data;
  const p8 = solutionConsultant.data;
  const p9 = pocValidation.data;

  // --- Cross-reference validation: every model-selected id must be real. ---

  if (agent.mostImportantGapId !== null) {
    const gap = p4.gapCandidates.find((g) => g.gapId === agent.mostImportantGapId);
    if (!gap) {
      return invalidOutput(`mostImportantGapId references unknown gap "${agent.mostImportantGapId}".`, agent);
    }
    if (!p4.confirmedGaps.includes(gap.gapId) && !p4.candidateGaps.includes(gap.gapId)) {
      return invalidOutput(
        `mostImportantGapId "${agent.mostImportantGapId}" is not a confirmed or candidate gap.`,
        agent,
      );
    }
  }
  const anyRealGap = p4.confirmedGaps.length > 0 || p4.candidateGaps.length > 0;
  if (anyRealGap && agent.mostImportantGapId === null) {
    return invalidOutput(
      "Phase 04 has confirmed or candidate gaps, but mostImportantGapId was null.",
      agent,
    );
  }

  for (const painId of agent.importantPainLocalIds) {
    if (!p2.painPoints.some((p) => p.localId === painId)) {
      return invalidOutput(`importantPainLocalIds references unknown pain "${painId}".`, agent);
    }
  }
  for (const solId of agent.importantSolutionLocalIds) {
    if (!p3.solutions.some((s) => s.localId === solId)) {
      return invalidOutput(`importantSolutionLocalIds references unknown solution "${solId}".`, agent);
    }
  }

  const { redTeamSelection } = agent;
  if (!p9.redTeamReview.points.some((pt) => pt.pointId === redTeamSelection.strongestAttackPointId)) {
    return invalidOutput(
      `redTeamSelection.strongestAttackPointId references unknown point "${redTeamSelection.strongestAttackPointId}".`,
      agent,
    );
  }
  if (!p9.assumptionRegister.some((a) => a.assumptionId === redTeamSelection.weakestAssumptionId)) {
    return invalidOutput(
      `redTeamSelection.weakestAssumptionId references unknown assumption "${redTeamSelection.weakestAssumptionId}".`,
      agent,
    );
  }
  for (const [field, id] of [
    ["biggestTechnicalRiskValidationId", redTeamSelection.biggestTechnicalRiskValidationId],
    ["biggestMarketRiskValidationId", redTeamSelection.biggestMarketRiskValidationId],
    ["biggestAdoptionRiskValidationId", redTeamSelection.biggestAdoptionRiskValidationId],
  ] as const) {
    if (id !== null && !p9.validationClaims.some((c) => c.validationId === id)) {
      return invalidOutput(`redTeamSelection.${field} references unknown validation claim "${id}".`, agent);
    }
  }
  if (!p9.failureModes.some((f) => f.failureId === redTeamSelection.mostLikelyFailureId)) {
    return invalidOutput(
      `redTeamSelection.mostLikelyFailureId references unknown failure mode "${redTeamSelection.mostLikelyFailureId}".`,
      agent,
    );
  }

  for (const qId of agent.topJuryQuestionIds) {
    if (!p9.juryQuestions.some((q) => q.questionId === qId)) {
      return invalidOutput(`topJuryQuestionIds references unknown jury question "${qId}".`, agent);
    }
  }

  const knownEvidenceIds = new Set<string>([
    ...p2.painPoints.map((p) => p.localId),
    ...p3.solutions.map((s) => s.localId),
    ...p4.gapCandidates.map((g) => g.gapId),
    ...p5.opportunities.map((o) => o.opportunityId),
    ...p9.assumptionRegister.map((a) => a.assumptionId),
    ...p9.validationClaims.map((c) => c.validationId),
    ...p9.redTeamReview.points.map((pt) => pt.pointId),
    ...p9.failureModes.map((f) => f.failureId),
    ...p9.juryQuestions.map((q) => q.questionId),
    ...p7.riskRegister.map((r) => r.riskId),
    ...p6.marketEvidence.sources.map((s) => s.sourceLocalId),
  ]);
  for (const [stageName, stage] of Object.entries(agent.decisionTrace)) {
    for (const evidenceId of stage.criticalEvidence) {
      if (!knownEvidenceIds.has(evidenceId)) {
        return invalidOutput(
          `decisionTrace.${stageName} cites unknown evidence "${evidenceId}".`,
          agent,
        );
      }
    }
  }

  let criticalSectionCount = 0;
  for (const key of Object.values(SECTION_SUMMARY_KEYS)) {
    if (agent.sectionSummaries[key as keyof typeof agent.sectionSummaries].importance === "CRITICAL") {
      criticalSectionCount += 1;
    }
  }
  if (criticalSectionCount > MAX_CRITICAL_SECTIONS) {
    return invalidOutput(
      `${criticalSectionCount} sections were marked CRITICAL — at most ${MAX_CRITICAL_SECTIONS} may be, so importance stays meaningful.`,
      agent,
    );
  }

  // --- Contradiction safeguards (defense-in-depth on top of each phase's own composer). ---

  if (p8.solution) {
    const gap = p4.gapCandidates.find((g) => g.gapId === p8.solution!.validatedGapId);
    if (gap && gap.gapState === "NO_GAP_ESTABLISHED") {
      return invalidOutput(
        `The recommended solution is grounded in gap "${gap.gapId}", but that gap is NO_GAP_ESTABLISHED.`,
        agent,
      );
    }
    const aiGenuinelyInvolved = p8.solution.aiRole.classification !== "AI_NOT_REQUIRED";
    if (!aiGenuinelyInvolved && p8.aiArchitecture !== null) {
      return invalidOutput(
        "Solution AI role is AI_NOT_REQUIRED, but Phase 08 carries an aiArchitecture.",
        agent,
      );
    }
  }

  // --- Deterministic final decision: never more optimistic than Phases 04-09 allow. ---

  let finalDecision: IntelligenceDossierAnalysis["finalVerdict"]["decision"];
  if (p8.solution === null) {
    finalDecision = p8.solutionRealityCheck.status === "NOT_RECOMMENDED" ? "DO_NOT_BUILD" : "INSUFFICIENT_EVIDENCE";
  } else if (p7.overallFeasibility.status === "INFEASIBLE") {
    finalDecision = "DO_NOT_BUILD";
  } else if (p9.finalValidationDecision === "INSUFFICIENT_EVIDENCE" || agent.buildRecommendation === "INSUFFICIENT_EVIDENCE") {
    finalDecision = "INSUFFICIENT_EVIDENCE";
  } else {
    const phase9Position = LADDER_POSITION[p9.finalValidationDecision];
    const agentPosition = LADDER_POSITION[agent.buildRecommendation] ?? 3;
    finalDecision = decisionAtPosition(Math.max(phase9Position, agentPosition), context.mode);
  }

  // --- Evidence summary: computed from structured data, never model text. ---

  const contradictions = p9.validationClaims.filter((c) => c.evidenceStatus === "CONTRADICTED").length;
  const citedIds = new Set<string>();
  collectCitedSourceIds({ p4, p5, p6, p7, p8, p9 }, citedIds);
  const knownSourceIds = new Set(p6.marketEvidence.sources.map((s) => s.sourceLocalId));
  const sourcesUsed = [...citedIds].filter((id) => knownSourceIds.has(id)).length;
  const evidenceSummary = {
    verifiedClaims:
      p4.evidenceSummary.verifiedClaimsCount +
      p6.evidenceSummary.verifiedNumbersCount +
      p7.evidenceSummary.verifiedClaimsCount +
      p8.evidenceSummary.verifiedClaimsCount +
      p9.validationClaims.filter((c) => c.evidenceStatus === "VERIFIED").length,
    inferences: p9.validationClaims.filter((c) => c.evidenceStatus === "INFERENCE").length,
    assumptions:
      p9.validationClaims.filter((c) => c.evidenceStatus === "ASSUMPTION").length +
      p9.assumptionRegister.length,
    unknowns: p9.validationClaims.filter((c) => c.evidenceStatus === "UNKNOWN").length,
    contradictions,
    sourcesUsed,
  };

  // --- Overall confidence: the most rigorous upstream signal (Phase 09's own), never averaged, with one honesty floor. ---

  let overallConfidence = p9.confidenceSummary.overallConfidence;
  if (overallConfidence === "HIGH" && contradictions > 0) {
    overallConfidence = "MEDIUM";
  }
  if (overallConfidence === "HIGH" && agent.buildRecommendation === "INSUFFICIENT_EVIDENCE") {
    overallConfidence = "MEDIUM";
  }

  // --- Assemble the dossier: every fact copied/filtered from upstream, never re-authored. ---

  const leadingOpportunity = selectLeadingOpportunity(p5);
  const mostImportantGap = agent.mostImportantGapId
    ? (p4.gapCandidates.find((g) => g.gapId === agent.mostImportantGapId) ?? null)
    : null;

  const stakeholders = p2.stakeholders;
  const byTier = (tier: "PRIMARY" | "SECONDARY" | "TERTIARY") =>
    stakeholders.filter((s) => s.category === tier).map((s) => s.name);
  const byRole = (role: string) =>
    stakeholders.filter((s) => s.roles.includes(role as (typeof s.roles)[number])).map((s) => s.name);

  const painsById = new Map(p2.painPoints.map((p) => [p.localId, p]));
  const stakeholderNameById = new Map(stakeholders.map((s) => [s.localId, s.name]));
  const painBriefEntries = agent.importantPainLocalIds.map((id) => {
    const pain = painsById.get(id)!;
    return {
      painLocalId: pain.localId,
      pain: pain.painTitle,
      affectedStakeholder: stakeholderNameById.get(pain.stakeholderLocalId) ?? pain.stakeholderLocalId,
      severity: pain.severityScore.overall.value,
      evidence: pain.description,
      confidence: pain.confidence,
    };
  });

  const solutionsById = new Map(p3.solutions.map((s) => [s.localId, s]));
  const featuredSolutions = agent.importantSolutionLocalIds
    .map((id) => solutionsById.get(id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined);

  const assumptionsById = new Map(p9.assumptionRegister.map((a) => [a.assumptionId, a]));
  const criticalAssumption = assumptionsById.get(p9.criticalAssumption.assumptionId)!;

  const resolveRedTeam = (id: string | null): { id: string; text: string } | null => {
    if (id === null) return null;
    const point = p9.redTeamReview.points.find((pt) => pt.pointId === id);
    if (point) return { id, text: point.argument };
    const claim = p9.validationClaims.find((c) => c.validationId === id);
    if (claim) return { id, text: claim.finding };
    const failure = p9.failureModes.find((f) => f.failureId === id);
    if (failure) return { id, text: failure.failure };
    const assumption = assumptionsById.get(id);
    return assumption ? { id, text: assumption.assumption } : null;
  };

  const topJuryQuestions = agent.topJuryQuestionIds.map((id) => {
    const q = p9.juryQuestions.find((question) => question.questionId === id)!;
    return { question: q.question, bestAnswer: q.bestAnswer, answerStatus: q.answerStatus };
  });

  const sortedExperiments = [...p9.validationPlan].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 } as const;
    return rank[a.priority] - rank[b.priority];
  });

  const decisionTrace = {
    problem: {
      phase: "problem_intelligence",
      finding: agent.decisionTrace.problem.finding,
      confidence: p1.problemScore.confidence,
      criticalEvidence: agent.decisionTrace.problem.criticalEvidence,
    },
    pain: {
      phase: "stakeholder_pain",
      finding: agent.decisionTrace.pain.finding,
      confidence: p2.realityCheck.primaryPainConfidence,
      criticalEvidence: agent.decisionTrace.pain.criticalEvidence,
    },
    gap: {
      phase: "gap_intelligence",
      finding: agent.decisionTrace.gap.finding,
      confidence: p4.confidenceSummary.overallConfidence,
      criticalEvidence: agent.decisionTrace.gap.criticalEvidence,
    },
    opportunity: {
      phase: "opportunity_innovation",
      finding: agent.decisionTrace.opportunity.finding,
      confidence: leadingOpportunity?.confidence ?? "UNKNOWN",
      criticalEvidence: agent.decisionTrace.opportunity.criticalEvidence,
    },
    market: {
      phase: "market_investment",
      finding: agent.decisionTrace.market.finding,
      confidence: p6.confidenceSummary.overallConfidence,
      criticalEvidence: agent.decisionTrace.market.criticalEvidence,
    },
    feasibility: {
      phase: "technical_feasibility",
      finding: agent.decisionTrace.feasibility.finding,
      confidence: p7.confidenceSummary.overallConfidence,
      criticalEvidence: agent.decisionTrace.feasibility.criticalEvidence,
    },
    solution: {
      phase: "solution_consultant",
      finding: agent.decisionTrace.solution.finding,
      confidence: p8.confidenceSummary.overallConfidence,
      criticalEvidence: agent.decisionTrace.solution.criticalEvidence,
    },
    validation: {
      phase: "poc_validation",
      finding: agent.decisionTrace.validation.finding,
      confidence: p9.confidenceSummary.overallConfidence,
      criticalEvidence: agent.decisionTrace.validation.criticalEvidence,
    },
  };

  const sectionManifest = (Object.keys(SECTION_TITLES) as SectionId[]).map((sectionId) => {
    const key = SECTION_SUMMARY_KEYS[sectionId] as keyof typeof agent.sectionSummaries;
    const authored = agent.sectionSummaries[key];
    return {
      sectionId,
      title: SECTION_TITLES[sectionId],
      summary: authored.summary,
      importance: authored.importance,
      status: "COMPLETE" as const,
    };
  });

  const merged: IntelligenceDossierAnalysis = {
    executiveSummary: agent.executiveSummary,
    problemBrief: {
      problem: p1.restatement,
      context: agent.problemContext,
      affectedUsers: p1.who.map((w) => w.group),
      corePain: p2.painPoints.find((p) => p.localId === p2.primaryPain.painLocalId)?.painTitle ?? p2.primaryPain.reasoning,
      problemClarity: p1.clarity.isWellDefined,
      evidenceStrength: p1.problemScore.confidence,
      importantUnknowns: [...p1.openQuestions, ...agent.problemImportantUnknowns],
    },
    stakeholderBrief: {
      primaryStakeholders: byTier("PRIMARY"),
      secondaryStakeholders: byTier("SECONDARY"),
      tertiaryStakeholders: byTier("TERTIARY"),
      users: byRole("USER"),
      buyers: byRole("BUYER"),
      beneficiaries: byRole("BENEFICIARY"),
      decisionMakers: byRole("DECISION_MAKER"),
      narrative: agent.stakeholderNarrative,
    },
    painBrief: { pains: painBriefEntries, narrative: agent.painNarrative },
    solutionLandscape: { solutions: featuredSolutions, narrative: agent.solutionLandscapeNarrative },
    gapBrief: {
      confirmedGaps: p4.confirmedGaps,
      candidateGaps: p4.candidateGaps,
      unverifiedGaps: p4.unverifiedGaps,
      noGapFindings: p4.noGapFindings,
      mostImportantGap,
      gapRealityCheck: p4.gapRealityCheck,
      narrative: agent.gapNarrative,
    },
    opportunityBrief: {
      leadingOpportunity,
      otherOpportunities: p5.opportunities.filter((o) => o.opportunityId !== leadingOpportunity?.opportunityId),
      opportunityRealityCheck: p5.opportunityRealityCheck,
      innovationDirectionSummary: agent.innovationDirectionSummary,
      differentiation: leadingOpportunity?.differentiation ?? null,
      aiJustificationSummary: agent.aiJustificationSummary,
      narrative: agent.opportunityNarrative,
    },
    marketBrief: {
      customerModel: p6.customerModel,
      marketSegments: p6.marketSegments,
      competitiveContext: p6.competitiveLandscape,
      businessModels: p6.businessModels,
      tamAnalysis: p6.tamAnalysis,
      samAnalysis: p6.samAnalysis,
      somAnalysis: p6.somAnalysis,
      marketRealityCheck: p6.marketRealityCheck,
      investmentRealityCheck: p6.investmentRealityCheck,
      narrative: agent.marketNarrative,
    },
    feasibilityBrief: {
      overallFeasibility: p7.overallFeasibility,
      technical: p7.technicalFeasibility,
      data: p7.dataFeasibility,
      ai: p7.aiFeasibility,
      hardware: p7.hardwareFeasibility,
      software: p7.softwareFeasibility,
      team: p7.teamFeasibility,
      time: p7.timeFeasibility,
      cost: p7.costFeasibility,
      regulatory: p7.regulatorySafety,
      security: p7.securityPrivacy,
      scalability: p7.scalability,
      criticalBlockers: p7.criticalBlockers,
      narrative: agent.feasibilityNarrative,
    },
    recommendedSolution: p8.solution
      ? {
          solutionName: p8.solution.name,
          tagline: p8.solution.tagline,
          executiveDescription: p8.solution.executiveSummary,
          whyThisSolution: p8.whyThisSolution?.summary ?? p8.solution.coreValueProposition,
          primaryUsers: p8.solution.primaryUsers,
          coreValueProposition: p8.solution.coreValueProposition,
          validatedGapId: p8.solution.validatedGapId,
          opportunityId: p8.solution.opportunityId,
          differentiation: p8.solution.differentiation.overallClaim,
          solutionType: p8.solution.solutionType,
          aiRoleClassification: p8.solution.aiRole.classification,
          technologyApproach: p8.solution.technologyApproach,
          architectureSummary: agent.solutionArchitectureSummary ?? "",
          dataFlowSummary: agent.solutionDataFlowSummary ?? "",
          coreFeatures: p8.solution.coreFeatures,
          mustBuild: p8.featureScope?.mustHave ?? [],
          shouldBuild: p8.featureScope?.shouldHave ?? [],
          future: p8.featureScope?.future ?? [],
          doNotBuild: p8.featureScope?.doNotBuild ?? [],
        }
      : null,
    pocPlan:
      p8.solution && p8.pocDefinition
        ? {
            objective: p8.pocDefinition.objective,
            scope: p8.pocDefinition.scope,
            input: p8.pocDefinition.input,
            process: p8.pocDefinition.process,
            output: p8.pocDefinition.output,
            successCriteria: p8.pocDefinition.successCriteria,
            failureCriteria: p8.pocDefinition.failureCriteria,
            estimatedEffort: p7.timeFeasibility.prototypeTime,
          }
        : null,
    implementationPlan: p8.solution
      ? {
          roadmapSteps: p8.solution.implementationPlan,
          modePlan: p8.modeSolutionPlan,
          narrative: agent.implementationNarrative ?? "",
        }
      : null,
    redTeamSummary: {
      strongestAttack: resolveRedTeam(redTeamSelection.strongestAttackPointId),
      weakestAssumption: resolveRedTeam(redTeamSelection.weakestAssumptionId),
      biggestTechnicalRisk: resolveRedTeam(redTeamSelection.biggestTechnicalRiskValidationId),
      biggestMarketRisk: resolveRedTeam(redTeamSelection.biggestMarketRiskValidationId),
      biggestAdoptionRisk: resolveRedTeam(redTeamSelection.biggestAdoptionRiskValidationId),
      mostLikelyFailure: resolveRedTeam(redTeamSelection.mostLikelyFailureId),
      mitigation: redTeamSelection.mitigation,
    },
    jurySummary: {
      technicalJudge: p9.jury.technicalJudge,
      domainJudge: p9.jury.domainExpert,
      businessJudge: p9.jury.businessJudge,
      impactJudge: p9.jury.impactJudge,
      productJudge: p9.jury.productJudge,
      topJuryQuestions,
    },
    assumptionSummary: {
      criticalAssumptions: [criticalAssumption],
      supportedAssumptions: p9.assumptionRegister.filter(
        (a) => a.status === "SUPPORTED" || a.status === "PARTIALLY_SUPPORTED",
      ),
      unsupportedAssumptions: p9.assumptionRegister.filter(
        (a) => a.status === "UNSUPPORTED" || a.status === "CONTRADICTED",
      ),
      unknownAssumptions: p9.assumptionRegister.filter((a) => a.status === "UNKNOWN"),
    },
    validationPlan: { experiments: sortedExperiments, narrative: agent.validationPlanNarrative },
    finalVerdict: {
      decision: finalDecision,
      confidence: overallConfidence,
      reason: agent.majorReasons[0] ?? agent.buildRecommendationReasoning,
      evidenceStrength: overallConfidence,
      majorReasons: agent.majorReasons,
      criticalBlockers: p7.criticalBlockers,
      nextAction: agent.nextActionPlan[0]?.action ?? "",
    },
    nextActionPlan: agent.nextActionPlan,
    decisionTrace,
    evidenceSummary,
    overallConfidence,
    sectionManifest,
    finalConsultantMessage: agent.finalConsultantMessage,
  };

  const validated = intelligenceDossierAnalysisSchema.safeParse(merged);
  if (!validated.success) {
    return invalidOutput(
      `Merged Phase 10 output failed schema validation: ${validated.error.message}`,
      merged,
    );
  }

  return {
    status: "ok",
    data: validated.data,
    model: agentResult.model,
    usage: agentResult.usage,
  };
}
