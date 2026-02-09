"""Votuna track addition provenance CRUD helpers."""

from sqlalchemy.orm import Session

from app.crud.base import BaseCRUD
from app.models.votuna_track_additions import VotunaTrackAddition


class VotunaTrackAdditionCRUD(BaseCRUD[VotunaTrackAddition, dict, dict]):
    def list_latest_for_tracks(
        self,
        db: Session,
        playlist_id: int,
        provider_track_ids: list[str],
    ) -> dict[str, VotunaTrackAddition]:
        """Return latest provenance row per provider track id."""
        if not provider_track_ids:
            return {}
        rows = (
            db.query(VotunaTrackAddition)
            .filter(
                VotunaTrackAddition.playlist_id == playlist_id,
                VotunaTrackAddition.provider_track_id.in_(provider_track_ids),
            )
            .order_by(
                VotunaTrackAddition.added_at.desc(),
                VotunaTrackAddition.id.desc(),
            )
            .all()
        )
        latest_by_track: dict[str, VotunaTrackAddition] = {}
        for row in rows:
            if row.provider_track_id in latest_by_track:
                continue
            latest_by_track[row.provider_track_id] = row
        return latest_by_track


votuna_track_addition_crud = VotunaTrackAdditionCRUD(VotunaTrackAddition)
