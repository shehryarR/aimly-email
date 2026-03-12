# ============================================================
#  AIMLY - Root Makefile
#  Manages: AimlyBackend | AimlyFrontend | AimlyMicroservices
# ============================================================

.PHONY: help \
        setup setup-backend setup-frontend setup-microservices \
        build build-backend build-frontend build-microservices \
        up up-backend up-frontend up-microservices \
        down down-backend down-frontend down-microservices \
        restart restart-backend restart-frontend restart-microservices \
        logs logs-backend logs-frontend logs-microservices \
        run run-backend run-frontend run-microservices \
        stop


# ── Default: show help ───────────────────────────────────────
help:
	@echo ""
	@echo "  AIMLY Makefile Commands"
	@echo "  ────────────────────────────────────────────────────"
	@echo "  make setup    → Install ALL dependencies (run once)"
	@echo "  make build    → Build ALL Docker images"
	@echo "  make up       → Start ALL services via Docker"
	@echo "  make down     → Stop  ALL Docker containers"
	@echo "  make restart  → down + build + up for ALL"
	@echo "  make logs     → Tail logs for ALL services"
	@echo "  make run      → Start ALL as local processes (dev)"
	@echo "  make stop     → Stop  ALL local processes"
	@echo ""
	@echo "  Per-service (replace * with: backend | frontend | microservices):"
	@echo "  make setup-*   build-*   up-*   down-*   restart-*   logs-*   run-*"
	@echo ""


# ── SETUP ────────────────────────────────────────────────────
# NOTE: Stop any running local processes before running setup.
#       uvicorn --reload watches file changes and will crash
#       if you create a new venv while it is running.
#       Run 'make stop' first if services are already running.
setup: setup-backend setup-frontend setup-microservices
	@echo ""
	@echo "  ✅  All projects set up!"
	@echo "      Each service has its own venv:"
	@echo "      AimlyBackend/venv"
	@echo "      AimlyMicroservices/venv"
	@echo "      AimlyFrontend uses node_modules"

setup-backend:
	@echo "── Setup: AimlyBackend → AimlyBackend/venv ──"
	cd AimlyBackend && python3 -m venv venv
	cd AimlyBackend && ./venv/bin/pip install -r requirements.txt

setup-frontend:
	@echo "── Setup: AimlyFrontend → AimlyFrontend/node_modules ──"
	cd AimlyFrontend && npm install

setup-microservices:
	@echo "── Setup: AimlyMicroservices → AimlyMicroservices/venv ──"
	cd AimlyMicroservices && python3 -m venv venv
	cd AimlyMicroservices && ./venv/bin/pip install -r requirements.txt


# ── BUILD ────────────────────────────────────────────────────
build: build-backend build-frontend build-microservices
	@echo ""
	@echo "  ✅  All Docker images built!"

build-backend:
	@echo "── Build: AimlyBackend ──"
	cd AimlyBackend && docker build --no-cache -t outreach_agent -f docker/Dockerfile .

build-frontend:
	@echo "── Build: AimlyFrontend ──"
	cd AimlyFrontend && docker build -t outreach_ui -f docker/Dockerfile .

build-microservices:
	@echo "── Build: AimlyMicroservices ──"
	cd AimlyMicroservices && docker compose -f docker/docker-compose.yml build email-microservice


# ── UP ───────────────────────────────────────────────────────
up: up-backend up-frontend up-microservices
	@echo ""
	@echo "  ✅  All Docker containers started!"

up-backend:
	@echo "── Up: AimlyBackend ──"
	cd AimlyBackend && docker compose -f docker/docker-compose.yml up -d

up-frontend:
	@echo "── Up: AimlyFrontend ──"
	cd AimlyFrontend && docker compose -f docker/docker-compose.yml up -d

up-microservices:
	@echo "── Up: AimlyMicroservices ──"
	cd AimlyMicroservices && docker compose -f docker/docker-compose.yml up -d email-microservice


# ── DOWN ─────────────────────────────────────────────────────
down: down-backend down-frontend down-microservices
	@echo ""
	@echo "  ✅  All Docker containers stopped!"

down-backend:
	@echo "── Down: AimlyBackend ──"
	cd AimlyBackend && docker compose -f docker/docker-compose.yml down

down-frontend:
	@echo "── Down: AimlyFrontend ──"
	cd AimlyFrontend && docker compose -f docker/docker-compose.yml down

down-microservices:
	@echo "── Down: AimlyMicroservices ──"
	cd AimlyMicroservices && docker compose -f docker/docker-compose.yml stop email-microservice
	cd AimlyMicroservices && docker compose -f docker/docker-compose.yml rm -f email-microservice


# ── RESTART ──────────────────────────────────────────────────
restart: restart-backend restart-frontend restart-microservices
	@echo ""
	@echo "  ✅  All services restarted!"

restart-backend:   down-backend   build-backend   up-backend
restart-frontend:  down-frontend  build-frontend  up-frontend
restart-microservices: down-microservices build-microservices up-microservices


# ── LOGS ─────────────────────────────────────────────────────
logs:
	@echo "  Tailing logs for all services (Ctrl+C to stop)..."
	@$(MAKE) logs-backend       > /dev/null 2>&1 &
	@$(MAKE) logs-microservices > /dev/null 2>&1 &
	@$(MAKE) logs-frontend

logs-backend:
	cd AimlyBackend && docker compose -f docker/docker-compose.yml logs -f

logs-frontend:
	cd AimlyFrontend && docker compose -f docker/docker-compose.yml logs -f

logs-microservices:
	cd AimlyMicroservices && docker compose -f docker/docker-compose.yml logs -f email-microservice


# ── RUN (local dev, no Docker) ───────────────────────────────
run:
	@echo ""
	@echo "  🚀  Starting all services in background..."
	@-pkill -f "outreach_agent/main.py" 2>/dev/null || true
	@-pkill -f "AimlyMicroservices" 2>/dev/null || true
	@-pkill -f "vite" 2>/dev/null || true
	@sleep 1
	cd AimlyBackend && ./venv/bin/python3 outreach_agent/main.py > /dev/null 2>&1 &
	cd AimlyMicroservices && ./venv/bin/python3 main.py > /dev/null 2>&1 &
	cd AimlyFrontend && npm run dev -- --port 8501 > /dev/null 2>&1 &
	@echo "  ✅  All services running"
	@echo "      Run 'make stop' to shut everything down"
	@echo ""

run-backend:
	@echo "── Run: AimlyBackend ──"
	cd AimlyBackend && ./venv/bin/python3 outreach_agent/main.py

run-frontend:
	@echo "── Run: AimlyFrontend ──"
	cd AimlyFrontend && npm run dev -- --port 8501

run-microservices:
	@echo "── Run: AimlyMicroservices ──"
	cd AimlyMicroservices && ./venv/bin/python3 main.py


# ── STOP (local dev) ─────────────────────────────────────────
stop:
	@echo "── Stopping all local processes ──"
	@-pkill -f "outreach_agent/main.py" 2>/dev/null && echo "  stopped: backend"       || echo "  not running: backend"
	@-pkill -f "main.py"               2>/dev/null && echo "  stopped: microservices" || echo "  not running: microservices"
	@-pkill -f "vite"                  2>/dev/null && echo "  stopped: frontend"      || echo "  not running: frontend"
	@echo "  ✅  Done"