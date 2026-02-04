"""add votuna playlists

Revision ID: b7d2c0a4c9f1
Revises: 4bd6c165fbd8
Create Date: 2026-02-03 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d2c0a4c9f1'
down_revision: Union[str, None] = '4bd6c165fbd8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Apply schema changes for this revision."""
    op.create_table(
        'votuna_playlists',
        sa.Column('owner_user_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('provider_playlist_id', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['owner_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('provider', 'provider_playlist_id', name='uq_votuna_playlists_provider_playlist'),
    )
    op.create_index(op.f('ix_votuna_playlists_id'), 'votuna_playlists', ['id'], unique=False)
    op.create_index(op.f('ix_votuna_playlists_owner_user_id'), 'votuna_playlists', ['owner_user_id'], unique=False)
    op.create_index(op.f('ix_votuna_playlists_provider_playlist_id'), 'votuna_playlists', ['provider_playlist_id'], unique=False)

    op.create_table(
        'votuna_playlist_settings',
        sa.Column('playlist_id', sa.Integer(), nullable=False),
        sa.Column('required_vote_percent', sa.Integer(), server_default=sa.text('60'), nullable=False),
        sa.Column('auto_add_on_threshold', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['playlist_id'], ['votuna_playlists.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('playlist_id'),
    )
    op.create_index(op.f('ix_votuna_playlist_settings_id'), 'votuna_playlist_settings', ['id'], unique=False)

    op.create_table(
        'votuna_playlist_members',
        sa.Column('playlist_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['playlist_id'], ['votuna_playlists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('playlist_id', 'user_id', name='uq_votuna_playlist_member'),
    )
    op.create_index(op.f('ix_votuna_playlist_members_id'), 'votuna_playlist_members', ['id'], unique=False)
    op.create_index(op.f('ix_votuna_playlist_members_playlist_id'), 'votuna_playlist_members', ['playlist_id'], unique=False)
    op.create_index(op.f('ix_votuna_playlist_members_user_id'), 'votuna_playlist_members', ['user_id'], unique=False)

    op.create_table(
        'votuna_playlist_invites',
        sa.Column('playlist_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('uses_count', sa.Integer(), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), nullable=False),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['playlist_id'], ['votuna_playlists.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token'),
    )
    op.create_index(op.f('ix_votuna_playlist_invites_id'), 'votuna_playlist_invites', ['id'], unique=False)
    op.create_index(op.f('ix_votuna_playlist_invites_playlist_id'), 'votuna_playlist_invites', ['playlist_id'], unique=False)
    op.create_index(op.f('ix_votuna_playlist_invites_token'), 'votuna_playlist_invites', ['token'], unique=False)

    op.create_table(
        'votuna_track_suggestions',
        sa.Column('playlist_id', sa.Integer(), nullable=False),
        sa.Column('provider_track_id', sa.String(), nullable=False),
        sa.Column('track_title', sa.String(), nullable=True),
        sa.Column('track_artist', sa.String(), nullable=True),
        sa.Column('track_artwork_url', sa.String(), nullable=True),
        sa.Column('track_url', sa.String(), nullable=True),
        sa.Column('suggested_by_user_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['playlist_id'], ['votuna_playlists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['suggested_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_votuna_track_suggestions_id'), 'votuna_track_suggestions', ['id'], unique=False)
    op.create_index(op.f('ix_votuna_track_suggestions_playlist_id'), 'votuna_track_suggestions', ['playlist_id'], unique=False)
    op.create_index(op.f('ix_votuna_track_suggestions_provider_track_id'), 'votuna_track_suggestions', ['provider_track_id'], unique=False)

    op.create_table(
        'votuna_track_votes',
        sa.Column('suggestion_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['suggestion_id'], ['votuna_track_suggestions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('suggestion_id', 'user_id', name='uq_votuna_track_vote'),
    )
    op.create_index(op.f('ix_votuna_track_votes_id'), 'votuna_track_votes', ['id'], unique=False)


def downgrade() -> None:
    """Revert schema changes for this revision."""
    op.drop_index(op.f('ix_votuna_track_votes_id'), table_name='votuna_track_votes')
    op.drop_table('votuna_track_votes')
    op.drop_index(op.f('ix_votuna_track_suggestions_provider_track_id'), table_name='votuna_track_suggestions')
    op.drop_index(op.f('ix_votuna_track_suggestions_playlist_id'), table_name='votuna_track_suggestions')
    op.drop_index(op.f('ix_votuna_track_suggestions_id'), table_name='votuna_track_suggestions')
    op.drop_table('votuna_track_suggestions')
    op.drop_index(op.f('ix_votuna_playlist_invites_token'), table_name='votuna_playlist_invites')
    op.drop_index(op.f('ix_votuna_playlist_invites_playlist_id'), table_name='votuna_playlist_invites')
    op.drop_index(op.f('ix_votuna_playlist_invites_id'), table_name='votuna_playlist_invites')
    op.drop_table('votuna_playlist_invites')
    op.drop_index(op.f('ix_votuna_playlist_members_user_id'), table_name='votuna_playlist_members')
    op.drop_index(op.f('ix_votuna_playlist_members_playlist_id'), table_name='votuna_playlist_members')
    op.drop_index(op.f('ix_votuna_playlist_members_id'), table_name='votuna_playlist_members')
    op.drop_table('votuna_playlist_members')
    op.drop_index(op.f('ix_votuna_playlist_settings_id'), table_name='votuna_playlist_settings')
    op.drop_table('votuna_playlist_settings')
    op.drop_index(op.f('ix_votuna_playlists_provider_playlist_id'), table_name='votuna_playlists')
    op.drop_index(op.f('ix_votuna_playlists_owner_user_id'), table_name='votuna_playlists')
    op.drop_index(op.f('ix_votuna_playlists_id'), table_name='votuna_playlists')
    op.drop_table('votuna_playlists')
