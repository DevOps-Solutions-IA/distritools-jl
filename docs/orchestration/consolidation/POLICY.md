# Consolidation policy

Source of truth: live GitHub main and canonical orchestration files. User mandate ROOT-02 authorizes isolated bounded corrections, local gates, commits and PR preparation only after applicable acceptance. Every PR merge requires its own explicit director approval. No deletion is authorized. No production/provider activation or legal publication is authorized.

The canonical protocol stages remain PLANNED -> BASELINED -> IMPLEMENTING -> TARGETED_GREEN -> FULL_GATE_GREEN -> SECURITY_GREEN -> USER_IMPACT_REVIEWED -> READY_FOR_PR -> PR_VALIDATED -> MERGED -> CLOSED. Director milestones (discovery, ownership, reconciliation, independent acceptance, exact-head CI, approval and state transition) are mandatory evidence within those stages. STATE.json `closure_obligations` extends the existing control plane; it is not a new orchestrator. The CI metadata check enforces structure and allowed transitions, not evidence authenticity or production readiness.

## Evidence and classification

Use evidence labels PASS, FAIL, BLOCKED_PROVIDER, BLOCKED_DECISION, USER_OBSERVED, NOT_TESTED and DEBT_DETECTED. Asset classifications are MERGED_VERIFIED, PARTIALLY_INTEGRATED, LOCAL_UNIQUE, DUPLICATE_VERIFIED, SUPERSEDED_VERIFIED, QA_BLOCKED, PROVIDER_BLOCKED, BUSINESS_DECISION_BLOCKED, LEGAL_DRAFT, EVIDENCE_ONLY and SAFE_CLEANUP_CANDIDATE. A classification is scoped to its evidence, not a blanket judgment on the whole asset. Inventory snapshots can become stale while an authorized owner works; rehash before transfer or deletion.

An ancestor commit does not establish that dirty files are integrated. Squash/cherry-pick integration needs patch/content comparison and independently verified PR receipts. Byte-identical files do not establish semantic interchangeability of evidentiary copies. A hash manifest proves integrity at capture; it is not a backup or a restoration proof. Preserve per-file uncertainty and exact next comparison rather than calling unreviewed differences obsolete.

## Ownership, blocked work and closure

Every actionable candidate has an owner, explicit exit, next action, dependency and preservation location. The inventory enumerates child assets covered by historical recovery obligations. Every unfinished agent session retains a recovery handoff before reassignment; live ownership takes precedence over historical status. ROOT-02 does not override ROOT-01 LOG leases. An implementer may not independently accept their own change.

Blocked work retains the failed command/receipt, blocker condition, named owner, exact action, dependency and preservation location. A narrow child acceptance cannot close its parent domain. No local implementation is CLOSED before integration, director approval and documentary transition. Every product change records user impact and rollback. No test/security/RBAC/audit/readiness assertion is weakened for a passing gate.

## Retention and disposal

A: potentially regenerable caches/build artifacts. B: fully integrated, independently backed-up disposable worktrees. C: byte-identical duplicate content with a verified authoritative copy. D: mandatory retained evidence. E: unique/uncommitted work retained indefinitely until disposition. Categories are proposals and can overlap; never add overlapping sizes as independent savings.

Before any future disposal, refresh Git/process/session references, prove dirty/untracked custody, verify backup hashes and restoration level, secure an exact-path director-approved manifest, and preserve failures and legal/company decisions. No git clean, hard reset, global prune or equivalent deletion under ROOT-02.

LEGAL24 business content approval is USER_CONTENT_APPROVED dated2026-10-19. It neither supplies missing corporate data nor resolves professional legal review, B01-B13 without explicit answers, effectiveness or publication. Retain DRAFT / NO_PUBLICAR and publication_authorized=false until those separate requirements are satisfied.
