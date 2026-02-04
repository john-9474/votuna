"""Votuna track vote CRUD helpers"""
from sqlalchemy.orm import Session

from app.crud.base import BaseCRUD
from app.models.votuna_votes import VotunaTrackVote


class VotunaTrackVoteCRUD(BaseCRUD[VotunaTrackVote, dict, dict]):
    def has_vote(self, db: Session, suggestion_id: int, user_id: int) -> bool:
        """Return whether the user already voted for the suggestion."""
        return (
            db.query(VotunaTrackVote)
            .filter(
                VotunaTrackVote.suggestion_id == suggestion_id,
                VotunaTrackVote.user_id == user_id,
            )
            .first()
            is not None
        )

    def count_votes(self, db: Session, suggestion_id: int) -> int:
        """Return the number of votes for the suggestion."""
        return (
            db.query(VotunaTrackVote)
            .filter(VotunaTrackVote.suggestion_id == suggestion_id)
            .count()
        )


votuna_track_vote_crud = VotunaTrackVoteCRUD(VotunaTrackVote)
