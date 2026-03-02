import pytest
import app.auth.controller as auth_controller
from app.auth.security import hash_password, verify_password
from supabase_auth.errors import AuthApiError


class FakeResp:
    def __init__(self, data):
        self.data = data


FAKE_USER = {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "username": "testuser",
    "email": "test@example.com",
    "password_hash": hash_password("password123"),
    "created_at": "2025-01-01T00:00:00",
}

# Return a fake supabase object that has chainable query methods
def _build_fake_supabase(existing_users=None, insert_result=None, login_result=None):

    class FakeAuthUser:
        def __init__(self, user_id):
            self.id = user_id

    class FakeAuthResponse:
        def __init__(self, user_id):
            self.user = FakeAuthUser(user_id)

    class FakeAdmin:
        def create_user(self, data):
            uid = (insert_result or [{}])[0].get("id", "fake-uuid")
            return FakeAuthResponse(uid)

    class FakeAuth:
        def __init__(self):
            self.admin = FakeAdmin()

        def sign_in_with_password(self, credentials):
            if not login_result:
                raise AuthApiError("Invalid credentials", 400, None)
            user = login_result[0]
            if not verify_password(credentials["password"], user.get("password_hash", "")):
                raise AuthApiError("Invalid credentials", 400, None)
            return FakeAuthResponse(user["id"])

    class FakeQuery:
        def __init__(self, data):
            self._data = data

        def or_(self, *a, **kw):
            return self

        def eq(self, *a, **kw):
            return self

        def limit(self, *a, **kw):
            return self

        def execute(self):
            return FakeResp(self._data)

    class FakeTable:
        def __init__(self, name):
            self.name = name

        def select(self, *a, **kw):
            if login_result is not None:
                return FakeQuery(login_result)
            return FakeQuery(existing_users or [])

        def insert(self, *a, **kw):
            return FakeQuery(insert_result or [])

        def upsert(self, *a, **kw):
            return FakeQuery(insert_result or [])

    class FakeSB:
        def __init__(self):
            self.auth = FakeAuth()

        def table(self, name):
            return FakeTable(name)

    return FakeSB()


# Test registration's success and trying to register duplicate user
@pytest.mark.integration
class TestRegisterFlow:
    def test_register_success(self, client, monkeypatch):
        fake_sb = _build_fake_supabase(
            existing_users=[],
            insert_result=[FAKE_USER],
        )
        monkeypatch.setattr(auth_controller, "supabase", fake_sb)

        r = client.post(
            "/api/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "password": "password123",
            },
        )
        assert r.status_code == 201
        data = r.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"

    def test_register_duplicate_user(self, client, monkeypatch):
        fake_sb = _build_fake_supabase(existing_users=[FAKE_USER])
        monkeypatch.setattr(auth_controller, "supabase", fake_sb)

        r = client.post(
            "/api/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "password": "password123",
            },
        )
        assert r.status_code == 400
        assert "already exists" in r.json()["detail"]


@pytest.mark.integration
class TestLoginFlow:
    def test_login_success(self, client, monkeypatch):
        fake_sb = _build_fake_supabase(login_result=[FAKE_USER])
        monkeypatch.setattr(auth_controller, "supabase", fake_sb)

        r = client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "password123"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "test@example.com"

    def test_login_wrong_password(self, client, monkeypatch):
        fake_sb = _build_fake_supabase(login_result=[FAKE_USER])
        monkeypatch.setattr(auth_controller, "supabase", fake_sb)

        r = client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "wrongpassword"},
        )
        assert r.status_code == 401

    def test_login_nonexistent_user(self, client, monkeypatch):
        fake_sb = _build_fake_supabase(login_result=[])
        monkeypatch.setattr(auth_controller, "supabase", fake_sb)

        r = client.post(
            "/api/auth/login",
            json={"email": "noone@example.com", "password": "password123"},
        )
        assert r.status_code == 401


# Test post-login authentication
@pytest.mark.integration
class TestMeEndpoint:
    def test_me_authenticated(self, client, app, monkeypatch):
        from app.auth.dependencies import get_current_user

        monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: FAKE_USER)

        r = client.get("/api/auth/me")
        assert r.status_code == 200
        assert r.json()["username"] == "testuser"

    def test_me_unauthenticated(self, client):
        r = client.get("/api/auth/me")
        assert r.status_code == 401
