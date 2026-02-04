"""Votuna track suggestion CRUD helpers"""
from typing import Optional, Sequence
from sqlalchemy.orm import Session

from app.crud.base import BaseCRUD
from app.models.votuna import VotunaTrackSuggestion


class VotunaTrackSuggestionCRUD(BaseCRUD[VotunaTrackSuggestion, dict, dict]):
    def get_pending_by_track(
        self,
        db: Session,
        playlist_id: int,
        provider_track_id: str,
    ) -> Optional[VotunaTrackSuggestion]:
        """Return a pending suggestion for the track if it exists."""
        return (
            db.query(VotunaTrackSuggestion)
            .filter(
                VotunaTrackSuggestion.playlist_id == playlist_id,
                VotunaTrackSuggestion.provider_track_id == provider_track_id,
                VotunaTrackSuggestion.status == "pending",
            )
            .first()
        )

    def list_for_playlist(
        self,
        db: Session,
        playlist_id: int,
        status: str | None = None,
    ) -> Sequence[VotunaTrackSuggestion]:
        """Return suggestions for a playlist."""
        query = db.query(VotunaTrackSuggestion).filter(VotunaTrackSuggestion.playlist_id == playlist_id)
        if status:
            query = query.filter(VotunaTrackSuggestion.status == status)
        return query.order_by(VotunaTrackSuggestion.created_at.desc()).all()


votuna_track_suggestion_crud = VotunaTrackSuggestionCRUD(VotunaTrackSuggestion)