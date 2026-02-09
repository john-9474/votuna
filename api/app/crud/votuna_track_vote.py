"""Votuna track vote CRUD helpers"""

from sqlalchemy.orm import Session

from app.crud.base import BaseCRUD
from app.models.user import User
from app.models.votuna_votes import VotunaTrackVote


class VotunaTrackVoteCRUD(BaseCRUD[VotunaTrackVote, dict, dict]):
    def get_vote(self, db: Session, suggestion_id: int, user_id: int) -> VotunaTrackVote | None:
        """Return an existing reaction row for user/suggestion."""
        return (
            db.query(VotunaTrackVote)
            .filter(
                VotunaTrackVote.suggestion_id == suggestion_id,
                VotunaTrackVote.user_id == user_id,
            )
            .first()
        )

    def has_vote(self, db: Session, suggestion_id: int, user_id: int) -> bool:
        """Return whether the user already reacted for the suggestion."""
        return self.get_vote(db, suggestion_id, user_id) is not None

    def set_reaction(self, db: Session, suggestion_id: int, user_id: int, reaction: str) -> VotunaTrackVote:
        """Create or update a user's reaction for a suggestion."""
        existing = self.get_vote(db, suggestion_id, user_id)
        if existing:
            return self.update(db, existing, {"reaction": reaction})
        return self.create(
            db,
            {
                "suggestion_id": suggestion_id,
                "user_id": user_id,
                "reaction": reaction,
            },
        )

    def clear_reaction(self, db: Session, suggestion_id: int, user_id: int) -> bool:
        """Delete a user's reaction for a suggestion."""
        existing = self.get_vote(db, suggestion_id, user_id)
        if not existing:
            return False
        return self.delete(db, existing.id)

    def count_reactions(self, db: Session, suggestion_id: int) -> dict[str, int]:
        """Return up/down/total reaction counts for the suggestion."""
        rows = db.query(VotunaTrackVote.reaction).filter(VotunaTrackVote.suggestion_id == suggestion_id).all()
        upvotes = 0
        downvotes = 0
        for (reaction,) in rows:
            if reaction == "down":
                downvotes += 1
            else:
                upvotes += 1
        return {
            "up": upvotes,
            "down": downvotes,
            "total": upvotes + downvotes,
        }

    def get_reaction_by_user(self, db: Session, suggestion_id: int) -> dict[int, str]:
        """Return user_id -> reaction mapping for a suggestion."""
        rows = (
            db.query(VotunaTrackVote.user_id, VotunaTrackVote.reaction)
            .filter(VotunaTrackVote.suggestion_id == suggestion_id)
            .all()
        )
        return {user_id: reaction for user_id, reaction in rows}

    def list_reactor_display_names(
        self,
        db: Session,
        suggestion_id: int,
        reaction: str | None = None,
    ) -> list[str]:
        """Return display names for users who reacted on the suggestion."""
        query = (
            db.query(User, VotunaTrackVote)
            .join(VotunaTrackVote, VotunaTrackVote.user_id == User.id)
            .filter(VotunaTrackVote.suggestion_id == suggestion_id)
        )
        if reaction is not None:
            query = query.filter(VotunaTrackVote.reaction == reaction)
        voters = query.order_by(VotunaTrackVote.created_at.asc()).all()
        names: list[str] = []
        for user, _vote in voters:
            display_name = (
                user.display_name or user.first_name or user.email or user.provider_user_id or f"User {user.id}"
            )
            names.append(display_name)
        return names


votuna_track_vote_crud = VotunaTrackVoteCRUD(VotunaTrackVote)
