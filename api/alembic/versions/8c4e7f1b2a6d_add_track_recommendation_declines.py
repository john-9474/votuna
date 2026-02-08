"""add track recommendation declines

Revision ID: 8c4e7f1b2a6d
Revises: f2c19a7b5d41
Create Date: 2026-02-08 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8c4e7f1b2a6d"
down_revision: Union[str, None] = "f2c19a7b5d41"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add per-user recommendation decline tracking table."""
    op.create_table(
        "votuna_track_recommendation_declines",
        sa.Column("playlist_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider_track_id", sa.String(), nullable=False),
        sa.Column("declined_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["playlist_id"], ["votuna_playlists.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "playlist_id",
            "user_id",
            "provider_track_id",
            name="uq_votuna_track_recommendation_decline",
        ),
    )
    op.create_index(
        op.f("ix_votuna_track_recommendation_declines_id"),
        "votuna_track_recommendation_declines",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_votuna_track_recommendation_declines_playlist_id"),
        "votuna_track_recommendation_declines",
        ["playlist_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_votuna_track_recommendation_declines_user_id"),
        "votuna_track_recommendation_declines",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_votuna_track_recommendation_declines_provider_track_id"),
        "votuna_track_recommendation_declines",
        ["provider_track_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop per-user recommendation decline tracking table."""
    op.drop_index(
        op.f("ix_votuna_track_recommendation_declines_provider_track_id"),
        table_name="votuna_track_recommendation_declines",
    )
    op.drop_index(
        op.f("ix_votuna_track_recommendation_declines_user_id"),
        table_name="votuna_track_recommendation_declines",
    )
    op.drop_index(
        op.f("ix_votuna_track_recommendation_declines_playlist_id"),
        table_name="votuna_track_recommendation_declines",
    )
    op.drop_index(
        op.f("ix_votuna_track_recommendation_declines_id"),
        table_name="votuna_track_recommendation_declines",
    )
    op.drop_table("votuna_track_recommendation_declines")
