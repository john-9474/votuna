"""User routes"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.crud.user import user_crud
from app.crud.user_settings import user_settings_crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate
from app.schemas.user_settings import UserSettingsOut, UserSettingsUpdate
from app.utils.avatar_storage import delete_avatar_if_exists, get_avatar_file_path, save_avatar_upload

router = APIRouter()


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return current_user


@router.get("/me/settings", response_model=UserSettingsOut)
def get_my_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch the current user's settings, creating defaults if missing."""
    settings_row = user_settings_crud.get_by_user_id(db, current_user.id)
    if not settings_row:
        settings_row = user_settings_crud.create(db, {"user_id": current_user.id})
    return settings_row


@router.put("/me/settings", response_model=UserSettingsOut)
def update_my_settings(
    payload: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's settings."""
    settings_row = user_settings_crud.get_by_user_id(db, current_user.id)
    if not settings_row:
        settings_row = user_settings_crud.create(db, {"user_id": current_user.id})
    update_data = payload.model_dump(exclude_unset=True)
    return user_settings_crud.update(db, settings_row, update_data)


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update editable fields for the current user."""
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return current_user
    return user_crud.update(db, current_user, update_data)


@router.get("/me/avatar")
def get_my_avatar(current_user: User = Depends(get_current_user)):
    """Return the stored avatar image for the current user."""
    if not current_user.avatar_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")
    if str(current_user.avatar_url).startswith("http"):
        return RedirectResponse(url=current_user.avatar_url)
    path = get_avatar_file_path(current_user.avatar_url)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")
    return FileResponse(path)


@router.get("/{user_id}/avatar")
def get_user_avatar(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the stored avatar image for a user."""
    user = user_crud.get(db, user_id)
    if not user or not user.avatar_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")
    if str(user.avatar_url).startswith("http"):
        return RedirectResponse(url=user.avatar_url)
    path = get_avatar_file_path(user.avatar_url)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")
    return FileResponse(path)


@router.post("/me/avatar", response_model=UserOut)
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a new avatar for the current user."""
    new_avatar = await save_avatar_upload(file, current_user.id)
    delete_avatar_if_exists(current_user.avatar_url)
    return user_crud.update(db, current_user, {"avatar_url": new_avatar})
