# ----------------------------
# UI Makefile
# ----------------------------
build:
	docker build --no-cache -t outreach_agent -f docker/Dockerfile .

up:
	docker compose -f docker/docker-compose.yml up -d

down:
	docker compose -f docker/docker-compose.yml down

restart: down build up

logs:
	docker compose -f docker/docker-compose.yml logs -f

run:
	python outreach_agent/main.py
