# Integration and merge receipts

PASS baseline: live GitHub main aa619fc9f9b2ff6fd1a3cdf69fa19c42a69774d5. Its seven checks are completed/success on that exact SHA, workflow39209075325, independently queried2026-10-19. Latest validated product SHA e8249f7937421ae21008a80cc514dfd0b7fa23e7 is its ancestor. [Baseline workflow](https://github.com/DevOps-Solutions-IA/distritools-jl/actions/runs/39209075325).

Open PR count at discovery:0. New ROOT-02 merges:0. Merge approval: BLOCKED_DECISION until the director approves a specific reviewed PR. No direct main write occurred. ROOT-02 never treats baseline CI as candidate branch CI.

Canonical seven: backend-quality, backend-unit-security, frontend-quality, critical-integration, secret-scan, dependency-security, production-readiness-guard. All must pass on the candidate exact HEAD. Record head SHA, actual checkout/tree, run/attempt, files, source hashes, tests, challenger, zero-behind proof, user impact and rollback. A later update invalidates earlier HEAD acceptance.

PR links and final exact-head check results are held in `/home/wundah/distritoolsjl-root02-evidence-20261019/ROOT` to avoid changing the very commit being certified. The director-facing handoff contains the current receipts. After an authorized merge, verify live main and complete a separately governed documentary transition. Do not change validated_product_sha for documentary-only work.

Current main protection: strict seven checks, admins enforced, force-push/deletion disabled; required approving reviews0. GOV-BRANCH-PROTECTION-001 remains OPEN; configuration visibility does not prove organizational approval/enforcement or permit autonomous merge.
