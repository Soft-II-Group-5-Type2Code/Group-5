from uuid import UUID
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status, Depends

from app.db import supabase
from app.lessons.schemas import LessonResponse, LessonListResponse
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/lessons", tags=["lessons"])


@router.get("", response_model=LessonListResponse)
def get_all_lessons(
    limit: int = Query(default=50, ge=1, le=200),
    difficulty: Optional[int] = Query(default=None, ge=1, le=5),
    _user: dict = Depends(get_current_user),  # remove if lessons should be public
):
    """
    Returns a list of lessons from Supabase.
    Optional filter: difficulty (1-5)
    """
    query = supabase.table("lessons").select("*").limit(limit)

    if difficulty is not None:
        query = query.eq("difficulty", difficulty)

    resp = query.execute()
    err = getattr(resp, "error", None)
    if err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch lessons: {err}",
        )

    data = getattr(resp, "data", None) or []
    return {"lessons": data}


@router.get("/{lesson_id}", response_model=LessonResponse)
def get_lesson_by_id(
    lesson_id: UUID,
    _user: dict = Depends(get_current_user),  # remove if lessons should be public
):
    """
    Returns one lesson by id.
    """
    resp = (
        supabase.table("lessons")
        .select("*")
        .eq("id", str(lesson_id))
        .limit(1)
        .execute()
    )

    err = getattr(resp, "error", None)
    if err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch lesson: {err}",
        )

    data = getattr(resp, "data", None) or []
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lesson not found")

    return data[0]


@router.get("/_debug/ping")
def lessons_ping():
    """
    Quick smoke test that lessons table is reachable.
    """
    resp = supabase.table("lessons").select("id").limit(1).execute()
    return {"ok": True, "data": getattr(resp, "data", None), "raw": str(resp)}