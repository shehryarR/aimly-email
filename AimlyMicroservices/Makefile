PYTHON := python3
VENV := venv

setup:
	python3 env_generator.py
	@echo "  Installing microservice dependencies..."
	$(PYTHON) -m venv $(VENV)
	./$(VENV)/bin/pip install -r requirements.txt
	@echo "  ✅  Microservices ready"

env:
	python3 env_generator.py

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
	@echo "── Run: AimlyMicroservices ──"
	. $(VENV)/bin/activate && $(PYTHON) main.py