# ResQAI database, backend, and security audit

Audit date: 2026-10-28. Scope: checked-out repository, local automated tests, and an isolated PostgreSQL 15/PostGIS 3.3 container. **No production connection, production data change, migration execution, rebuild, or deployment was performed.** Live Supabase roles, grants, policies, schema contents, Render settings, and Vercel settings remain unverified.

## 1. Confirmed registration root cause

The supplied production traceback establishes that the database serving `POST /api/auth/register` lacks `users.avatar_url`. `app/models/user.py` maps that column and `select(User)` selects every mapped user column, even when registration only checks email existence. PostgreSQL rejects the SELECT before password hashing or user insertion. This is independent of Supabase's UNRESTRICTED warnings.

The contract is **`avatar_url TEXT NULL`, without a database default**. Existing users should have NULL until they choose an avatar. The model and baseline SQL already specify this correctly. There is no need for a fake URL, NOT NULL constraint, backfill, account deletion, or reset.

The repository already contained `backend/migrations/002_users_avatar_url.sql`, and the previous Python Docker CMD invoked the migration runner. Therefore the repository alone cannot establish why production missed it. Plausible explanations requiring verification: an older image, a Render start-command override, a native-runtime deploy bypassing Docker CMD, migrations targeting a different database/schema, or ledger/schema drift. Do not assume any one explanation is proven.

## 2. Architecture and schema ownership

| Component | Database/access path | Findings |
|---|---|---|
| FastAPI `app/` | SQLAlchemy async sessions with asyncpg; `app/database.py` | Uses direct PostgreSQL credentials, not Supabase Auth/Data API. `get_db` scopes a session per request; uncommitted work rolls back on session close. |
| Node `backend/` | `pg.Pool` and parameterized SQL | Direct PostgreSQL; Express authorization is the access boundary. Previously added user columns after accepting traffic and swallowed initialization errors. |
| AI `ai-service/` | psycopg2 connections, queries run in executor | Calls `get_nearest_hospitals(lat,lng,limit)`; read-only hospital use. Its DSN must be a PostgreSQL DSN, not SQLAlchemy's `postgresql+asyncpg://` dialect URL. |
| Mobile Expo | HTTP APIs and Socket.IO | API_URL targets Python; SOCKET_URL targets Node; AI_URL and ML_API_URL target their services. No Supabase SDK/direct Data API access found. |
| Next.js admin | Axios HTTP API, administrator JWTs, Socket.IO | Node API for admin operations; Python for password resets. No direct database or Supabase SDK found. |
| ML service | Model files / weather / prediction endpoints | No PostgreSQL client or schema initialization found. |
| Redis | OTP TTLs, resend/login counters | Not a schema authority. Redis and SMS must work for successful registration. |
| Migration history | `backend/migrations/*.sql`, runner `database/run_migrations.py` | Custom filename ledger; no Alembic configuration found. Keep this as the one authoritative migration history. |
| Bootstrap | `database/schema.sql` | Only for an empty database. Contains PostgreSQL extensions, enums, constraints, indexes, triggers, and hospital function that ORM `create_all` does not reproduce. |

Models declare foreign keys but no ORM `relationship()` navigation. Thirteen mapped tables cover users, guest sessions, administrators, help requests, hospitals, NIC registry, missions, donations, volunteer assignments, emergency alerts, agency chat, ratings, and audit logs. Separate legacy migrations also create `alerts` and `alert_acknowledgements`; the application currently queries `emergency_alerts` instead.

### Schema differences: repository evidence, not a live-production inventory

| Item | SQL / consumer difference | Resolution/status |
|---|---|---|
| `users.avatar_url` | Model and baseline expect nullable TEXT; production error says absent | Existing 002 plus new forward-only 003 repair. |
| `users.user_type`, `users.is_active` | Node routes require them; absent from old baseline and User ORM | Added to baseline and 003, matching former Node startup defaults. Remain database-only fields for Python. |
| `relief_missions.district`, `.target` | Python model/listing expect them; old baseline lacks them | Added to baseline and 003. Nullable VARCHAR(100), NUMERIC(12,2) NOT NULL DEFAULT 0 respectively. |
| Emergency category enum | Models require `donation` and `help_rescue`; old deployments may lack labels | 003 moves former startup enum additions into migration history. |
| Help-request status update endpoint | Python accepted submitted/assigned/closed/flagged, but DB/Node use pending/ai_processing/verified/dispatched/in_progress/resolved/cancelled | Python endpoint now accepts the actual shared status vocabulary. |
| `users.phone_number` | SQL NOT NULL; ORM nullable | Registration requires and validates a number. Existing profile/seed paths still need separate nullability review; no existing rows altered. |
| Donation/mission/assignment status | SQL named enum versus ORM VARCHAR(30) | **Unresolved compatibility defect.** Local ORM insert into baseline mission enum reproduced ProgrammingError. Inspect live types and distinct status values before a versioned conversion/model change. No automatic conversion of existing records. |
| `relief_missions.target_zone` | SQL unconstrained GEOMETRY (unknown SRID); ORM expects geometry SRID 4326 | Inspect `geometry_columns` and actual stored SRIDs before changing geometry typmods; no coordinate reinterpretation performed. |
| `alerts` vs `emergency_alerts` | Legacy `alerts.work_plan` JSONB and varchar disaster type versus live code's emergency enum / TEXT work plan / polygon / admin FK | Do not merge or delete either table without examining usage/data. |
| Acknowledgements | Legacy FK points to `alerts`, while mobile displays IDs from `emergency_alerts`; mobile PATCH acknowledgement endpoint is missing | Unresolved. Mobile also stores acknowledgements locally. Moving the FK requires explicit data mapping, not blind migration. |
| Alert drafts / geometry | Node attempted `draft` though enum lacks it; accepted MULTIPOLYGON for POLYGON column | Draft requests now receive 400 rather than DB 500. Multipolygon conversion/validation remains outstanding. |
| Indexes/checks | Baseline has GiST and numerous lookup/FK indexes, severity/amount/hour checks, requester-type check, timestamp triggers, helper function; ORM metadata does not declare most of these | Databases originally bootstrapped by `create_all` can differ substantially. Use catalog results; no blind constraint addition or production index build. |

Baseline's explicit email/token/NIC indexes overlap unique-constraint indexes. They are potential redundancies, not grounds to drop production indexes without usage checks. `ratings` uniqueness permits repeated NULL request IDs under normal PostgreSQL semantics; confirm the intended business rule before changing it.

## 3. Supabase security findings

The reported UNRESTRICTED warnings are a reason to inspect RLS and grants, not evidence that they caused registration failure. No versioned RLS policies, table grants, or Supabase project configuration were found in the repository. Consequently actual anonymous exposure is **unverified**.

Run **all of `database/audit_readonly.sql`** in Supabase SQL Editor. It obtains columns/types/defaults, constraints, indexes, enums, geometry metadata, triggers, table ownership/RLS, policies, effective grants, PUBLIC/default ACLs, role inheritance/BYPASSRLS, and function execution metadata. It reads no user records or credential values. The script was syntax-validated on isolated PostGIS.

Then, if the ledger exists, run:

```sql
SELECT version, applied_at FROM public.schema_migrations ORDER BY version;
```

Repeat the following using **each backend's actual database connection identity**, since SQL Editor's privileged identity is not equivalent:

```sql
SELECT current_database(), current_user, session_user, current_setting('search_path');
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;
```

Confirm Dashboard > Data API > Exposed schemas, whether the Data API is enabled, and whether any clients outside this repository depend on it. A NULL `pgrst.db_schemas` setting does not prove that public is unexposed. The audit covers all public tables, not only the three warnings: users, NICs, sessions, chat, and audit logs can contain sensitive information.

### Recommended policy approach, pending actual role/grant results

This repository authenticates custom JWTs at its APIs. Direct SQL sessions do not automatically inherit each mobile user's JWT or Supabase `auth.uid()`. Enabling policies based on `auth.uid()` could deny every backend query. Owners and BYPASSRLS roles may bypass ordinary RLS; forced RLS changes owner behavior. Do not assume backend connections are `service_role` merely because Supabase hosts PostgreSQL.

For backend-only tables, consider disabling the unused Data API or exposing a dedicated API schema; otherwise explicitly revoke unneeded Data API access and use deny-by-default RLS only after verifying backend access. `schema_migrations` should never need client access. No permissive `USING (true)` policies were added.

After checking inherited/PUBLIC grants, identifying backend roles, and confirming no Data API consumer needs these tables, the following is a **review candidate**, not an automatically applicable migration:

```sql
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE public.alerts, public.alert_acknowledgements,
    public.schema_migrations FROM anon, authenticated;
COMMIT;
```

This alone does not remove inherited/PUBLIC grants and may not clear the dashboard RLS warning. Inspect those paths first; preserve explicit runtime and migration-role grants. RLS, default privileges, functions, and all sensitive tables need a policy tailored to the verified roles. No RLS changes were executed or included in the repair migration.

Reference: [Supabase RLS/grants](https://supabase.com/docs/guides/database/postgres/row-level-security), [Data API security](https://supabase.com/docs/guides/api/securing-your-api).

## 4. Confirmed application-security defects and fixes

- Node user-management endpoints required a token but did not require an administrator role. Citizens/guests could enumerate users and change verification/account state. They now require an admin JWT and an active administrator row.
- Node alert create/update routes accepted citizen tokens. Creation could substitute the first administrator or even create a synthetic administrator. Those fallbacks are removed; writes require a real active administrator.
- User-update `RETURNING *` exposed `password_hash`. It now returns an explicit public field list. User-management/profile error responses no longer include raw database error strings.
- `/api/requests/new` accepted unauthenticated broadcast requests. It now requires a constant-time-checked server-only `X-Internal-API-Key`; Python sends it. Configure the same private **INTERNAL_API_KEY, at least 32 random characters**, on both services. Without it, broadcasts fail closed with 503 and Python request creation still proceeds with a delivery error logged.
- Shared Node JWT verification now pins HS256 and requires a token subject. Python-issued citizen tokens using SECRET_KEY remain supported alongside Node's JWT_SECRET.
- Registration now validates name length, supported language, normalized mobile number, and bcrypt's 72-byte UTF-8 input limit. Passwords remain bcrypt-hashed.
- Registration uses flush/commit/rollback rather than committing a user and deleting it after SMS failure. Email uniqueness races return 409; failed SMS/Redis work does not commit a partial user. Cross-system delivery is not fully atomic: SMS may arrive even if final DB commit fails.
- OTP generation now uses cryptographic randomness. Test OTP delivery is mocked; tests never intentionally contact live SMS providers.
- FastAPI startup rejects an empty/short signing key. Its global error logger records exception class/path rather than SQL bound values that can contain password hashes or personal information.
- Development seeds no longer contain default passwords or print the administrator password. They still must never be run against production casually; the citizen seed can update existing users and is not part of deployment.

### Remaining security risks

OTP verification/reset attempt limits and atomic one-time consumption are not implemented. Node administrator login needs rate limiting. FastAPI authorization trusts JWT role claims until expiry; existing token revocation/administrator deactivation/suspended-citizen checks are not consistently enforced across both services and sockets. `users.is_active` is not currently consulted by Python citizen login. Guest NIC verification proves registry knowledge, not ownership. Admin tokens are accessible to browser JavaScript (cookie/localStorage), increasing XSS impact. CORS is broad; FastAPI combines wildcard origins with credentials. Dependency CVEs, runtime network controls/TLS certificates, and production secrets/rotation were not independently assessed. These are follow-up issues, not claims of exploitation.

## 5. Migration and deployment behavior

`backend/migrations/003_shared_schema_compatibility.sql` is new. It is additive and forward-only. It repairs avatar, adds the shared Node/mission columns, and moves emergency enum additions into a versioned migration. Existing 001 and 002 were not rewritten. It refuses an existing avatar column with an incompatible type/nullability/default instead of silently coercing data. Existing NULL avatar values stay NULL.

The runner now holds a PostgreSQL transaction advisory lock while checking the ledger and executing the batch, uses a five-second lock timeout, and commits the ledger with the DDL. Concurrent jobs were tested. Use a direct or session-mode Supabase connection for migrations; assess transaction-pooler compatibility separately. Files must remain immutable after release. No migration checksums are currently stored. Future migrations that must commit before new enum values are used, or that require nontransactional operations, need an explicit runner design change.

Both APIs now validate required schema before serving traffic. FastAPI checks all mapped table/column names, mapped enum labels, and the exact avatar contract. Node checks its critical shared columns. **These checks do not prove that all types, indexes, policies, and constraints are synchronized.** Runtime startup no longer alters tables, creates enums, or runs migrations. A new empty DB requires explicit baseline bootstrap plus versioned migrations.

### Manual emergency avatar repair in Supabase SQL Editor

First confirm `public.users` is the table used by the backend (schema/search_path), then review and execute:

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
COMMIT;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_url';
```

Expected: TEXT, YES, NULL default. `IF NOT EXISTS` does not repair an incompatible existing column. Do not mark 003 applied if only this statement was executed. This resolves only the confirmed avatar error; it does not install the complete compatibility migration.

For the full approved repair, run the authoritative runner (below), or execute the exact contents of 003 inside a transaction in SQL Editor after reviewing the existing migration ledger. Prefer the runner to keep ledger entries consistent. Do **not** paste the baseline schema into an existing project. Do not delete users or reset tables.

### Render instructions (manual approval required)

No Render Blueprint exists in this repository, so actual service settings cannot be inferred.

1. Obtain the read-only audit output, verify backup/restore availability, confirm all services point to the intended Supabase database and `public` schema, and review 001–003. Do not run development seeds.
2. Install the Python API from repository root: `pip install -r app/requirements.txt`. Docker: build with `app/Dockerfile` and **repository root as context**; it copies migrations and database files.
3. Set DATABASE_URL using the appropriate PostgreSQL connection string, REDIS_URL, SECRET_KEY (at least 32 characters), INTERNAL_API_KEY, NODE_BACKEND_URL, and SMSLENZ_USER_ID/API_KEY/SENDER_ID. Configure Node DATABASE_URL, JWT_SECRET, SECRET_KEY (to verify Python JWTs), INTERNAL_API_KEY, AI_SERVICE_URL, and SMS settings. Do not put these values in source/public frontend variables. Verify SSL and pooler mode using Supabase's connection guidance; Python dialect URLs and Node/psycopg2 URLs are not interchangeable verbatim.
4. After approval, run `python database/run_migrations.py` manually from repo root with the migration DATABASE_URL already securely set. It intentionally does not load `.env` automatically. Prefer a separate migration identity with DDL privileges and a runtime identity with only required DML.
5. After the first approved deployment, optionally configure Render Pre-Deploy Command `python database/run_migrations.py`. This is an explicit decision to apply future reviewed migrations on deployment. Pre-deploy support depends on service plan. Native Python start: `uvicorn app.main:app --host 0.0.0.0 --port "$PORT"`; Docker uses its CMD. Remove stale overrides that bypass expected entrypoints. No startup migration command remains.
6. Deploy Python and Node only after schema repair. Node root `backend`, build `npm ci`, start `npm start`; Render supplies PORT. Node's development default is 3000 while Compose sets 5000, so verify the actual URL/port rather than relying on Docker EXPOSE.
7. Verify startup schema checks, Redis, and the registration procedure below. A schema check failure intentionally prevents new instances from serving; inspect before retrying. Other production drift can still require separate migrations.

[Render deployment phases](https://render.com/docs/deploys) document pre-deploy ordering and its plan restrictions.

### Vercel / Expo instructions

No Vercel deployment config is present. For the admin project choose root `resqai-admin`, Next.js preset, install `npm ci`, build `npm run build`. NEXT_PUBLIC_API_URL and NEXT_PUBLIC_AUTH_API_URL should point to the HTTPS Node backend; NEXT_PUBLIC_PASSWORD_API_URL should point to the HTTPS Python API. Configure frontend CORS origins deliberately. Do not set DATABASE_URL, service-role credentials, JWT keys, or INTERNAL_API_KEY as NEXT_PUBLIC variables. No Vercel database migration step is appropriate for this frontend.

Public Next.js variables are baked into builds; changing them requires a new deployment. Production Expo profiles already specify the four Render service URLs in `mobile/eas.json`. Confirm those services are the intended deployments; changed EXPO_PUBLIC URLs require a rebuilt APK. No app rebuild is required solely to repair the server's avatar column. A Google Maps key needed by native builds must be available in the EAS environment; it is separate from private backend credentials.

[Vercel environment variables](https://vercel.com/docs/environment-variables), [Next.js public variable behavior](https://changelog.vercel.com/academy/nextjs-foundations/env-and-security).

## 6. Files changed

| Files | Purpose |
|---|---|
| `backend/migrations/003_shared_schema_compatibility.sql`, `database/schema.sql` | Additive repair and corrected empty-database bootstrap. |
| `database/run_migrations.py` | Serialized transactional migration history; explicit/manual execution. |
| `app/schema_check.py`, `app/main.py`, `app/Dockerfile` | Read-only startup gate, signing-key check, safer global logging, remove runtime DDL/migrations. |
| `backend/services/schemaService.js`, `backend/server.js` | Validate shared schema before listen; remove swallowed startup ALTERs. |
| `app/routers/auth.py` | Registration validation, transactions, concurrent uniqueness handling, cryptographic OTP, safe profile errors. |
| `app/routers/requests.py` | Shared request-status vocabulary and authenticated internal broadcast. |
| `backend/middleware/auth.js`, `backend/routes/users.js`, `backend/routes/alerts.js` | Admin authorization, current admin lookup, JWT restrictions, safe fields/errors, reject unsupported draft writes. |
| `backend/middleware/internal.js`, `backend/routes/requests.js`, `app/config.py`, `docker-compose.yml`, `.env.example` | Private internal broadcast credential on both services. |
| `database/seed_admin.py`, `database/seed_user.py` | Remove password defaults/output; environment-only seed passwords. Citizen positional arguments now email/full_name. |
| `tests/conftest.py`, `tests/test_auth.py` | Isolated signing key, fake Redis reset/cleanup, mocked SMS, validation/rollback tests. |
| `database/tests/test_postgres_integration.py`, `backend/tests/security.test.js` | Real PostGIS migration/auth lifecycle regression and Node security/startup checks. |
| `database/audit_readonly.sql`, `README.md`, this report | Production inspection queries and manual operations guide. |

## 7. Local verification and registration procedure

Executed checks:

- Python backend: **27 passed, 1 skipped** (existing unconfigured live-SMS test); SQLite geometry is mocked, so this suite alone is not a PostGIS migration proof.
- Separate real PostGIS test: **1 passed**; reproduced missing avatar, startup rejection, additive repair, legacy-user preservation, concurrent/idempotent migration runs, password hash verification, phone normalization, duplicate rejection, unverified-login rejection, OTP verification, JWT login/profile, SMS rollback.
- Node test files: pass, including admin restrictions, Python-token compatibility, internal credential, and read-only readiness checks.
- Mobile TypeScript and admin TypeScript: pass. Admin ESLint: zero errors, one pre-existing unused `fetcher` warning in `app/dashboard/page.tsx`.
- Python compile check and `git diff --check`: pass. Read-only SQL validated on isolated PostGIS.
- No production registration/SMS, live RLS/Data API exercise, production build/deploy, or full end-to-end admin/mobile test was performed. Python static type-checker/linter is not installed in the local venv. Deprecation warnings remain in the existing Python stack.

Repeat from repo root:

```bash
.venv/bin/python -m pytest tests -q
npm --prefix backend test
(cd mobile && npx tsc --noEmit)
(cd resqai-admin && npx tsc --noEmit && npm run lint)
.venv/bin/python -m compileall -q app database
 git diff --check
```

Real migration test: use a **new disposable** database; the test refuses a non-local host or a database name other than resqai_test and refuses a pre-existing users table. Run separately from SQLite tests, which patch geometry behavior globally:

```bash
docker run --rm -d --name resqai-audit-postgis-test \
  -e POSTGRES_USER=resqai_test -e POSTGRES_PASSWORD=isolated-test-only \
  -e POSTGRES_DB=resqai_test -p 127.0.0.1:55439:5432 postgis/postgis:15-3.3
docker exec resqai-audit-postgis-test pg_isready -U resqai_test -d resqai_test
TEST_POSTGRES_URL=postgresql://resqai_test:isolated-test-only@127.0.0.1:55439/resqai_test \
  .venv/bin/python -m pytest database/tests/test_postgres_integration.py -q
docker stop resqai-audit-postgis-test
```

The password above is intentionally disposable test data. Production migration command, **only after approval**, with DATABASE_URL already set securely:

```bash
.venv/bin/python database/run_migrations.py
```

Registration smoke test on an approved staging environment:

1. POST `/api/auth/register` with a new controlled email, a real consenting test phone, name, password (6+ characters, <=72 UTF-8 bytes), and en/ta/si language. Expect 201 and user_id; response contains no hash/password/token yet.
2. Repeat the same email: expect 409. Invalid language/phone/name: expect 422. Before verification, login should return 403.
3. Submit the received SMS code to POST `/api/auth/verify-otp` with user_id. Expect 200 and a bearer JWT. Wrong/expired OTP should return 400.
4. POST `/api/auth/login` with email/password. Expect 200; use token with GET `/api/auth/me`, verify profile and nullable avatar. Wrong password returns 401; repeated failures return 429.
5. In isolated/staging tests with mocked delivery failure, expect 502 and no committed new account. Never deliberately break the live SMS provider to test rollback.
6. Attempt Node user-management and alert writes using citizen/guest tokens: expect 403. An active administrator should retain access. No token should yield 401. Internal broadcast without its configured credential must be denied.

## 8. Required production follow-up

Return catalog audit output with identifying operational details redacted if necessary; do not send credentials, user rows, or JWTs. Resolve enum/string status compatibility, geometry SRIDs, and legacy alert acknowledgement mapping using those results. Check seed/account history for insecure defaults without assuming those accounts exist in production. Plan policy/grant hardening with actual backend identities, then retest legitimate backend operations under those identities. Migration and deployment actions remain manual pending review; the production schema is **not claimed synchronized**.
