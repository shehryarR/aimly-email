PYTHON := python3
VENV := venv

setup:
	@echo "Creating backend virtual environment..."
	$(PYTHON) -m venv $(VENV)
	@echo "Installing backend dependencies..."
	. $(VENV)/bin/activate && pip install -r requirements.txt

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
	@echo "Activating venv and running backend..."
	. $(VENV)/bin/activate && $(PYTHON) outreach_agent/main.py