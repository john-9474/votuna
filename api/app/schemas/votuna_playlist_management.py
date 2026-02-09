"""Schemas for playlist management transfer flows."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.schemas.votuna_playlist import MusicProvider, ProviderTrackOut

ManagementDirection = Literal["import_to_current", "export_from_current"]
ManagementSelectionMode = Literal["all", "genre", "artist", "songs"]


class ManagementProviderPlaylistRef(BaseModel):
    kind: Literal["provider"] = "provider"
    provider: MusicProvider
    provider_playlist_id: str


class ManagementVotunaPlaylistRef(BaseModel):
    kind: Literal["votuna"] = "votuna"
    votuna_playlist_id: int


ManagementPlaylistRef = Annotated[
    ManagementProviderPlaylistRef | ManagementVotunaPlaylistRef,
    Field(discriminator="kind"),
]


class ManagementDestinationCreate(BaseModel):
    title: str
    description: str | None = None
    is_public: bool | None = None


class ManagementSourceTracksRequest(BaseModel):
    source: ManagementPlaylistRef
    search: str | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class ManagementSourceTracksResponse(BaseModel):
    tracks: list[ProviderTrackOut] = Field(default_factory=list)
    total_count: int
    limit: int
    offset: int


class ManagementFacetsRequest(BaseModel):
    source: ManagementPlaylistRef


class ManagementFacetCount(BaseModel):
    value: str
    count: int


class ManagementFacetsResponse(BaseModel):
    genres: list[ManagementFacetCount] = Field(default_factory=list)
    artists: list[ManagementFacetCount] = Field(default_factory=list)
    total_tracks_considered: int


class ManagementTransferRequest(BaseModel):
    direction: ManagementDirection
    counterparty: ManagementPlaylistRef | None = None
    destination_create: ManagementDestinationCreate | None = None
    selection_mode: ManagementSelectionMode = "all"
    selection_values: list[str] = Field(default_factory=list)


class ManagementPlaylistSummary(BaseModel):
    provider: MusicProvider
    provider_playlist_id: str
    title: str


class ManagementPreviewResponse(BaseModel):
    source: ManagementPlaylistSummary
    destination: ManagementPlaylistSummary
    selection_mode: ManagementSelectionMode
    selection_values: list[str] = Field(default_factory=list)
    matched_count: int
    to_add_count: int
    duplicate_count: int
    max_tracks_per_action: int
    matched_sample: list[ProviderTrackOut] = Field(default_factory=list)
    duplicate_sample: list[ProviderTrackOut] = Field(default_factory=list)


class ManagementFailedItem(BaseModel):
    provider_track_id: str
    error: str


class ManagementExecuteResponse(BaseModel):
    source: ManagementPlaylistSummary
    destination: ManagementPlaylistSummary
    created_destination: ManagementPlaylistSummary | None = None
    matched_count: int
    added_count: int
    skipped_duplicate_count: int
    failed_count: int
    failed_items: list[ManagementFailedItem] = Field(default_factory=list)
