from logging.config import fileConfig
from typing import Any
import logging

from sqlalchemy import engine_from_config
from sqlalchemy import pool
import sqlalchemy as sa

from alembic import context
from dotenv import load_dotenv
from app.db.session import Base

# Load environment variables
load_dotenv()

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
from app.config.settings import settings

target_metadata = Base.metadata
logger = logging.getLogger("alembic.env")

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = settings.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = settings.DATABASE_URL  # type: ignore[arg-type]
    x_args: dict[str, Any] = context.get_x_argument(as_dictionary=True)

    # Fail fast in deploys instead of waiting forever on locks.
    lock_timeout_ms = int(str(x_args.get("lock_timeout_ms", "30000")))
    statement_timeout_ms = int(str(x_args.get("statement_timeout_ms", "300000")))
    if lock_timeout_ms <= 0:
        lock_timeout_ms = 30000
    if statement_timeout_ms <= 0:
        statement_timeout_ms = 300000

    connectable = engine_from_config(
        configuration,  # type: ignore[arg-type]
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    logger.info(
        "Alembic migration start (lock_timeout_ms=%s, statement_timeout_ms=%s)",
        lock_timeout_ms,
        statement_timeout_ms,
    )
    with connectable.connect() as connection:
        logger.info("Alembic connected to database")
        connection.execute(sa.text(f"SET lock_timeout TO '{lock_timeout_ms}ms'"))
        connection.execute(sa.text(f"SET statement_timeout TO '{statement_timeout_ms}ms'"))
        # SQLAlchemy 2 starts an implicit transaction on execute().
        # Commit these session settings so Alembic can manage its own migration
        # transaction and persist DDL changes.
        connection.commit()
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            logger.info("Alembic running migrations")
            context.run_migrations()
            logger.info("Alembic migrations finished")


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
