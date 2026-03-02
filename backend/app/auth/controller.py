from fastapi import APIRouter, Depends, HTTPException, status, Request
from supabase_auth.errors import AuthApiError

from app.db import supabase
from app.auth.dependencies import get_current_user
from app.auth.auth import UserRegister, UserLogin, UserResponse

router = APIRouter(prefix="/api/auth", tags=["authentication"])


def _safe_get_user_id(user_obj) -> str:
    if user_obj is None:
        raise HTTPException(
            status_code=500,
            detail="Auth user object missing from Supabase response",
        )

    if isinstance(user_obj, dict):
        return str(user_obj.get("id"))

    return str(getattr(user_obj, "id", None))


# ==========================
# REGISTER
# ==========================
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister, request: Request):
    # 1) Block duplicates by checking profile table
    existing = (
        supabase.table("users")
        .select("id")
        .or_(f"username.eq.{user_data.username},email.eq.{user_data.email}")
        .execute()
    )

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists",
        )

    # 2) Create AUTH user
    try:
        auth_res = supabase.auth.admin.create_user(
            {
                "email": user_data.email,
                "password": user_data.password,
                "email_confirm": True,
            }
        )
    except AuthApiError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create auth user",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error creating auth user",
        )

    auth_user_id = _safe_get_user_id(getattr(auth_res, "user", None))

    if not auth_user_id or auth_user_id == "None":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create auth user",
        )

    # 3) Upsert profile row using SAME UUID as auth.users.id
    profile_res = (
        supabase.table("users")
        .upsert(
            {
                "id": auth_user_id,
                "username": user_data.username,
                "email": user_data.email,
            }
        )
        .execute()
    )

    if not profile_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user profile",
        )

    new_user = profile_res.data[0]

    # 4) Store AUTH UUID in session
    request.session["user_id"] = auth_user_id

    return new_user


# ==========================
# LOGIN
# ==========================
@router.post("/login", response_model=UserResponse)
def login(login_data: UserLogin, request: Request):
    # 1) Authenticate with Supabase Auth
    try:
        auth_res = supabase.auth.sign_in_with_password(
            {"email": login_data.email, "password": login_data.password}
        )
    except AuthApiError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error during login",
        )

    auth_user_id = _safe_get_user_id(getattr(auth_res, "user", None))

    print("LOGIN auth_user_id:", auth_user_id) 

    if not auth_user_id or auth_user_id == "None":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # 2) Fetch profile row
    profile = (
        supabase.table("users")
        .select("*")
        .eq("id", auth_user_id)
        .limit(1)
        .execute()
    )

    if not profile.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile row missing for auth user. Please re-register.",
        )

    user = profile.data[0]

    # 3) Store AUTH UUID in session
    request.session["user_id"] = auth_user_id

    return user


# ==========================
# LOGOUT
# ==========================
@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request):
    request.session.clear()
    return None


# ==========================
# CURRENT USER
# ==========================
@router.get("/me", response_model=UserResponse)
def me(current_user: dict = Depends(get_current_user)):
    return current_user