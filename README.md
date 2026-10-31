# ResQAI

ResQAI coordinates emergency assistance and relief goods in Sri Lanka through an Expo mobile app, a Next.js administration dashboard, a Python API, a Node real-time service and separate AI/ML services. SMS alerts and citizen verification use SMSlenz.

**Donations are emergency goods only.** There is no payment processing or money transfer workflow.

## Core capabilities

- Structured SOS and goods requests with location provenance, affected people and optional evidence notes.
- Recorded human verification, additional-information requests, review flags and decision history.
- Verified goods needs, quantity-based pledges, physical receipt, dispatch and recipient confirmation.
- Delivery disputes, separate-coordinator review and inventory safeguards.
- Volunteer participation with recipient-confirmed completion or a recorded coordinator exception.
- Durable mobile offline submission, visible retry status, account isolation and duplicate prevention.
- English, Sinhala and Tamil interfaces, multilingual first-aid information and assisted incident triage.
- SMSlenz OTP and alert delivery, Socket.IO updates, a persisted agency coordination room.
- Hospital lookup, an experimental flood-risk model, preparedness questions, operational reports, CSV export and browser printing.

Account verification, incident verification and delivery confirmation are separate. New claims are unverified and private to coordinators until reviewed. Anonymous urgent SOS remains accessible.

## Services

| Directory | Responsibility |
| --- | --- |
| `app/` | FastAPI authentication, requests, goods, missions and mobile APIs |
| `backend/` | Express administrator APIs, request review, inventory operations, chat and Socket.IO |
| `ai-service/` | Multilingual first-aid and other AI endpoints |
| `ml-models/` | Experimental flood prediction training and API |
| `mobile/` | React Native / Expo application |
| `resqai-admin/` | Next.js administration dashboard |
| `database/` | Baseline schema, explicit migration runner and integration checks |

## Setup and upgrade

Start with `.env.example` and configure private database, Redis, JWT and SMSlenz credentials in the relevant service environment. The database must support PostGIS. On an empty database initialize `database/schema.sql`, then run every versioned migration before starting either API:

```sh
python -m database.run_migrations --check
python -m database.run_migrations
```

The runner uses the explicitly configured `DATABASE_URL`. APIs validate schema compatibility at startup and do not migrate production automatically.

See [the goods relief upgrade guide](docs/GOODS_RELIEF_UPGRADE.md) for Render/Vercel/Expo configuration, database upgrade instructions, validation commands, practical limits and a complete viva demonstration.

## Local development

Install Python dependencies from `app/requirements.txt` and each Node application's declared dependencies. Use a PostgreSQL/PostGIS database with migrations applied and a running Redis instance. Typical service commands, run in separate terminals:

```sh
uvicorn app.main:app --host 0.0.0.0 --port 8000
npm --prefix backend start
npm --prefix resqai-admin run dev
npm --prefix mobile start
```

The AI and ML services use their own requirements, Dockerfiles and API entry points. Keep their URLs aligned with the Expo build configuration.

For an existing local Docker database, run:

```sh
docker compose up -d postgres redis
docker compose run --rm --build migrate
docker compose up -d --build
```

The Docker PostgreSQL volume is separate from Supabase. Applying SQL in Supabase does not upgrade the local volume. The migration command preserves existing data and supports the older filename-only migration ledger; historical entries without checksums are reported as unverified. Use the same command after pulling later migrations. Initialize `database/schema.sql` first only for a new empty database. See [local Docker troubleshooting](docs/LOCAL_DOCKER.md).

## Checks

From the repository root:

```sh
python -m pytest tests -q
npm --prefix backend test
node mobile/tests/requestQueue.test.cjs
mobile/node_modules/.bin/tsc --noEmit -p mobile/tsconfig.json
npm --prefix resqai-admin run build
```

The [upgrade guide](docs/GOODS_RELIEF_UPGRADE.md) describes the opt-in PostGIS cross-service test. Normal tests isolate external SMS and AI calls. Successful compilation and tests do not establish field validation or production load capacity.
