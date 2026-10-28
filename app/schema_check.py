"""Read-only startup contract. Schema changes belong in versioned SQL migrations."""

from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import AsyncConnection

from app.database import Base


async def check_schema(connection: AsyncConnection) -> None:
    def check(sync_connection):
        inspector = inspect(sync_connection)
        problems = []
        tables = set(inspector.get_table_names(schema="public"))
        for table in Base.metadata.sorted_tables:
            if table.name not in tables:
                problems.append(f"missing table public.{table.name}")
                continue
            actual = {col["name"]: col for col in inspector.get_columns(table.name, schema="public")}
            for column in table.columns:
                if column.name not in actual:
                    problems.append(f"missing column {table.name}.{column.name}")
            if table.name == "users" and "avatar_url" in actual:
                avatar = actual["avatar_url"]
                if str(avatar["type"]).upper() != "TEXT" or not avatar["nullable"] or avatar["default"] is not None:
                    problems.append("users.avatar_url must be nullable TEXT without a default")
        enums = {item["name"]: set(item["labels"]) for item in inspector.get_enums(schema="public")}
        for table in Base.metadata.tables.values():
            for column in table.columns:
                labels = getattr(column.type, "enums", None)
                if labels and not set(labels).issubset(enums.get(column.type.name, set())):
                    problems.append(f"missing enum values for {column.type.name}")
        if problems:
            raise RuntimeError("Database schema incompatible; apply reviewed migrations before starting: " + "; ".join(sorted(set(problems))))

    await connection.run_sync(check)
