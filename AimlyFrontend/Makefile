# ----------------------------
# UI Makefile
# ----------------------------

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
	npm run dev -- --port 8501
