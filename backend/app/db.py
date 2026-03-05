import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from supabase import create_client, Client

ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT_DIR / ".env"

# Load .env if present; otherwise rely on actual environment variables (e.g., Docker)
if ENV_FILE.exists():
    load_dotenv(dotenv_path=ENV_FILE)
    print("Loaded .env")
else:
    print("No .env found in repo root; using environment variables")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    raise RuntimeError("Missing SUPABASE_URL in environment")

supabase_public: Optional[Client] = None
if SUPABASE_ANON_KEY:
    supabase_public = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

supabase_public: Optional[Client] = None
if SUPABASE_SERVICE_ROLE_KEY:
    supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    print("Supabase admin client: enabled")
else:
    print("Supabase admin client: disabled")

# Prefer admin if available, else public
supabase: Client | None = supabase_admin or supabase_public
if supabase is None:
    raise RuntimeError("No valid Supabase credentials found (need SERVICE_ROLE or ANON key)")
