setup:
	python3 env_generator.py
	@echo "  Installing frontend dependencies..."
	npm install
	@echo "  ✅  Frontend ready"

env:
	python3 env_generator.py

build:
	docker build -t outreach_ui -f docker/Dockerfile .

up:
	docker compose -f docker/docker-compose.yml up -d

down:
	docker compose -f docker/docker-compose.yml down

restart: down build up

logs:
	docker compose -f docker/docker-compose.yml logs -f

run:
	@echo "── Run: AimlyFrontend ──"
	npm run dev -- --port 8501