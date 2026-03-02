from pydantic import BaseModel, Field
from typing import Any, Dict, Optional
from uuid import UUID


class PracticeStartRequest(BaseModel):
    lesson_id: Optional[UUID] = None
    mode: str = Field(default="practice", max_length=50)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PracticeStartResponse(BaseModel):
    session_id: UUID


class PracticeSubmitRequest(BaseModel):
    session_id: UUID

    # Generic results blob (keeps you flexible)
    results: Dict[str, Any] = Field(default_factory=dict)

    # Old scoring style (optional)
    score: Optional[float] = None
    correct: Optional[int] = None
    total: Optional[int] = None
    duration_seconds: Optional[int] = None

    # New typing style (optional)
    wpm: Optional[float] = None
    accuracy: Optional[float] = None
    error_count: Optional[int] = None
    time_seconds: Optional[int] = None
    tier: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class PracticeSubmitResponse(BaseModel):
    ok: bool = True