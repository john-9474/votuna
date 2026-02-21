"""add default table page size to user settings

Revision ID: a7c2e9f41b6d
Revises: e41b7f2a9c6d
Create Date: 2026-02-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7c2e9f41b6d"
down_revision: Union[str, None] = "c3d8e91a4f2b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the default table page size setting for each user."""
    op.add_column(
        "user_settings",
        sa.Column("default_table_page_size", sa.Integer(), nullable=False, server_default=sa.text("10")),
    )


def downgrade() -> None:
    """Remove the default table page size setting."""
    op.drop_column("user_settings", "default_table_page_size")
