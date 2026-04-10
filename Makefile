# ============================================================
#  AIMLY - Root Makefile
#  Manages: AimlyBackend | AimlyFrontend | AimlyMicroservices
#           AimlyCompanyFinder | AimlyOpenClaw | MySQL
# ============================================================

COMPOSE = docker compose -f docker/docker-compose.yml --env-file .env

.PHONY: help \
        setup \
        build build-backend build-frontend build-microservices build-company-finder build-openclaw \
        up up-backend up-frontend up-microservices up-db up-company-finder up-openclaw \
        down down-backend down-frontend down-microservices down-db down-company-finder down-openclaw \
        restart restart-backend restart-frontend restart-microservices restart-db restart-company-finder restart-openclaw \
        logs logs-backend logs-frontend logs-microservices logs-db logs-company-finder logs-openclaw


# ── Default: show help ───────────────────────────────────────
help:
	@echo ""
	@echo "  AIMLY Makefile Commands"
	@echo "  ────────────────────────────────────────────────────"
	@echo "  make setup    → Generate .env interactively (run once)"
	@echo "  make build    → Build ALL Docker images"
	@echo "  make up       → Start ALL services"
	@echo "                  (auto-creates dirs and initialises DB if needed)"
	@echo "  make down     → Stop ALL services"
	@echo "  make restart  → down + build + up for ALL"
	@echo "  make logs     → Tail logs for ALL services"
	@echo ""
	@echo "  Fresh machine flow:"
	@echo "    make setup && make build && make up"
	@echo ""
	@echo "  Per-service (* = backend | frontend | microservices | db | company-finder | openclaw):"
	@echo "    make build-*   up-*   down-*   restart-*   logs-*"
	@echo ""


# ── SETUP (env generation only — no Docker, no DB) ───────────
setup:
	@echo ""
	@echo "── Creating virtual environment ──"
	python3 -m venv .venv
	@echo ""
	@echo "── Installing setup dependencies ──"
	.venv/bin/pip install -q -r requirements.txt
	@echo ""
	@echo "── Step 1: MySQL configuration ──"
	.venv/bin/python3 env_generators/mysql.py
	@echo ""
	@echo "── Step 2: Microservice configuration ──"
	.venv/bin/python3 env_generators/microservice.py
	@echo ""
	@echo "── Step 3: Backend configuration ──"
	.venv/bin/python3 env_generators/backend.py
	@echo ""
	@echo "── Step 4: Frontend configuration ──"
	.venv/bin/python3 env_generators/frontend.py
	@echo ""
	@echo "── Step 5: OpenClaw configuration ──"
	.venv/bin/python3 env_generators/openclaw.py
	@echo ""
	@echo "  ✅  Setup complete — run 'make build' then 'make up'"


# ── BUILD ────────────────────────────────────────────────────
build: build-backend build-frontend build-microservices build-openclaw build-company-finder
	@echo ""
	@echo "  ✅  All Docker images built!"

build-backend:
	@echo "── Build: AimlyBackend ──"
	$(COMPOSE) build outreach_backend

build-frontend:
	@echo "── Build: AimlyFrontend ──"
	$(COMPOSE) build outreach_ui

build-microservices:
	@echo "── Build: AimlyMicroservices ──"
	$(COMPOSE) build email-microservice

build-openclaw:
	@echo "── Build: AimlyOpenClaw ──"
	$(COMPOSE) build company-finder-openclaw

build-company-finder:
	@echo "── Build: AimlyCompanyFinder ──"
	$(COMPOSE) build company-finder


# ── UP ───────────────────────────────────────────────────────
up:
	@echo ""
	@echo "── Step 1: Creating data directories if missing ──"
	@python3 AimlyDatabase/create_dirs.py
	@echo ""
	@echo "── Step 2: Starting MySQL ──"
	$(COMPOSE) up -d mysql
	@echo ""
	@echo "── Step 3: Checking database initialisation ──"
	@.venv/bin/python3 AimlyDatabase/check_and_setup_db.py
	@echo ""
	@echo "── Step 4: Starting all services ──"
	$(COMPOSE) up -d
	@echo ""
	@echo "  ✅  All Docker containers started!"

up-db:
	@echo "── Up: MySQL ──"
	$(COMPOSE) up -d mysql

up-microservices:
	@echo "── Up: AimlyMicroservices ──"
	$(COMPOSE) up -d email-microservice

up-backend:
	@echo "── Up: AimlyBackend ──"
	$(COMPOSE) up -d outreach_backend

up-frontend:
	@echo "── Up: AimlyFrontend ──"
	$(COMPOSE) up -d outreach_ui

up-openclaw:
	@echo "── Up: AimlyOpenClaw ──"
	$(COMPOSE) up -d company-finder-openclaw

up-company-finder:
	@echo "── Up: AimlyCompanyFinder ──"
	$(COMPOSE) up -d company-finder


# ── DOWN ─────────────────────────────────────────────────────
down:
	@echo "── Down: All services ──"
	$(COMPOSE) down
	@echo ""
	@echo "  ✅  All Docker containers stopped!"

down-db:
	@echo "── Down: MySQL ──"
	$(COMPOSE) stop mysql
	$(COMPOSE) rm -f mysql

down-backend:
	@echo "── Down: AimlyBackend ──"
	$(COMPOSE) stop outreach_backend
	$(COMPOSE) rm -f outreach_backend

down-frontend:
	@echo "── Down: AimlyFrontend ──"
	$(COMPOSE) stop outreach_ui
	$(COMPOSE) rm -f outreach_ui

down-microservices:
	@echo "── Down: AimlyMicroservices ──"
	$(COMPOSE) stop email-microservice
	$(COMPOSE) rm -f email-microservice

down-openclaw:
	@echo "── Down: AimlyOpenClaw ──"
	$(COMPOSE) stop company-finder-openclaw
	$(COMPOSE) rm -f company-finder-openclaw

down-company-finder:
	@echo "── Down: AimlyCompanyFinder ──"
	$(COMPOSE) stop company-finder
	$(COMPOSE) rm -f company-finder


# ── RESTART ──────────────────────────────────────────────────
restart: down build up
	@echo ""
	@echo "  ✅  All services restarted!"

restart-backend:        down-backend        build-backend        up-backend
restart-frontend:       down-frontend       build-frontend       up-frontend
restart-microservices:  down-microservices  build-microservices  up-microservices
restart-db:             down-db                                  up-db
restart-openclaw:       down-openclaw       build-openclaw       up-openclaw
restart-company-finder: down-company-finder build-company-finder up-company-finder


# ── LOGS ─────────────────────────────────────────────────────
logs:
	@echo "  Tailing logs for all services (Ctrl+C to stop)..."
	$(COMPOSE) logs -f

logs-backend:
	$(COMPOSE) logs -f outreach_backend

logs-frontend:
	$(COMPOSE) logs -f outreach_ui

logs-microservices:
	$(COMPOSE) logs -f email-microservice

logs-db:
	$(COMPOSE) logs -f mysql

logs-openclaw:
	$(COMPOSE) logs -f company-finder-openclaw

logs-company-finder:
	$(COMPOSE) logs -f company-finder