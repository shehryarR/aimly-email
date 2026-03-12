run:
	python main.py

build:
	docker compose -f docker/docker-compose.yml build email-microservice

up:
	docker compose -f docker/docker-compose.yml up -d email-microservice

down:
	docker compose -f docker/docker-compose.yml stop email-microservice
	docker compose -f docker/docker-compose.yml rm -f email-microservice

restart: docker-down docker-build docker-up

logs:
	docker compose -f docker/docker-compose.yml logs -f email-microservice