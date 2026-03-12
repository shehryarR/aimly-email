setup:
	@echo "Installing frontend dependencies..."
	npm install

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
	@echo "Starting frontend..."
	npm run dev -- --port 8501