# Local Docker database upgrades

ResQAI's Compose services connect to the PostgreSQL service named `postgres`, using its persistent Docker volume. This database is separate from Supabase. The host connects to port `5433`; containers connect to `postgres:5432`.

An upgraded API will refuse to start if its database still lacks the required migrations. Rebuilding images does not update an existing PostgreSQL volume.

From the repository root, upgrade an existing local database with:

```sh
docker compose stop python-api node-backend
docker compose up -d postgres redis
docker compose run --rm --build migrate
docker compose up -d --build
docker compose ps
```

Check health after startup:

```sh
curl --fail http://localhost:8000/health
curl --fail http://localhost:5000/health
```

The `migrate` service is an explicit maintenance command. It does not run during ordinary `docker compose up` and the APIs never apply schema changes during startup.

The configured `PYTHON_DATABASE_URL` determines the migration target. Both Python and Node should use the same database. For Docker, the two connection URLs in `.env` should use the `postgres` hostname, port `5432`, the local database name/user, and the same password as `POSTGRES_PASSWORD`. Keep credentials private. `.env.example` includes the URL formats.

For a new **empty** database, initialize the baseline before migrating:

```sh
docker compose up -d postgres redis
docker compose exec -T postgres psql -U resqai_user -d resqai -v ON_ERROR_STOP=1 < database/schema.sql
docker compose run --rm --build migrate
docker compose up -d --build
```

Do not initialize the baseline over existing tables. Do not remove the PostgreSQL volume to resolve a missing-column error.

Migration compatibility:

- The runner recognizes existing full-filename ledger entries, even when the historical table has no `checksum` column. It preserves those records without inventing historical checksums. New migrations record checksums and mismatches remain errors.
- Migration `013_legacy_status_enums.sql` upgrades older text status columns to the PostgreSQL enums required by the APIs. It refuses incompatible values rather than discarding them.
- Migration `014_backend_uuid_defaults.sql` adds missing server UUID defaults used by Node's chat and audit writes, while preserving existing rows and defaults.

To inspect pending work without changing the database:

```sh
docker compose run --rm migrate python -m database.run_migrations --check
```
