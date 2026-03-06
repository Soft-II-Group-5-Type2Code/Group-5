# Run this from backend folder, to check if the server is running: python -m uvicorn app.main:app --reload

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from app.auth.controller import router as auth_router
from app.dashboard.router import router as dashboard_router
from app.lessons.router import router as lessons_router
from app.practice.router import router as practice_router

app = FastAPI(title="Type2Code API")
app.include_router(practice_router)

# Middleware for the session
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
)

# Middleware for CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://172.18.0.3:3000",
        "https://group-5-pink.vercel.app",
        "https://group-5-7yfzct1eo-soft-ii-group-5s-projects.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(lessons_router)

@app.get("/")
def root():
    return {"message": "Type2Code API"}

@app.get("/health")
def health():
    return {"status": "ok"}

