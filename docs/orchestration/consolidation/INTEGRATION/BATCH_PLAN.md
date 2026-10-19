# ROOT-02 consolidation implementation plan

Goal: recover local engineering work against live main without duplicating integrations or bypassing owners, QA, legal review, or director authority.

Architecture: extend the canonical STATE/protocol/plan/matrix. CSV inventories describe assets; closure obligations in STATE describe accountable execution. The protocol state machine remains authoritative. No product implementation is included in this branch.

Spec: ROOT-02 director mandate, 2026-10-19. Base: aa619fc9f9b2ff6fd1a3cdf69fa19c42a69774d5.

## Constraints and review focus

No deletion, merge, direct-main push, force-push, production change, real provider call or legal publication. Existing ROOT-01 LOG QA leases remain exclusive. Inventory coverage is distinct from semantic acceptance; dirty ancestor worktrees retain their uncommitted changes. Administrative certification stays 49/71. SHA manifests are integrity evidence, not independent backups.

## Tasks and owners

- [x] ROOT: read-only live GitHub/Git/orchestration/ownership baseline; isolate documentary branch.
- [x] A: exhaustive worktree/branch inventory; hash dirty candidates; compare ancestry, content and patch equivalence; record uncertainty.
- [x] B: reconcile current ROOT-01 LOG acceptance and CONTROL six-action contracts without competing execution.
- [x] C: external evidence/draft inventory, retention, measured deletion proposal and bounded restore proof; no deletion.
- [x] ROOT: add lifecycle ownership/exit/blocker/closure metadata to STATE; test rejection of missing owners, dropped obligations and invalid transitions before implementation. Add a bounded check to the existing production-readiness-guard job.
- [x] ROOT: prepare all required consolidation documents, extend AGENTS/protocol/plan/matrix and retain unchanged action/security/provider baselines.
- [ ] B: independently challenge the complete ROOT documentary/governance diff; ROOT resolves findings and runs gates.
- [ ] ROOT: after acceptance, commit/push only this dedicated branch and open a reviewable PR; record seven exact-head checks externally, refresh live main and stop for director merge approval. No closure claim before authorized merge and state transition.

## Gate commands and exit

`node --test scripts/ci/tests/*.test.js`; `node scripts/ci/orchestration-lifecycle-gate.js --base-ref aa619fc9f9b2ff6fd1a3cdf69fa19c42a69774d5`; `git diff --check`; redacted Gitleaks history/tree/diff; actionlint when available. Full seven canonical remote checks remain mandatory on the PR HEAD. The local change introduces no application, dependency, schema or migration delta. Independent review must assess missing metadata, skipped transitions, inventory overclaims, frozen ownership, and recoverability overclaims.

Rollback: close the unmerged PR and retain this branch/evidence. After an approved merge, use a separately approved revert PR; retain canonical open obligations until their disposition is documented. Never delete preservation assets as rollback.
