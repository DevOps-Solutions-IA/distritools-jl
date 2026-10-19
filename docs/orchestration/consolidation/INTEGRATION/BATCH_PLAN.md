# ROOT-02 consolidation implementation plan

Goal: recover local engineering work against live main without duplicating integrations or bypassing owners, QA, legal review, or director authority.

Architecture: extend the canonical STATE/protocol/plan/matrix. CSV inventories describe assets; closure obligations in STATE describe accountable execution. The protocol state machine remains authoritative. No product implementation is included in this branch.

Spec: ROOT-02 director mandate, 2026-10-19. Original inventory base: aa619fc9f9b2ff6fd1a3cdf69fa19c42a69774d5. Current integration base after approved PR79: a5ef8f0d25fe00a7c0782bc5cd76dd4f2ec899be.

## Constraints and review focus

No deletion, PR80 merge without final director approval, direct-main push, force-push, production change, real provider call or legal publication. Original ROOT-01 QA leases are released and their source/evidence stays frozen; the concurrent PR81 executor retains exclusive ownership of its branch. Inventory coverage is distinct from semantic acceptance; dirty ancestor worktrees retain their uncommitted changes. Administrative certification stays 49/71. SHA manifests are integrity evidence, not independent backups.

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

`node --test scripts/ci/tests/*.test.js`; `node scripts/ci/orchestration-lifecycle-gate.js --base-ref a5ef8f0d25fe00a7c0782bc5cd76dd4f2ec899be`; `git diff --check`; redacted Gitleaks history/tree/diff; actionlint when available. Full seven canonical remote checks remain mandatory on the PR HEAD. The local change introduces no application, dependency, schema or migration delta. Independent review must assess missing metadata, skipped transitions, inventory overclaims, frozen ownership, and recoverability overclaims.

Rollback: close the unmerged PR and retain this branch/evidence. After an approved merge, use a separately approved revert PR; retain canonical open obligations until their disposition is documented. Never delete preservation assets as rollback.

## Authorized director follow-up

- [x] ROOT: final PR79 HEAD/seven/integrity/NO_PUBLICAR verified; authorized squash merge completed and new main tree verified. Remote source branch restored after repository automatic deletion; local source and verified Git bundle retained.
- [x] ROOT: reconcile the one adjacent-tail STATE conflict by retaining main's exact legal object plus PR80 closure obligations; add only documentary LOG QA status and next actions.
- [x] B: verify final LOG seal/source/gate/browser receipts read-only; record QA_LOCAL_PASS / PROMOTION_PENDING, released original leases and separately owned concurrent PR81. No local QA rerun.
- [ ] B: challenge revised documentary scope and merged STATE preservation.
- [ ] ROOT: commit/push revised dedicated PR80, obtain seven new exact-head checks, verify new main CI and present for final director approval. PR80 merge remains unauthorized.

Do not reuse PR80's earlier e293a4ff seven as evidence for its revised HEAD. Do not add administrative certification for LOG QA or PR creation.
