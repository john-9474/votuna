"""expand invites for targeted and link flow

Revision ID: d3a9f7b1c2e4
Revises: b7d2c0a4c9f1
Create Date: 2026-02-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d3a9f7b1c2e4"
down_revision: Union[str, None] = "b7d2c0a4c9f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Apply schema changes for targeted invites and richer invite metadata."""
    op.add_column(
        "votuna_playlist_invites",
        sa.Column("invite_type", sa.String(), server_default="link", nullable=False),
    )
    op.add_column(
        "votuna_playlist_invites",
        sa.Column("target_auth_provider", sa.String(), nullable=True),
    )
    op.add_column(
        "votuna_playlist_invites",
        sa.Column("target_provider_user_id", sa.String(), nullable=True),
    )
    op.add_column(
        "votuna_playlist_invites",
        sa.Column("target_username_snapshot", sa.String(), nullable=True),
    )
    op.add_column(
        "votuna_playlist_invites",
        sa.Column("target_user_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "votuna_playlist_invites",
        sa.Column("accepted_by_user_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "votuna_playlist_invites",
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        op.f("ix_votuna_playlist_invites_target_auth_provider"),
        "votuna_playlist_invites",
        ["target_auth_provider"],
        unique=False,
    )
    op.create_index(
        op.f("ix_votuna_playlist_invites_target_provider_user_id"),
        "votuna_playlist_invites",
        ["target_provider_user_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_votuna_playlist_invites_target_user_id_users",
        "votuna_playlist_invites",
        "users",
        ["target_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_votuna_playlist_invites_accepted_by_user_id_users",
        "votuna_playlist_invites",
        "users",
        ["accepted_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Revert schema changes for targeted invites and richer invite metadata."""
    op.drop_constraint(
        "fk_votuna_playlist_invites_accepted_by_user_id_users",
        "votuna_playlist_invites",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_votuna_playlist_invites_target_user_id_users",
        "votuna_playlist_invites",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_votuna_playlist_invites_target_provider_user_id"),
        table_name="votuna_playlist_invites",
    )
    op.drop_index(
        op.f("ix_votuna_playlist_invites_target_auth_provider"),
        table_name="votuna_playlist_invites",
    )
    op.drop_column("votuna_playlist_invites", "accepted_at")
    op.drop_column("votuna_playlist_invites", "accepted_by_user_id")
    op.drop_column("votuna_playlist_invites", "target_user_id")
    op.drop_column("votuna_playlist_invites", "target_username_snapshot")
    op.drop_column("votuna_playlist_invites", "target_provider_user_id")
    op.drop_column("votuna_playlist_invites", "target_auth_provider")
    op.drop_column("votuna_playlist_invites", "invite_type")

