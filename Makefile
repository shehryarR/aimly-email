# ============================================================
#  AIMLY - Root Makefile
#  Manages: AimlyBackend | AimlyFrontend | AimlyMicroservices | MySQL
# ============================================================

COMPOSE = docker compose -f docker/docker-compose.yml --env-file .env

.PHONY: help \
        setup \
        build build-backend build-frontend build-microservices \
        up up-backend up-frontend up-microservices up-db \
        down down-backend down-frontend down-microservices down-db \
        restart restart-backend restart-frontend restart-microservices restart-db \
        logs logs-backend logs-frontend logs-microservices logs-db


# ── Default: show help ───────────────────────────────────────
help:
	@echo ""
	@echo "  AIMLY Makefile Commands"
	@echo "  ────────────────────────────────────────────────────"
	@echo "  make setup    → Generate .env (run once)"
	@echo "  make build    → Build ALL Docker images"
	@echo "  make up       → Start ALL services"
	@echo "  make down     → Stop  ALL services"
	@echo "  make restart  → down + build + up for ALL"
	@echo "  make logs     → Tail logs for ALL services"
	@echo ""
	@echo "  Per-service (replace * with: backend | frontend | microservices | db):"
	@echo "  make build-*   up-*   down-*   restart-*   logs-*"
	@echo ""


# ── SETUP ────────────────────────────────────────────────────
setup:
	@echo "── Creating required directories ──"
	mkdir -p data/mysql
	mkdir -p AimlyBackend/data/uploads/attachments
	mkdir -p AimlyMicroservices/data
	@echo ""
	@echo "── Creating virtual environment ──"
	python3 -m venv .venv
	@echo ""
	@echo "── Installing setup dependencies ──"
	.venv/bin/pip install -r requirements.txt
	@echo ""
	@echo "── Step 1: MySQL configuration ──"
	.venv/bin/python3 env_generators/mysql.py
	@echo ""
	@echo "── Step 2: Microservice configuration ──"
	.venv/bin/python3 env_generators/microservice.py
	@echo ""
	@echo "── Step 3: Building microservice image ──"
	$(COMPOSE) build email-microservice
	@echo ""
	@echo "── Step 4: Starting MySQL ──"
	$(COMPOSE) up -d mysql
	@echo "  Waiting for MySQL to be healthy..."
	@sleep 30
	@echo ""
	@echo "── Step 4b: Setting up database users ──"
	.venv/bin/python3 env_generators/setup_db.py
	@echo ""
	@echo "── Step 5: Starting microservice ──"
	$(COMPOSE) up -d email-microservice
	@echo "  Waiting for microservice to boot..."
	@sleep 15
	@echo ""
	@echo "── Step 6: Backend configuration ──"
	.venv/bin/python3 env_generators/backend.py
	@echo ""
	@echo "── Step 7: Stopping temporary containers ──"
	$(COMPOSE) stop email-microservice mysql
	$(COMPOSE) rm -f email-microservice mysql
	@echo ""
	@echo "── Step 8: Frontend configuration ──"
	.venv/bin/python3 env_generators/frontend.py
	@echo ""
	@echo "  ✅  Setup complete — run 'make build' then 'make up'"


# ── BUILD ────────────────────────────────────────────────────
build: build-backend build-frontend build-microservices
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


# ── UP ───────────────────────────────────────────────────────
up:
	@echo "── Up: All services ──"
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


# ── RESTART ──────────────────────────────────────────────────
restart: down build up
	@echo ""
	@echo "  ✅  All services restarted!"

restart-backend:       down-backend       build-backend       up-backend
restart-frontend:      down-frontend      build-frontend      up-frontend
restart-microservices: down-microservices build-microservices up-microservices
restart-db:            down-db                                up-db


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



# ── BUILD ────────────────────────────────────────────────────
build: build-backend build-frontend build-microservices
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


# ── UP ───────────────────────────────────────────────────────
up:
	@echo "── Up: All services ──"
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


# ── RESTART ──────────────────────────────────────────────────
restart: down build up
	@echo ""
	@echo "  ✅  All services restarted!"

restart-backend:       down-backend       build-backend       up-backend
restart-frontend:      down-frontend      build-frontend      up-frontend
restart-microservices: down-microservices build-microservices up-microservices
restart-db:            down-db                                up-db


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