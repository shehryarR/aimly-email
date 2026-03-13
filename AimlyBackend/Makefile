PYTHON := python3
VENV := venv

setup:
	python3 env_generator.py
	@echo "  Installing backend dependencies..."
	$(PYTHON) -m venv $(VENV)
	./$(VENV)/bin/pip install -r requirements.txt
	@echo "  ✅  Backend ready"

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
	@echo "── Run: AimlyBackend ──"
	. $(VENV)/bin/activate && $(PYTHON) outreach_agent/main.py