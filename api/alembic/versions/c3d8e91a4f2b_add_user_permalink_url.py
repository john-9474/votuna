"""add user permalink url

Revision ID: c3d8e91a4f2b
Revises: 8c4e7f1b2a6d
Create Date: 2026-02-09 22:15:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c3d8e91a4f2b"
down_revision: Union[str, None] = "8c4e7f1b2a6d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Persist provider permalink URL for user profile links."""
    op.add_column("users", sa.Column("permalink_url", sa.String(), nullable=True))


def downgrade() -> None:
    """Remove persisted provider permalink URL."""
    op.drop_column("users", "permalink_url")
