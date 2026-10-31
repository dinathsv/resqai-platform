"""Explicit, transactional migrations. Never invoked automatically by API startup.

Run `python -m database.run_migrations --check` to inspect pending changes,
then `python -m database.run_migrations` to apply them to DATABASE_URL.
"""
import argparse
import asyncio
import hashlib
import os
from pathlib import Path
import re
import asyncpg

ROOT = Path(__file__).resolve().parents[1]
LOCK_ID = 728194006


def migration_files():
    return sorted((ROOT / 'backend' / 'migrations').glob('[0-9][0-9][0-9]_*.sql'))


def migration_sql(source):
    # The runner owns each transaction; some historical scripts include wrappers.
    return re.sub(r'^\s*(?:BEGIN|COMMIT)\s*;\s*$', '', source, flags=re.MULTILINE | re.IGNORECASE)


async def run_migrations(database_url=None, check=False):
    url = database_url or os.environ.get('DATABASE_URL')
    if not url:
        raise RuntimeError('Set DATABASE_URL explicitly; no implicit production connection is used')
    url = url.replace('postgresql+asyncpg://', 'postgresql://', 1)
    connection = await asyncpg.connect(url, timeout=15, command_timeout=120)
    locked = False
    try:
        if check:
            exists = await connection.fetchval("SELECT to_regclass('public.schema_migrations')")
            if exists:
                has_checksum = await connection.fetchval('''SELECT EXISTS (
                    SELECT 1 FROM pg_attribute
                    WHERE attrelid = 'public.schema_migrations'::regclass
                      AND attname = 'checksum' AND NOT attisdropped)''')
                # A legacy ledger has version/applied_at only. Checking must not
                # alter it or manufacture a checksum for unverified history.
                checksum = 'checksum' if has_checksum else 'NULL::text AS checksum'
                rows = await connection.fetch(f'SELECT version, {checksum} FROM public.schema_migrations')
            else:
                rows = []
        else:
            await connection.execute('SELECT pg_advisory_lock($1)', LOCK_ID)
            locked = True
            await connection.execute('''CREATE TABLE IF NOT EXISTS public.schema_migrations (
                version TEXT PRIMARY KEY, checksum TEXT NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())''')
            # Leave old rows NULL: the current source cannot prove which bytes
            # were applied before checksums were recorded.
            await connection.execute('ALTER TABLE public.schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT')
            rows = await connection.fetch('SELECT version, checksum FROM public.schema_migrations')
        applied = {row['version']: row['checksum'] for row in rows}
        files = migration_files()
        known_versions = {path.name for path in files}
        unverified = sorted(version for version, checksum in applied.items()
                            if version in known_versions and checksum is None)
        if unverified:
            print('Warning: Unverified legacy migrations (no recorded checksum; not reapplied): '
                  + ', '.join(unverified))
        unknown = sorted(set(applied) - known_versions)
        if unknown:
            print('Warning: Unrecognized migration ledger versions (do not mark any file as applied): '
                  + ', '.join(unknown))
        pending = []
        for path in files:
            source = path.read_text()
            digest = hashlib.sha256(source.encode()).hexdigest()
            if path.name in applied:
                if applied[path.name] is not None and applied[path.name] != digest:
                    raise RuntimeError(f'Previously applied migration changed: {path.name}')
                continue
            pending.append(path.name)
            if not check:
                async with connection.transaction():
                    await connection.execute(migration_sql(source))
                    await connection.execute('INSERT INTO public.schema_migrations(version,checksum) VALUES($1,$2)', path.name, digest)
                print(f'Applied {path.name}')
        if check:
            print('Pending: ' + (', '.join(pending) or 'none'))
        return pending
    finally:
        try:
            if locked:
                await connection.execute('SELECT pg_advisory_unlock($1)', LOCK_ID)
        finally:
            await connection.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Read-only pending migration check')
    args = parser.parse_args()
    try:
        asyncio.run(run_migrations(check=args.check))
    except Exception as error:
        # Database exception text can contain credentials or row contents.
        print(f'Migration stopped ({type(error).__name__}). Review database access and migration compatibility. No connection details logged.')
        raise SystemExit(1)
