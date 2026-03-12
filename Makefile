.PHONY: setup build up down restart logs run

# ----------------------------
# Setup all projects
# ----------------------------
setup:
	@echo "Setting up backend..."
	$(MAKE) -C AimlyBackend setup
	@echo "Setting up frontend..."
	$(MAKE) -C AimlyFrontend setup
	@echo "Setting up microservices..."
	$(MAKE) -C AimlyMicroservices setup

# ----------------------------
# Build all Docker images
# ----------------------------
build:
	$(MAKE) -C AimlyBackend build
	$(MAKE) -C AimlyFrontend build
	$(MAKE) -C AimlyMicroservices build

up:
	$(MAKE) -C AimlyBackend up
	$(MAKE) -C AimlyFrontend up
	$(MAKE) -C AimlyMicroservices up

down:
	$(MAKE) -C AimlyBackend down
	$(MAKE) -C AimlyFrontend down
	$(MAKE) -C AimlyMicroservices down

restart:
	$(MAKE) down
	$(MAKE) build
	$(MAKE) up

logs:
	$(MAKE) -C AimlyBackend logs
	$(MAKE) -C AimlyFrontend logs
	$(MAKE) -C AimlyMicroservices logs

run:
	$(MAKE) -C AimlyBackend run &
	$(MAKE) -C AimlyFrontend run &
	$(MAKE) -C AimlyMicroservices run &