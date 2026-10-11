# Reproducible EX-08 browser infrastructure

This selected platform baseline uses compiled production Next.js, compiled Nest
AppModule/controllers with the same bootstrap validation/filter/metrics/CORS and
shutdown hooks, real JWT/session/2FA/RBAC, Prisma, PostgreSQL16 and Redis7. No
business response is mocked. It certifies neither all42 routes nor any of the71
complete domain workflows. Providers/business decisions/SEC/GOV remain open;
production remains NO-GO.

From the repository root on Linux with Node22 and a **local Unix Docker daemon**:

```sh
npm ci
npm --prefix frontend ci
npm --prefix frontend exec -- playwright install chromium
npm --prefix frontend run test:browser:safety
EX08_BROWSER_EVIDENCE_DIR=/absolute/persistent/browser-evidence \
  npm --prefix frontend run test:browser
```

The evidence directory must be outside the repository. Each invocation creates a
new directory and records parent HEAD, dirty flag and SHA-256 of all tracked source plus the owned
untracked QA harness/config/lock; the aggregate is compared after execution.
A dirty parent HEAD does not represent a tested committed candidate.
The runner installs no dependencies and downloads no browser while executing.
Playwright is pinned at1.64.0 (registry Node>=20; this project uses Node22). Use
`playwright install --with-deps chromium` on a fresh CI runner if OS libraries are
missing. The local test uses Playwright's bundled Chromium; it has no dependency
on another worktree, npx cache package or system Chromium.

Before contacting Docker, the runner rejects backend/Next dotenv files. It also
rejects unrecognized configuration, provider configuration, duplicate settings,
ambiguous settings and unsafe targets in the existing test helper dotenv file.
It leaves found files intact. A comment-only
.env.test is allowed. A nonempty file is allowed only with CI=true and an
exact key/value match to the canonical original critical-job heredoc; these service URLs are
never reused and generated private process settings take authority.

Unset exported DATABASE_URL/REDIS_URL before running. Existing services are
refused. APP_ENV other than test, production NODE_ENV, auth bypass and remote
Docker contexts are refused. The runner creates only new owner-labelled
`postgres:16-alpine`/`redis:7-alpine` containers, explicitly binds new free loopback
ports, and checks actual IDs, phase/owner labels, no host bind mounts, versions,
URL-to-container port correspondence and Redis AOF/always/noeviction before
migrate/reset/seed. Shared/default and reserved other-agent ports are rejected.
The existing `assert-test-environment.js` also runs before mutation. A guarded
new test process supplies fresh synthetic passwords, encrypted2FA seeds and
random signing/encryption material; no product provider credentials are inherited.

The backend test entrypoint uses temporary TSX registration only to load the
existing seed helper, unregisters it, then loads the **compiled** AppModule. It
sets validation/global filter/metrics/CORS and shutdown hooks before init/listen.
No QA HTTP endpoint is added to the product app. A private test-process control
checks ownership again before inspecting Prisma or changing its synthetic role.

Selected browser assertions cover anonymous401/login recovery; invalid input400
and unknown-field rejection with no partial session; actual UI login2FA200;
SecureHttpOnly cookies/private self; sameJWT/current persisted role and403 target
reads; five viewport widths; confirmed logout201/cookie clearing plus actual
AuthSession.revokedAt and matching auth.logout; viewer403 read/write with unchanged
business rows/session count and actual auth.permission_denied audits; and a
previously revoked token401/login recovery. Serial state dependencies are
explicit; retries are zero and a failed predecessor cancels later cases rather
than manufacturing PASS. The unchanged214 frontend unit tests remain selected by
existing Vitest include patterns; no exclusion or old test modification is needed.

Each command/server has its own newly created process group and Linux session.
A stable Node command wrapper prevents npm exec/process.title changes from
invalidating its exact argv ownership proof. Cancellation records
PID/start time/worktree/entrypoint/group; before signalling each member, cleanup
checks group, creation time and its cwd inside this exclusive worktree. Only
proved members and exact proved container IDs are stopped/removed. The raw failed
attempt directories remain available; no reset/clean/prune or shared kill occurs.

**Evidence privacy:** the run directory is0700; credentials and process logs are
0600. Traces/video/screenshots and assertion-value reporting are disabled. The
reporter stores case title/status/duration, error count and source line only.
`private-*` (including fixture and postgres env), process logs and Playwright raw
output must never be uploaded. Upload only explicit sanitized allowlist:
`browser-results.json`, `acceptance.json`, `entry.json`, `source-hashes.json`,
`services.json`, `processes.json`, `service-version-proof.json`, `cleanup.json`,
`*-receipt.json`, `failure.json`. Do not upload the whole directory.

For governed CI, ROOT may append frontend npmci, browser install and this runner
**after** the unchanged full critical suite inside the existing
critical-integration job. Keep all seven control names. That step must unset only
its inherited service URL variables, set external `$RUNNER_TEMP` evidence,
retain failures and upload only the sanitized allowlist. Workflow edits and
exact-head verification belong to ROOT. Local PASS is not GitHub CI PASS.

Rollback removes only these new test-only files and restores frontend
package/lock to their verified preimages on a governed branch. No product behavior,
backend schema, migrations, helpers, RBAC, provider policy or STATE is changed.
