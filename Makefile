# ============================================================
#  AIMLY - Root Makefile
#  Manages: AimlyBackend | AimlyFrontend | AimlyMicroservices
# ============================================================

.PHONY: help \
        setup setup-backend setup-frontend setup-microservices \
        _start-microservices _stop-microservices \
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
	@echo "  make setup    → Configure + install ALL projects (run once)"
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


# ── INTERNAL ─────────────────────────────────────────────────
# Start microservice via Docker so backend env_generator can call it.
# Requires Docker image to already be built (setup-microservices handles this).
_start-microservices:
	@echo "── Starting microservice (Docker) for credential generation ──"
	cd AimlyMicroservices && docker compose -f docker/docker-compose.yml up -d email-microservice
	@echo "  Waiting for microservice to boot..."
	@sleep 8

# Stop and remove the temporary microservice container
_stop-microservices:
	@echo "── Stopping temporary microservice container ──"
	cd AimlyMicroservices && docker compose -f docker/docker-compose.yml stop email-microservice
	cd AimlyMicroservices && docker compose -f docker/docker-compose.yml rm -f email-microservice
	@sleep 3


# ── SETUP (configure + install deps) ─────────────────────────
# NOTE: Run 'make stop' first if services are already running.
setup: setup-microservices _start-microservices setup-backend _stop-microservices setup-frontend
	@echo ""
	@echo "  ✅  All projects configured and set up!"

setup-microservices:
	@echo "── Setup: AimlyMicroservices ──"
	cd AimlyMicroservices && python3 env_generator.py
	cd AimlyMicroservices && docker compose -f docker/docker-compose.yml build email-microservice

setup-backend:
	@echo "── Setup: AimlyBackend ──"
	cd AimlyBackend && python3 env_generator.py
	cd AimlyBackend && python3 -m venv venv
	cd AimlyBackend && ./venv/bin/pip install -r requirements.txt

setup-frontend:
	@echo "── Setup: AimlyFrontend ──"
	cd AimlyFrontend && python3 env_generator.py
	cd AimlyFrontend && npm install


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
up: up-microservices up-backend up-frontend
	@echo ""
	@echo "  ✅  All Docker containers started!"

up-microservices:
	@echo "── Up: AimlyMicroservices ──"
	cd AimlyMicroservices && docker compose -f docker/docker-compose.yml up -d email-microservice

up-backend:
	@echo "── Up: AimlyBackend ──"
	cd AimlyBackend && docker compose -f docker/docker-compose.yml up -d

up-frontend:
	@echo "── Up: AimlyFrontend ──"
	cd AimlyFrontend && docker compose -f docker/docker-compose.yml up -d


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

restart-backend:       down-backend       build-backend       up-backend
restart-frontend:      down-frontend      build-frontend      up-frontend
restart-microservices: down-microservices build-microservices up-microservices


# ── LOGS (Docker) ────────────────────────────────────────────
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
	@echo "  🚀  Starting all services..."
	@-pkill -f "outreach_agent/main.py" 2>/dev/null || true
	@-pkill -f "AimlyMicroservices" 2>/dev/null || true
	@-pkill -f "vite" 2>/dev/null || true
	@sleep 1
	@echo "  Ctrl+C to stop all services"
	@echo ""
	(cd AimlyMicroservices && ./venv/bin/python3 main.py 2>&1 | sed 's/^/[microservices] /') &
	(cd AimlyBackend && ./venv/bin/python3 outreach_agent/main.py 2>&1 | sed 's/^/[backend]       /') &
	(cd AimlyFrontend && npm run dev -- --port 8501 2>&1 | sed 's/^/[frontend]      /') &
	wait

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