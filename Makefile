.PHONY: help backend-venv backend-install backend-dev frontend-install frontend-dev dev build clean

help:
	@echo "Run First Three in Order:"
	@echo "  make backend-venv"
	@echo "  make backend-install"
	@echo "  make frontend-install"
	@echo "    After installing dependencies run:" 
	@echo "      make dev               Run backend + frontend in two terminals (instructions)"
	@echo "      make backend-dev       Run backend (uvicorn)"
	@echo "      make frontend-dev      Run frontend (vite)"
	@echo "For production output:"
	@echo "    make build               Build frontend (dist/)"
	@echo "Can also clean with:"
	@echo "  make clean                 Removes backend/.venv frontend/node_modules frontend/dist"

backend-venv:
	cd backend && python -m venv .venv

backend-install:
	cd backend && . .venv/bin/activate && python -m pip install -U pip && pip install -r requirements.txt

backend-dev:
	cd backend && . .venv/bin/activate && set -a && . ../.env && set +a && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev -- --host 127.0.0.1 --port 3000

dev:
	@echo "Run these in two terminals:"
	@echo "  make backend-dev"
	@echo "  make frontend-dev"

build:
	cd frontend && npm run build

clean:
	rm -rf backend/.venv frontend/node_modules frontend/dist
