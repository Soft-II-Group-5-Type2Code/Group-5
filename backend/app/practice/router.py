from fastapi import APIRouter, HTTPException, Request, Query
from typing import Any, Dict, Optional, List
from uuid import uuid4
from datetime import datetime, timezone, timedelta
import traceback

from postgrest.exceptions import APIError

from app.db import supabase
from app.auth.dependencies import get_current_user
from app.practice.schemas import (
    PracticeSessionsResponse,
    PracticeSessionDetailResponse,
    PracticeStatsResponse,
    PracticeStartRequest,
    PracticeStartResponse,
    PracticeSubmitRequest,
    PracticeSubmitResponse,
    PracticeLessonStatsResponse,
    PracticeTrendsResponse,
)

router = APIRouter(prefix="/api/practice", tags=["practice"])


# =========================
# Helpers
# =========================

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    if value is None:
        return default
    try:
        return float(value)
    except Exception:
        return default


def safe_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(float(value))
    except Exception:
        return default


def normalize_tier_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        digits = "".join(c for c in value.strip() if c.isdigit())
        return int(digits) if digits else None
    return None


def normalize_accuracy(value: Any, default: Optional[float] = None) -> Optional[float]:
    """
    Normalize accuracy into percent form.
    Examples:
      0.95 -> 95.0
      95   -> 95.0
      "0.82" -> 82.0
      "82"   -> 82.0
    """
    n = safe_float(value, default)
    if n is None:
        return default
    return n * 100 if n <= 1 else n


def sb_data(resp: Any) -> Any:
    return getattr(resp, "data", None)


def sb_raise(e: Exception, context: str = "Supabase error") -> None:
    print("\n=== SUPABASE ERROR ===")
    print("Context:", context)
    print("Error:", str(e))
    traceback.print_exc()
    print("=== END SUPABASE ERROR ===\n")

    if isinstance(e, APIError):
        try:
            payload = e.args[0]
        except Exception:
            payload = str(e)
        raise HTTPException(status_code=500, detail=f"{context}: {payload}")

    raise HTTPException(status_code=500, detail=f"{context}: {str(e)}")


def safe_mean(vals: List[float]) -> Optional[float]:
    return (sum(vals) / len(vals)) if vals else None


def parse_iso(dt: Optional[str]) -> Optional[datetime]:
    if not dt:
        return None
    try:
        if dt.endswith("Z"):
            dt = dt.replace("Z", "+00:00")
        return datetime.fromisoformat(dt)
    except Exception:
        return None


def apply_session_filters(
    query,
    user_id: str,
    mode=None,
    tier=None,
    lesson_id=None,
    date_from=None,
    date_to=None,
    submitted_only=False,
):
    query = query.eq("user_id", user_id)

    if submitted_only:
        query = query.eq("status", "submitted")

    if mode:
        query = query.eq("mode", mode)

    if tier is not None:
        tier_int = normalize_tier_int(tier)
        if tier_int is not None:
            query = query.eq("tier", tier_int)

    if lesson_id:
        query = query.eq("lesson_id", lesson_id)

    if date_from:
        query = query.gte("submitted_at", date_from)

    if date_to:
        query = query.lte("submitted_at", date_to)

    return query


def summarize_last_session(session: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not session:
        return None

    return {
        "id": session.get("id"),
        "lesson_id": session.get("lesson_id"),
        "submitted_at": session.get("submitted_at"),
        "wpm": session.get("wpm"),
        "accuracy": normalize_accuracy(session.get("accuracy")),
        "error_count": session.get("error_count"),
        "time_seconds": session.get("time_seconds"),
        "duration_seconds": session.get("duration_seconds"),
        "tier": session.get("tier"),
        "status": session.get("status"),
        "mode": session.get("mode"),
    }


# =========================
# POST /start
# =========================

@router.post("/start", response_model=PracticeStartResponse)
def start_practice(payload: PracticeStartRequest, request: Request):
    user = get_current_user(request)
    user_id = user["id"]

    session_id = str(uuid4())
    now = now_iso()

    tier_int = normalize_tier_int(payload.tier)

    row = {
        "id": session_id,
        "user_id": user_id,
        "lesson_id": payload.lesson_id,
        "mode": payload.mode or "practice",
        "status": "active",
        "metadata": payload.metadata or {},
        "started_at": now,
        "tier": tier_int,
    }

    try:
        supabase.table("practice_sessions").insert(row).execute()
    except Exception as e:
        sb_raise(e, "Supabase insert error (practice_sessions)")

    return {
        "session_id": session_id,
        "lesson_id": payload.lesson_id,
        "mode": row["mode"],
        "status": "active",
        "created_at": now,
    }


# =========================
# POST /submit
# =========================

@router.post("/submit", response_model=PracticeSubmitResponse)
def submit_practice(payload: PracticeSubmitRequest, request: Request):
    user = get_current_user(request)
    user_id = user["id"]

    session_id = str(payload.session_id)
    now = now_iso()

    try:
        s = (
            supabase.table("practice_sessions")
            .select("id,user_id")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        sb_raise(e, "Supabase session read error")

    srows = sb_data(s) or []
    if not srows:
        raise HTTPException(status_code=404, detail="Session not found")

    if str(srows[0].get("user_id")) != str(user_id):
        raise HTTPException(status_code=403, detail="Not your session")

    wpm = safe_float(payload.wpm)
    accuracy = safe_float(payload.accuracy)
    error_count = safe_int(payload.error_count, 0)
    time_seconds = safe_int(payload.time_seconds, 0)
    duration_seconds = safe_int(payload.duration_seconds, time_seconds)
    correct = safe_int(payload.correct, 0)
    total = safe_int(payload.total, 0)
    score = safe_int(payload.score, correct)

    tier_int = normalize_tier_int(payload.tier)
    tier_text = f"tier{tier_int}" if tier_int is not None else None

    result_row = {
        "id": str(uuid4()),
        "session_id": session_id,
        "user_id": user_id,
        "results": payload.results or {},
        "score": score,
        "correct": correct,
        "total": total,
        "duration_seconds": duration_seconds,
        "wpm": wpm,
        "accuracy": accuracy,
        "error_count": error_count,
        "time_seconds": time_seconds,
        "tier": tier_text,
        "details": payload.details or {},
        "created_at": now,
    }

    try:
        supabase.table("practice_results").insert(result_row).execute()
    except Exception as e:
        sb_raise(e, "Supabase insert error (practice_results)")

    update_row = {
        "status": "submitted",
        "submitted_at": now,
        "completed_at": now,
        "wpm": wpm,
        "accuracy": accuracy,
        "error_count": error_count,
        "time_seconds": time_seconds,
        "duration_seconds": duration_seconds,
        "tier": tier_int,
        "details": payload.details or {},
    }

    try:
        (
            supabase.table("practice_sessions")
            .update(update_row)
            .eq("id", session_id)
            .execute()
        )
    except Exception as e:
        sb_raise(e, "Supabase update error (practice_sessions)")

    return {
        "ok": True,
        "session_id": session_id,
        "result_id": result_row["id"],
        "submitted_at": now,
    }


# =========================
# GET /sessions
# =========================

@router.get("/sessions", response_model=PracticeSessionsResponse)
def list_sessions(
    request: Request,
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0, le=5000),
    mode: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    lesson_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    submitted_only: bool = Query(False),
):
    user = get_current_user(request)
    user_id = user["id"]

    try:
        query = (
            supabase.table("practice_sessions")
            .select("*", count="exact")
        )

        query = apply_session_filters(
            query=query,
            user_id=user_id,
            mode=mode,
            tier=tier,
            lesson_id=lesson_id,
            date_from=date_from,
            date_to=date_to,
            submitted_only=submitted_only,
        )

        resp = (
            query
            .order("submitted_at", desc=True)
            .order("started_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
    except Exception as e:
        sb_raise(e, "Supabase sessions read error")

    sessions = sb_data(resp) or []

    for s in sessions:
        s["accuracy"] = normalize_accuracy(s.get("accuracy"))

    total = getattr(resp, "count", None)

    return {
        "sessions": sessions,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/sessions/recent", response_model=PracticeSessionsResponse)
def recent_sessions(
    request: Request,
    limit: int = Query(7, ge=1, le=50),
):
    user = get_current_user(request)
    user_id = user["id"]

    try:
        resp = (
            supabase.table("practice_sessions")
            .select("*", count="exact")
            .eq("user_id", user_id)
            .eq("status", "submitted")
            .order("submitted_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as e:
        sb_raise(e, "Supabase recent sessions read error")

    sessions = sb_data(resp) or []

    for s in sessions:
        s["accuracy"] = normalize_accuracy(s.get("accuracy"))

    total = getattr(resp, "count", None)

    return {
        "sessions": sessions,
        "total": total,
        "limit": limit,
        "offset": 0,
    }


@router.get("/lessons/{lesson_id}/history", response_model=PracticeSessionsResponse)
def lesson_history(
    lesson_id: str,
    request: Request,
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0, le=5000),
):
    user = get_current_user(request)
    user_id = user["id"]

    try:
        resp = (
            supabase.table("practice_sessions")
            .select("*", count="exact")
            .eq("user_id", user_id)
            .eq("lesson_id", lesson_id)
            .eq("status", "submitted")
            .order("submitted_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
    except Exception as e:
        sb_raise(e, "Supabase lesson history read error")

    sessions = sb_data(resp) or []

    for s in sessions:
        s["accuracy"] = normalize_accuracy(s.get("accuracy"))

    total = getattr(resp, "count", None)

    return {
        "sessions": sessions,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


# =========================
# GET /stats
# =========================

@router.get("/stats", response_model=PracticeStatsResponse)
def stats(
    request: Request,
    window: int = Query(200, ge=1, le=1000),
    mode: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    lesson_id: Optional[str] = Query(None),
):
    user = get_current_user(request)
    user_id = user["id"]

    try:
        query = (
            supabase.table("practice_sessions")
            .select("id,lesson_id,mode,submitted_at,wpm,accuracy,error_count,time_seconds,duration_seconds,tier,status")
        )

        query = apply_session_filters(
            query=query,
            user_id=user_id,
            mode=mode,
            tier=tier,
            lesson_id=lesson_id,
            submitted_only=True,
        )

        resp = (
            query
            .order("submitted_at", desc=True)
            .limit(window)
            .execute()
        )
    except Exception as e:
        sb_raise(e, "Supabase stats read error")

    sessions = sb_data(resp) or []

    if not sessions:
        return {
            "total_sessions": 0,
            "total_time_seconds": 0,
            "avg_wpm": None,
            "best_wpm": None,
            "avg_accuracy": None,
            "best_accuracy": None,
            "most_practiced_lesson_id": None,
            "last_30_days_time_seconds": 0,
            "last_7_sessions": [],
            "last_session": None,
        }

    wpms = [safe_float(s.get("wpm")) for s in sessions if safe_float(s.get("wpm")) is not None]
    accs = [normalize_accuracy(s.get("accuracy")) for s in sessions if normalize_accuracy(s.get("accuracy")) is not None]
    times = [safe_int(s.get("time_seconds"), 0) for s in sessions]

    total_time = sum(times) if times else 0
    lesson_counts: Dict[str, int] = {}
    last_30_days_time = 0

    now = datetime.now(timezone.utc)
    cutoff_30 = now - timedelta(days=30)

    for s in sessions:
        lid = s.get("lesson_id")
        if lid:
            lesson_counts[str(lid)] = lesson_counts.get(str(lid), 0) + 1

        submitted_at = parse_iso(s.get("submitted_at"))
        if submitted_at and submitted_at >= cutoff_30:
            last_30_days_time += safe_int(s.get("time_seconds"), 0)

    most_practiced_lesson_id = None
    if lesson_counts:
        most_practiced_lesson_id = max(lesson_counts, key=lesson_counts.get)

    last = sessions[0]
    last_7 = sessions[:7]

    return {
        "total_sessions": len(sessions),
        "total_time_seconds": total_time,
        "avg_wpm": safe_mean(wpms),
        "best_wpm": max(wpms) if wpms else None,
        "avg_accuracy": safe_mean(accs),
        "best_accuracy": max(accs) if accs else None,
        "most_practiced_lesson_id": most_practiced_lesson_id,
        "last_30_days_time_seconds": last_30_days_time,
        "last_7_sessions": [summarize_last_session(s) for s in last_7],
        "last_session": summarize_last_session(last),
    }


@router.get("/stats/by-lesson", response_model=PracticeLessonStatsResponse)
def stats_by_lesson(
    request: Request,
    window: int = Query(500, ge=1, le=2000),
):
    user = get_current_user(request)
    user_id = user["id"]

    try:
        resp = (
            supabase.table("practice_sessions")
            .select("lesson_id,wpm,accuracy,time_seconds,submitted_at,status")
            .eq("user_id", user_id)
            .eq("status", "submitted")
            .order("submitted_at", desc=True)
            .limit(window)
            .execute()
        )
    except Exception as e:
        sb_raise(e, "Supabase by-lesson stats read error")

    sessions = sb_data(resp) or []
    grouped: Dict[str, Dict[str, Any]] = {}

    for s in sessions:
        lesson_id = str(s.get("lesson_id"))
        if lesson_id not in grouped:
            grouped[lesson_id] = {
                "lesson_id": lesson_id,
                "total_sessions": 0,
                "total_time_seconds": 0,
                "wpms": [],
                "accs": [],
                "last_submitted_at": None,
            }

        row = grouped[lesson_id]
        row["total_sessions"] += 1
        row["total_time_seconds"] += safe_int(s.get("time_seconds"), 0)

        wpm = safe_float(s.get("wpm"))
        acc = normalize_accuracy(s.get("accuracy"))

        if wpm is not None:
            row["wpms"].append(wpm)
        if acc is not None:
            row["accs"].append(acc)

        if not row["last_submitted_at"]:
            row["last_submitted_at"] = s.get("submitted_at")

    lessons = []
    for _, row in grouped.items():
        wpms = row.pop("wpms")
        accs = row.pop("accs")

        row["avg_wpm"] = safe_mean(wpms)
        row["best_wpm"] = max(wpms) if wpms else None
        row["avg_accuracy"] = safe_mean(accs)
        row["best_accuracy"] = max(accs) if accs else None

        lessons.append(row)

    lessons.sort(key=lambda x: x["total_sessions"], reverse=True)

    return {
        "lessons": lessons,
        "total_lessons": len(lessons),
    }


@router.get("/stats/trends", response_model=PracticeTrendsResponse)
def stats_trends(
    request: Request,
    window: int = Query(100, ge=1, le=1000),
):
    user = get_current_user(request)
    user_id = user["id"]

    try:
        resp = (
            supabase.table("practice_sessions")
            .select("lesson_id,submitted_at,wpm,accuracy,time_seconds,tier,status")
            .eq("user_id", user_id)
            .eq("status", "submitted")
            .order("submitted_at", desc=False)
            .limit(window)
            .execute()
        )
    except Exception as e:
        sb_raise(e, "Supabase trends read error")

    sessions = sb_data(resp) or []

    points = []
    daily_map: Dict[str, Dict[str, Any]] = {}

    for s in sessions:
        submitted_at = s.get("submitted_at")
        dt = parse_iso(submitted_at)
        if not dt:
            continue

        points.append({
            "submitted_at": submitted_at,
            "wpm": safe_float(s.get("wpm")),
            "accuracy": normalize_accuracy(s.get("accuracy")),
            "time_seconds": safe_int(s.get("time_seconds"), 0),
            "lesson_id": s.get("lesson_id"),
            "tier": normalize_tier_int(s.get("tier")),
        })

        day = dt.date().isoformat()
        if day not in daily_map:
            daily_map[day] = {
                "date": day,
                "wpms": [],
                "accs": [],
                "total_time_seconds": 0,
                "total_sessions": 0,
            }

        d = daily_map[day]
        d["total_time_seconds"] += safe_int(s.get("time_seconds"), 0)
        d["total_sessions"] += 1

        wpm = safe_float(s.get("wpm"))
        acc = normalize_accuracy(s.get("accuracy"))

        if wpm is not None:
            d["wpms"].append(wpm)
        if acc is not None:
            d["accs"].append(acc)

    daily = []
    for _, d in sorted(daily_map.items()):
        wpms = d.pop("wpms")
        accs = d.pop("accs")
        d["avg_wpm"] = safe_mean(wpms)
        d["avg_accuracy"] = safe_mean(accs)
        daily.append(d)

    return {
        "sessions": points,
        "daily": daily,
    }