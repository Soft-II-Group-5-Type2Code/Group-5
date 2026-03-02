from fastapi import HTTPException, status, Request
from app.db import supabase


def get_current_user(request: Request) -> dict:
    user_id = request.session.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # user_id MUST be auth.users.id UUID
    # Fetch profile row from public.users
    result = (
        supabase
        .table("users")
        .select("*")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User profile not found",
        )

    return result.data[0]