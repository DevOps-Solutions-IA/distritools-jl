# ROOT-02 source and duplicate reconciliation

Evidence: PASS inventory at 2026-10-19T18:06:12.041356+00:00 through 2026-10-19T18:06:15.447110+00:00. Live GitHub main `aa619fc9f9b2ff6fd1a3cdf69fa19c42a69774d5` was checked using `git ls-remote` and GitHub branch API. Local `origin/main` matches; local branch `main` remains stale at `292a37912248c1ea08c2a04e3410978fec2380b5`. No branch ref was reset.

Coverage: **182 registered worktrees, 191 local branches, 100 distinct HEADs**, 102 advertised GitHub refs, 23 reachable heads/tags and 78 PR receipts. All 23 head/tag commit objects were locally available. Earlier 178/186 and interim 181/190 inventories are historical. New LEGAL24 worktree `/home/wundah/.codex/worktrees/89e8/distritoolsjl` is WT182; original IDs remain stable.

The snapshot contains 106 dirty worktrees and 2867 dirty/untracked path records; 0 unreadable files and 0 detected changes during hashing/status capture. ROOT-02 is an active output workspace and its source/CI scripts are excluded from historical source recovery totals. Registrations created after this timestamp require an appended inventory; concurrent work is never frozen or overwritten.

## How the comparison was made

- Every worktree: branch, HEAD, merge base, upstream, complete Git-visible tracked/untracked status, streaming SHA256, raw Git blob hash, deletions and symlink targets. Secret-bearing files were hashed without displaying or recording their contents. Ignored directory contents are outside Git status coverage; external package/evidence inventory is a separate lane. No untracked file was silently treated as committed.
- Every distinct HEAD: live-main ancestry, ahead/behind, exact tree differences and `git cherry` patch equivalence. All 26 ancestor HEADs, 61 HEADs with equivalent nonmerge patches and 13 HEADs with unmatched patches are retained separately. Patch equivalence does not prove final-tree or semantic integration, especially after squash merges and later fixes.
- Every dirty/untracked path: raw blob equality against the corresponding live-main path. A dirty ancestor checkout is never declared integrated solely because its HEAD is an ancestor. All dirty paths are compared before DUPLICATE_VERIFIED; this snapshot has no rename records or unsupported nonregular entries.
- All source/test dirty blobs were also checked for membership in objects reachable from canonical main history. Historical membership proves the bytes existed in canonical history; it does not establish same-path semantics or authorize restoration over newer source.
- GitHub visibility uses actual advertised refs and verified ancestry to heads/tags, not stale local tracking refs. Exact pull refs are listed separately and do not prove a published branch. Related PR numbers match an exact recorded head or merge SHA from the 78 GitHub API receipts; unproven associations remain NOT_TESTED.
- CSV source/test counts cover candidate paths introduced by `merge_base..HEAD` that still differ from main, overlaid with current dirty/untracked paths. Tests are a subset of source where recognized; deletions can count as candidates. They are candidate counts, not whole-repository file totals. The table below measures dirty/untracked occurrences only.

## Content findings

**2,437 historical dirty/untracked source/test occurrences** represent 498 distinct path/content pairs. Of these, 1,894 occurrences exactly match current main; 81 more have older blobs reachable in main history. The remaining **462 occurrences represent 113 distinct path/content pairs absent from canonical history**. They are preservation candidates, not proof that their behavior is desirable or absent semantically. There are 462 peer duplicate groups; this group count is independent of the 462 unpublished occurrences.

| Lane | Worktrees | Dirty source/test occurrences | Exact current main | Older canonical blob | Unseen canonical blob occurrences | Distinct unseen path/content |
|---|---:|---:|---:|---:|---:|---:|
| LOG | 4 | 116 | 0 | 0 | 116 | 30 |
| LOG31-QA | 3 | 89 | 0 | 0 | 89 | 30 |
| CONTROL | 7 | 48 | 10 | 0 | 38 | 14 |
| CAT | 8 | 195 | 182 | 4 | 9 | 5 |
| INV | 9 | 306 | 295 | 7 | 4 | 1 |
| SALE | 12 | 291 | 243 | 9 | 39 | 14 |
| CRM | 12 | 280 | 230 | 9 | 41 | 12 |
| IAM | 11 | 235 | 204 | 0 | 31 | 14 |
| CONTENT | 18 | 480 | 410 | 0 | 70 | 10 |
| PLATFORM | 15 | 121 | 97 | 24 | 0 | 0 |
| ENVIA | 1 | 0 | 0 | 0 | 0 | 0 |
| LEGAL | 3 | 1 | 1 | 0 | 0 | 0 |

Lane labels describe recovery provenance, not current leases or product acceptance. Distinct path/content counts overlap across lanes and cannot be summed as global uniqueness. The remaining historical/QA lanes are covered in CSVs and private manifests.

## Priority queues and exact comparison obligations

- **LOG31 / ROOT-01 QA — QA_BLOCKED.** Preserve original `/home/wundah/distritoolsjl-ex08-log-oct11` (WT137), its review (WT138), current-main composition WT018 and QA WT019 separately. WT137 and WT138 have identical 29 recognized source/test hashes (8 tests); WT018 and WT019 share another source signature. Their source difference is `frontend/src/tests/admin.test.tsx`; document/log/symlink differences remain separate. Protected W0b43/WT002 and W93ae/WT022 add `tests/critical/ex04-5-cutover-readiness.e2e.test.ts` beyond that composition; Wfa26/WT035 retains the composition signature. No QA result is inferred from equal source. ROOT-01 owns W0b43, W93ae, Wfa26 and its external evidence directory; all were read only. Next: verify current lease, inspect the exact LOG seam and current IAM fixture composition, then run separately authorized QA gates. Historical registry says LOG31 local gates FAIL; ROOT-02 did not rerun them.
- **CONTROL — unintegrated composition.** WT107 preserves 16 dirty/untracked paths, including 13 recognized source/test paths (4 tests); WT108 preserves 14 paths, 12 source/test (3 tests). WT109 additionally retains analytics dashboard/report backend use cases. Audit-boundary WT103/105 source hashes overlap main; their documentation remains separately compared. Next: compare the authorized tracking.read adjustment and analytics/dashboard/report behavior against live main, excluding already integrated audit/legacy/tracking projections. No full CONTROL certification.
- **INV — one distinct backend content candidate.** `src/modules/inventory/application/use-cases/dry-run-inventory-import.use-case.ts` SHA256 `52f2dbaf41e9d1b4a43bf89593af845b84e87d2673fca10689350a1980cbff3c` is preserved in WT125, WT128, WT129, WT133 and CRM WT111/112. Next: compare the exact validation/normalization change against live-main accepted inventory behavior and its tests; do not import the entire old checkout.
- **CAT / SALE / CRM / IAM / CONTENT — preserve 5 / 14 / 12 / 14 / 10 distinct unseen path/content pairs respectively.** These include earlier form and confirmation variants, permission atomicity overlays, legal-content projection variants and backend/test leftovers. Several appear in both implementation and review worktrees. Next: use `source-file-reconciliation.json` and per-worktree manifests to compare each unseen blob to current source and accepted closure requirements; establish intentionally superseded behavior with evidence before changing classification. Their product/domain closures in STATE do not erase old uncommitted bytes.
- **PLATFORM / F1 / F2 — no unseen dirty source blobs.** 97 occurrences equal live main and 24 are older canonical blobs. Next: verify the historical blob-to-current behavioral replacement and retain documentary/QA artifacts. Older canonical bytes are not current source candidates by default.
- **ENVIA — clean unpublished blueprint.** WT040 / `docs/ex10-envia-enterprise-blueprint-20261015`, HEAD `a595aabca33de3e38e3156e9a862d1f3774502d7`, has one unmatched commit and 29 candidate documentation/reference/validator paths. A clean tree does not make this merged. Next: compare all 29 committed paths, separate documentation acceptance from provider implementation, keep BLOCKED_PROVIDER and no real calls.
- **LEGAL — DRAFT/NO_PUBLICAR.** WT177 is clean at historical d87c712; external LEGAL24 documents are inventoried separately. New active WT182 `docs/legal24-approved-content-20261019` starts at live main and is a documentation import lane, not abandoned source. Enterprise content status is USER_CONTENT_APPROVED (2026-10-19), verified from `docs/legal/LEGAL24/BUSINESS_CONTENT_APPROVAL.json` in W89e8, SHA256 `5627a537ba7bd6294fdb970ada84537e253b91435e354bb06fe91ca5aec794bb`. Professional legal review, company identity/signatures, legal effectiveness and publication remain pending; NO_PUBLICAR and T01–T08 remain. Next: preserve the distinction between enterprise text approval and professional/publication authorization. Legacy technical legal/footer branches are not treated as current legal approval.
- **ENTERPRISE / governance branches.** BR023 `ci/enterprise-release-gates-2026-10` retains two unmatched commits and five candidate paths, exact GitHub branch/PR13 head `dbe739c7c57f43fbd04ec17aef7792ad5cc1fc64`; PR association does not prove merge of those patches. BR104 `orchestration/enterprise-control-plane` has one patch-equivalent commit, five differing candidate paths and verified PR3 head `78edad975b8edb5a3e67357bdb679320c515761c`. Next: compare actual lifecycle/readiness rules against current governance; do not restore historical state wholesale.

## Disposition limits

| Worktree preservation class | Count |
|---|---:|
| DUPLICATE_VERIFIED | 17 |
| EVIDENCE_ONLY | 1 |
| LEGAL_DRAFT | 3 |
| LOCAL_UNIQUE | 19 |
| MERGED_VERIFIED | 11 |
| PARTIALLY_INTEGRATED | 128 |
| QA_BLOCKED | 3 |

The 17 DUPLICATE_VERIFIED worktrees have ancestor committed history and every captured dirty/untracked path matches current-main bytes or is absent on both sides. The 11 MERGED_VERIFIED worktrees are clean with ancestor history. These labels describe captured Git-visible content only. No worktree has been classified SAFE_CLEANUP_CANDIDATE: ignored evidence, live leases, environment ownership and legal/provider decisions must still be checked. No semantic supersession or cleanup approval is inferred.

QA/security status for this recovery inventory is NOT_TESTED unless explicitly qualified as an existing historical FAIL. No product gate, dependency audit, secret scan, production readiness or provider readiness was rerun. No historical failed QA gate was hidden or replaced. No checkout was cleaned, reset, committed, pushed or merged.

## Evidence and reproducibility

Private evidence root: `/home/wundah/distritoolsjl-root02-evidence-20261019/A`. `registered-worktrees.json`, `local-branches.json`, `head-comparisons.json`, `committed-candidate-paths.json`, `github-refs.tsv`, `github-prs.json`, `asset-id-registry.json`, `source-file-reconciliation.json`, `duplicate-source-groups.json` and per-worktree SHA256 manifests support the CSV rows. Their hashes appear in `EVIDENCE_SHA256SUMS`; raw file/secret contents were never persisted. `inventory.py` captures and hashes; `enrich.py` adds history/peer reconciliation. `finalize.py` writes this report and snapshot metadata.

Rollback: close an unmerged PR and retain its branch plus every source/evidence asset. Any reversion requires a separate approved PR; no source or evidence deletion is authorized. Original worktrees, refs, evidence files, source and secrets remain untouched. Any eventual integration or cleanup requires a separate execution and orchestrator decision.
