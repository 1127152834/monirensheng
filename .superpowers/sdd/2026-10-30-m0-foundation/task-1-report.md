# M0-01 implementer report

Status: DONE_WITH_CONCERNS. Date: 2026-10-31 Asia/Shanghai. Scope: isolated development baseline only; no M0 acceptance or business authorization claim.

## Implemented

Node24 npm workspace/lock, TypeScript config, Hono API GET /health, fixed-project PostgreSQL/Redis Compose, fail-closed preflight, macOS source-runtime launcher and independent logs/storage/config. Source Twenty `ab962b01c4fdb26cf3cffcc770c7bed0c38bb53e`, .nvmrc26.12.1; business Node24.22.0. Read parent DEPLOYMENT.md/start-twenty.sh and actual source package scripts before deriving dist entries. Existing source checkout never modified or original .env read. Existing dist copied into ignored `.runtime/twenty/dist`; node_modules referenced; clean environment assembled instead of inheriting application configuration. Runtime cwd has its own generated .env because source dotenv explicitly uses override:true. Secrets stored mode600 inside700 directories, random per isolated development installation.

Runtime names: Compose company-helper-crm-dev, PG15432, Redis16379, Twenty3100, API8788. Databases company_helper_twenty_dev and company_helper_business_dev. Isolated storage `.runtime/twenty/storage`; LOGIC_FUNCTION_TYPE DISABLED, telemetry/catalog/icons disabled. No service key or real customer data copied.

## Red / green evidence

1. Wrote tests and minimal permissive runPreflight stub; launched `npm install` then `npm run test:integration -- tests/integration/dev-isolation.test.ts` in an asynchronous shell.
2. Execution deviation: install took one minute, during which implementation was written; the automatic first test therefore ran against implemented logic and passed. This was not strict red-before-code. Explicitly put back permissive stub and ran exact test command: **10 failed / 1 passed**, all expected `true` vs `false` assertions for unsafe port3000, missing isolation, production environment, old PG5432, same database, Redis6379, remote host, wrong database and occupied port.
3. Restored strict implementation and repeated exact command: **11 passed**. Full `npm test`: **12 passed / 2 files** (additional API health contract). `npm run typecheck`: exit0. Final full tests also pass with dev instance running; occupied-port test verifies an existing listener survives without closing it.
4. `npm audit --audit-level=moderate`: initial adapter1.x moderate advisory fixed by upgrading @hono/node-server to2.1.3+, final **0 vulnerabilities**. `node --check scripts/dev-twenty.mjs`: exit0. `python3 scripts/check-docs.py`:18 Markdown/110 links pass; `git diff --check`: clean.

## Runtime verification

Actual new DB setup/migrations executed from isolated copied source dist: setup-db, run-instance-commands --force --include-slow, cache:flush, upgrade, cache:flush, cron:register:all. Initial empty schema bootstrap made expected pre-migration table lookup warnings, then migration command exit0; upgrade summary0 failed; cron31 successful/0 failed/4 skipped. Independent query returned company_helper_twenty_dev, company_helper_business_dev and core.workspace count0. No A/B/admin seeded yet.

`node scripts/dev-twenty.mjs up` / `npm run dev` now polls real HTTP health before success. Observed:
- http://localhost:3100/healthz ->200 `{"status":"ok","info":{},"error":{},"details":{}}`.
- http://127.0.0.1:8788/health ->200 statusok, servicecompany-helper-business-api, environmentdevelopment, isolationIdcompany-helper-crm-dev.
- http://localhost:3000/healthz ->200 identical original statusok before, after and after isolated restarts.
- Docker containers healthy with mappings127.0.0.1:15432->5432 and127.0.0.1:16379->6379, project-scoped volumes.
- Twenty worker has live launchctl PID; logs show successful processing CronTriggerCronJob/AgentCronTriggerCronJob. lsof on isolated server/worker shows PG15432/Redis16379; original PG5432/Redis6379 never targeted.
- Frontend3100 HTML200, window._env_={}, injected client-config.serverUrl=http://localhost:3100. Source front config falls back to window.location.origin, so copied original front does not redirect API to3000.
- `npm run dev:stop` stops only unique development labels/Compose; original3000 remains200. Restart with retained volume succeeds. Repeated `npm run dev` while ports occupied exits1, existing dev and original health stay200.

Final launch uses /bin/bash wrapper (same pattern as existing deployment). Initial Documents log location produced launchctl EX_CONFIG78; /tmp isolated logs mode600 fixed log permission issue. API is compiled to `.runtime/business-api` using TypeScript then run by Node24; no unmanaged API process remains.

## Commands and locations for next task

From project root with Node24: `npm ci`, `npm test`, `npm run typecheck`, `npm run dev`; stop via `npm run dev:stop`. Requires Docker, fnm with source Node26.12.1, macOS launchctl user session, sibling twenty checkout and existing built dist/front. Startup reads source .nvmrc/package scripts/Git SHA, never original .env. See docs/reference/m0-validation.md for full operating record.

Local credentials `.local/dev.env`, generated runtime env `.runtime/twenty/.env` (do not print). Variables: POSTGRES_USER, POSTGRES_PASSWORD, TWENTY_DATABASE_URL, BUSINESS_DATABASE_URL, REDIS_URL, APP_SECRET, ENCRYPTION_KEY. Runtime logs /tmp/company-helper-crm-dev-{0,1,2}.log, labels org.codex.company-helper-crm-dev.server/.worker/.api. Successful init marker `.runtime/twenty/initialized` is checked alongside actual DB migration table; empty replacement DB reinitializes.

## Concerns / limits

- TDD ordering deviation above accurately disclosed; red verification occurred after implementation.
- A diagnostic complete launchctl print prefix accidentally included the generated synthetic development connection credential. Immediately rotated isolated DB role password, APP_SECRET and ENCRYPTION_KEY without outputting replacements; final restarts use new values. No original secret was accessed. Do not print launchctl full state/compose config. Final launcher arguments contain no application secrets (read only from isolated env file).
- Built Twenty artifacts reused instead of rebuilt; they were present at fixed checkout, not proven reproducibly built byte-for-byte. Docker postgres:16/redis:7 tags not digest pinned. macOS-only lifecycle, no production deployment or offline guarantee.
- /health for business API reports process baseline, not business authorization/schema readiness. No A/B/admin, object-role bypass, SDK extension or controlled write verified here. M0 remains in progress pending later tasks and user acceptance.
