import {
  buildClarificationOptions,
  normalizeRefinements,
  normalizeResearchInput,
  safeCandidate,
} from "./research-contract.js";
import {
  createResearchRequest,
  getResearchRequest,
  updateResearchRequest,
} from "./research-store.js";
import {
  loadPersonCandidates,
  resolvePersonFromCandidates,
} from "./entity-resolution.js";
import { createSubject } from "./store.js";

function defaultStore() {
  return {
    create: createResearchRequest,
    get: getResearchRequest,
    update: updateResearchRequest,
  };
}

function decisionStatus(result) {
  const best = result.best;

  if (!best || best.level === "rejected") {
    return {
      status: "identity_review",
      identityStatus: "unmatched",
    };
  }

  if (best.hardMatch && best.level === "confirmed") {
    return {
      status: "collecting",
      identityStatus: "confirmed",
    };
  }

  return {
    status: "identity_review",
    identityStatus: best.level,
  };
}

async function resolveAndPersist(request, options = {}) {
  const store = options.store ?? defaultStore();
  const sourceCandidates = await (
    options.loadCandidates ?? loadPersonCandidates
  )(options.sql);

  const result = (
    options.resolveCandidates ?? resolvePersonFromCandidates
  )(request.input, sourceCandidates);

  const scoreById = new Map(
    result.candidates.map((item) => [String(item.entityId), item]),
  );

  const candidates = sourceCandidates
    .map((candidate) =>
      safeCandidate(
        candidate,
        scoreById.get(String(candidate.id)),
      ),
    )
    .filter((candidate) =>
      candidate.candidateId && candidate.level !== "rejected",
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, 20);

  const next = decisionStatus(result);

  return store.update(request.id, {
    input: request.input,
    status: next.status,
    identityStatus: next.identityStatus,
    resolvedSubjectId:
      next.identityStatus === "confirmed"
        ? result.best?.entityId ?? null
        : null,
    candidates,
    clarificationOptions: buildClarificationOptions(candidates),
  }, options.storeOptions);
}

export async function startResearch(input, options = {}) {
  const store = options.store ?? defaultStore();
  const normalized = normalizeResearchInput(input);
  const created = await store.create(normalized, options.storeOptions);

  await store.update(created.id, {
    status: "identity_search",
    identityStatus: "pending",
  }, options.storeOptions);

  return resolveAndPersist(
    { ...created, input: normalized },
    { ...options, store },
  );
}

export async function refineResearch(input, options = {}) {
  const store = options.store ?? defaultStore();
  const id = String(input?.researchRequestId ?? "").trim();

  if (!id) {
    throw new Error("RESEARCH_REQUEST_ID_REQUIRED");
  }

  const current = await store.get(id, options.storeOptions);

  if (!current) {
    return null;
  }

  const refinements = normalizeRefinements(input);
  const merged = normalizeResearchInput({
    ...current.input,
    ...refinements,
  });

  await store.update(id, {
    input: merged,
    status: "identity_search",
    identityStatus: "pending",
  }, options.storeOptions);

  return resolveAndPersist(
    { ...current, input: merged },
    { ...options, store },
  );
}

export async function resolveResearchCandidate(input, options = {}) {
  const store = options.store ?? defaultStore();
  const researchRequestId = String(
    input?.researchRequestId ?? "",
  ).trim();
  const candidateId = String(input?.candidateId ?? "").trim();
  const decision = String(input?.decision ?? "").trim();

  if (!researchRequestId) {
    throw new Error("RESEARCH_REQUEST_ID_REQUIRED");
  }

  if (!candidateId) {
    throw new Error("CANDIDATE_ID_REQUIRED");
  }

  if (!new Set(["accept", "reject"]).has(decision)) {
    throw new Error("INVALID_CANDIDATE_DECISION");
  }

  const current = await store.get(
    researchRequestId,
    options.storeOptions,
  );

  if (!current) {
    return null;
  }

  const exists = current.candidates.some(
    (candidate) => candidate.candidateId === candidateId,
  );

  if (!exists) {
    const error = new Error("CANDIDATE_NOT_FOUND");
    error.statusCode = 409;
    throw error;
  }

  const candidates = current.candidates.map((candidate) => ({
    ...candidate,
    decision:
      candidate.candidateId === candidateId
        ? decision === "accept" ? "accepted" : "rejected"
        : candidate.decision ?? null,
  }));

  let resolvedSubjectId = current.resolvedSubjectId;

  if (decision === "accept") {
    const selected = current.candidates.find(
      (candidate) => candidate.candidateId === candidateId,
    );
    const subject = await (
      options.createSubject ?? createSubject
    )({
      fullName: selected.fullName,
      organization: selected.organization,
      position: selected.position,
      city: selected.city,
      aliases: [],
      excludedTerms: [],
    });

    resolvedSubjectId = subject.id;
  }

  return store.update(researchRequestId, {
    candidates,
    status: decision === "accept" ? "collecting" : "identity_review",
    identityStatus: decision === "accept" ? "confirmed" : current.identityStatus,
    resolvedSubjectId,
  }, options.storeOptions);
}

export async function getResearchStatus(id, options = {}) {
  const normalized = String(id ?? "").trim();

  if (!normalized) {
    throw new Error("RESEARCH_REQUEST_ID_REQUIRED");
  }

  const store = options.store ?? defaultStore();
  return store.get(normalized, options.storeOptions);
}
