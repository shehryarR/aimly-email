PYTHON := python3
VENV := venv

setup:
	@echo "Creating microservice virtual environment..."
	$(PYTHON) -m venv $(VENV)
	@echo "Installing microservice dependencies..."
	. $(VENV)/bin/activate && pip install -r requirements.txt

build:
	docker compose -f docker/docker-compose.yml build email-microservice

up:
	docker compose -f docker/docker-compose.yml up -d email-microservice

down:
	docker compose -f docker/docker-compose.yml stop email-microservice
	docker compose -f docker/docker-compose.yml rm -f email-microservice

restart: down build up

logs:
	docker compose -f docker/docker-compose.yml logs -f email-microservice

run:
	@echo "Activating venv and running microservice..."
	. $(VENV)/bin/activate && $(PYTHON) main.py