from fastapi import APIRouter, HTTPException, Request, status
from datetime import datetime, timezone

from app.db import supabase
from app.auth.dependencies import get_current_user
from app.practice.schemas import (
    PracticeStartRequest,
    PracticeStartResponse,
    PracticeSubmitRequest,
    PracticeSubmitResponse,
)

router = APIRouter(prefix="/api/practice", tags=["practice"])


def _as_int(x):
    """Coerce ints safely from int/float/str like 100, 100.0, '100', '100.0'."""
    if x is None:
        return None
    return int(float(x))


def _as_float(x):
    """Coerce floats safely from int/float/str."""
    if x is None:
        return None
    return float(x)


def _as_tier_int(x):
    """
    Coerce tier into an int.
    Accepts: 1, 2, 3, "1", "tier1", "tier_1", "Tier 1"
    Returns: int or None
    """
    if x is None:
        return None
    if isinstance(x, (int, float)):
        return int(x)

    s = str(x).strip().lower()
    digits = "".join(ch for ch in s if ch.isdigit())
    return int(digits) if digits else None


@router.post("/start", response_model=PracticeStartResponse, status_code=status.HTTP_201_CREATED)
def start_practice(payload: PracticeStartRequest, request: Request):
    user = get_current_user(request)
    user_id = str(user["id"])

    if payload.lesson_id:
        lesson_check = (
            supabase.table("lessons")
            .select("id")
            .eq("id", str(payload.lesson_id))
            .limit(1)
            .execute()
        )

        lesson_err = getattr(lesson_check, "error", None)
        if lesson_err:
            raise HTTPException(status_code=500, detail=f"Supabase lesson lookup error: {lesson_err}")

        if not getattr(lesson_check, "data", None):
            raise HTTPException(status_code=400, detail="Invalid lesson_id (lesson does not exist)")

    resp = (
        supabase.table("practice_sessions")
        .insert(
            {
                "user_id": user_id,
                "lesson_id": str(payload.lesson_id) if payload.lesson_id else None,
                "mode": payload.mode,
                "status": "active",
                "metadata": payload.metadata,
            }
        )
        .execute()
    )

    err = getattr(resp, "error", None)
    if err:
        raise HTTPException(status_code=500, detail=f"Supabase insert error: {err}")

    data = getattr(resp, "data", None) or []
    if not data:
        raise HTTPException(status_code=500, detail=f"Insert returned no data. Raw resp: {resp}")

    return {"session_id": data[0]["id"]}


@router.post("/submit", response_model=PracticeSubmitResponse)
def submit_practice(payload: PracticeSubmitRequest, request: Request):
    user = get_current_user(request)
    user_id = str(user["id"])

    # Verify session exists + belongs to user
    s = (
        supabase.table("practice_sessions")
        .select("id,user_id,status")
        .eq("id", str(payload.session_id))
        .limit(1)
        .execute()
    )

    s_err = getattr(s, "error", None)
    if s_err:
        raise HTTPException(status_code=500, detail=f"Supabase read error: {s_err}")

    sdata = getattr(s, "data", None) or []
    if not sdata:
        raise HTTPException(status_code=404, detail="Practice session not found")

    session = sdata[0]
    if str(session["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not allowed to submit for this session")

    if session.get("status") == "submitted":
        return {"ok": True}

    submitted_at = datetime.now(timezone.utc).isoformat()

    # Coerce numeric fields to match DB column types (prevents int columns receiving 100.0)
    score_i = _as_int(payload.score)
    correct_i = _as_int(payload.correct)
    total_i = _as_int(payload.total)
    duration_i = _as_int(payload.duration_seconds)
    error_i = _as_int(payload.error_count)
    time_i = _as_int(payload.time_seconds)

    wpm_f = _as_float(payload.wpm)
    acc_f = _as_float(payload.accuracy)

    tier_i = _as_tier_int(payload.tier)

    # Insert results row
    r = (
        supabase.table("practice_results")
        .insert(
            {
                "session_id": str(payload.session_id),
                "user_id": user_id,
                "results": payload.results,
                "score": score_i,
                "correct": correct_i,
                "total": total_i,
                "duration_seconds": duration_i,
                "wpm": wpm_f,
                "accuracy": acc_f,
                "error_count": error_i,
                "time_seconds": time_i,
                "tier": tier_i,
                "details": payload.details,
            }
        )
        .execute()
    )

    r_err = getattr(r, "error", None)
    if r_err:
        raise HTTPException(status_code=500, detail=f"Supabase results insert error: {r_err}")

    # Update session summary
    session_update = {
        "status": "submitted",
        "submitted_at": submitted_at,
        "completed_at": submitted_at,
        "wpm": wpm_f,
        "accuracy": acc_f,
        "error_count": error_i,
        "time_seconds": time_i,
        "tier": tier_i,
        "details": payload.details,
    }

    u = (
        supabase.table("practice_sessions")
        .update(session_update)
        .eq("id", str(payload.session_id))
        .execute()
    )

    u_err = getattr(u, "error", None)
    if u_err:
        raise HTTPException(status_code=500, detail=f"Supabase session update error: {u_err}")

    return {"ok": True}