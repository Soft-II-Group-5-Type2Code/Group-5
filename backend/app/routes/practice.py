from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.db import supabase
from app.schemas import (
    PracticeStartRequest,
    PracticeStartResponse,
    PracticeSubmitRequest,
    PracticeSubmitResponse
)
from app.auth.dependencies import get_current_user
router = APIRouter(
    prefix="/api/practice",
    tags=["practice"]
)

# -------------------------------------------------
# LOCAL DEV AUTH STUB
# DO NOT COMMIT THIS VERSION TO TEAM REPO
# -------------------------------------------------
def get_current_user(request: Request) -> dict:
    """
    Local sandbox stub.
    Pretends a user is authenticated.
    """
    return {
        "id": request.headers.get(
            "x-user-id",
            "00000000-0000-0000-0000-000000000000"
        )
    }

# -------------------------------------------------
# POST /api/practice/start
# -------------------------------------------------
@router.post(
    "/start",
    response_model=PracticeStartResponse,
    status_code=status.HTTP_201_CREATED
)
def start_practice(
    data: PracticeStartRequest,
    user: dict = Depends(get_current_user)
):
    """
    Initialize a new practice session for a user.
    """

    user_id = user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )

    resp = supabase.table("practice_sessions").insert({
        "user_id": user_id,
        "lesson_id": data.lesson_id,
        "status": "active"
    }).execute()

    if not resp.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start practice session"
        )

    return resp.data[0]

# -------------------------------------------------
# POST /api/practice/submit
# -------------------------------------------------
@router.post(
    "/submit",
    response_model=PracticeSubmitResponse
)
def submit_practice(
    data: PracticeSubmitRequest,
    user: dict = Depends(get_current_user)
):
    """
    Submit results for an existing practice session.
    """

    user_id = user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )

    # Update the practice session
    resp = supabase.table("practice_sessions").update({
        "accuracy": data.accuracy,
        "error_count": data.error_count,
        "time_seconds": data.time_seconds,
        "status": "completed"
    }).eq("id", data.session_id).execute()

    if not resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Practice session not found"
        )

    return {
        "message": "Practice session submitted successfully",
        "session_id": data.session_id,
        "accuracy": data.accuracy,
        "error_count": data.error_count,
        "time_seconds": data.time_seconds,
        "completed_at": resp.data[0].get("completed_at")
    }

