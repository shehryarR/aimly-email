# ----------------------------
# Aimly Monorepo Makefile
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
	$(MAKE) -C AimlyBackend restart
	$(MAKE) -C AimlyFrontend restart
	$(MAKE) -C AimlyMicroservices restart

logs:
	$(MAKE) -C AimlyBackend logs
	$(MAKE) -C AimlyFrontend logs
	$(MAKE) -C AimlyMicroservices logs

run:
	$(MAKE) -C AimlyBackend run
	$(MAKE) -C AimlyFrontend run
	$(MAKE) -C AimlyMicroservices run