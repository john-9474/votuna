"""CRUD helpers for recommendation decline records."""

from datetime import datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.crud.base import BaseCRUD
from app.models.votuna_track_recommendation_declines import VotunaTrackRecommendationDecline


class VotunaTrackRecommendationDeclineCRUD(BaseCRUD[VotunaTrackRecommendationDecline, dict, dict]):
    def list_declined_track_ids(
        self,
        db: Session,
        playlist_id: int,
        user_id: int,
    ) -> set[str]:
        """Return declined provider track ids for a user in one playlist."""
        rows = (
            db.query(VotunaTrackRecommendationDecline.provider_track_id)
            .filter(
                VotunaTrackRecommendationDecline.playlist_id == playlist_id,
                VotunaTrackRecommendationDecline.user_id == user_id,
            )
            .all()
        )
        return {track_id for (track_id,) in rows}

    def get_for_track(
        self,
        db: Session,
        playlist_id: int,
        user_id: int,
        provider_track_id: str,
    ) -> VotunaTrackRecommendationDecline | None:
        """Return decline row for one user/playlist/track."""
        return (
            db.query(VotunaTrackRecommendationDecline)
            .filter(
                VotunaTrackRecommendationDecline.playlist_id == playlist_id,
                VotunaTrackRecommendationDecline.user_id == user_id,
                VotunaTrackRecommendationDecline.provider_track_id == provider_track_id,
            )
            .first()
        )

    def upsert_decline(
        self,
        db: Session,
        *,
        playlist_id: int,
        user_id: int,
        provider_track_id: str,
        declined_at: datetime,
    ) -> VotunaTrackRecommendationDecline:
        """Create or update a decline row and return it."""
        existing = self.get_for_track(db, playlist_id, user_id, provider_track_id)
        if existing:
            return self.update(db, existing, {"declined_at": declined_at})
        try:
            return self.create(
                db,
                {
                    "playlist_id": playlist_id,
                    "user_id": user_id,
                    "provider_track_id": provider_track_id,
                    "declined_at": declined_at,
                },
            )
        except IntegrityError:
            db.rollback()
            conflict = self.get_for_track(db, playlist_id, user_id, provider_track_id)
            if not conflict:
                raise
            return self.update(db, conflict, {"declined_at": declined_at})


votuna_track_recommendation_decline_crud = VotunaTrackRecommendationDeclineCRUD(VotunaTrackRecommendationDecline)
