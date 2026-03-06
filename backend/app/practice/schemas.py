from pydantic import BaseModel, Field
from typing import Any, Dict, Optional, List
from uuid import UUID


class PracticeStartRequest(BaseModel):
    lesson_id: Any
    mode: Optional[str] = "practice"
    tier: Optional[Any] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class PracticeStartResponse(BaseModel):
    session_id: str
    lesson_id: Any
    mode: str
    status: str
    created_at: str


class PracticeSubmitRequest(BaseModel):
    session_id: UUID

    wpm: Optional[Any] = None
    accuracy: Optional[Any] = None
    error_count: Optional[Any] = 0
    time_seconds: Optional[Any] = 0
    duration_seconds: Optional[Any] = None

    score: Optional[Any] = None
    correct: Optional[Any] = 0
    total: Optional[Any] = 0

    tier: Optional[Any] = None
    results: Optional[Dict[str, Any]] = Field(default_factory=dict)
    details: Optional[Dict[str, Any]] = Field(default_factory=dict)


class PracticeSubmitResponse(BaseModel):
    ok: bool
    session_id: str
    result_id: str
    submitted_at: str


class PracticeSessionsResponse(BaseModel):
    sessions: List[Dict[str, Any]]
    total: Optional[int] = None
    limit: Optional[int] = None
    offset: Optional[int] = None


class PracticeSessionDetailResponse(BaseModel):
    session: Dict[str, Any]
    latest_result: Optional[Dict[str, Any]] = None


class PracticeStatsResponse(BaseModel):
    total_sessions: int
    total_time_seconds: int
    avg_wpm: Optional[float] = None
    best_wpm: Optional[float] = None
    avg_accuracy: Optional[float] = None
    best_accuracy: Optional[float] = None
    most_practiced_lesson_id: Optional[str] = None
    last_30_days_time_seconds: int = 0
    last_7_sessions: List[Dict[str, Any]] = Field(default_factory=list)
    last_session: Optional[Dict[str, Any]] = None


class PracticeLessonStatsResponse(BaseModel):
    lessons: List[Dict[str, Any]]
    total_lessons: int


class PracticeTrendPoint(BaseModel):
    submitted_at: str
    wpm: Optional[float] = None
    accuracy: Optional[float] = None
    time_seconds: int = 0
    lesson_id: Optional[str] = None
    tier: Optional[int] = None


class PracticeDailyTrendPoint(BaseModel):
    date: str
    avg_wpm: Optional[float] = None
    avg_accuracy: Optional[float] = None
    total_time_seconds: int = 0
    total_sessions: int = 0


class PracticeTrendsResponse(BaseModel):
    sessions: List[PracticeTrendPoint] = Field(default_factory=list)
    daily: List[PracticeDailyTrendPoint] = Field(default_factory=list)