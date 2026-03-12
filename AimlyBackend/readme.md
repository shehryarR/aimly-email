# Outreach Agent – Automated Deployment Setup

This README explains how automated deployment is configured for the **Outreach Agent** project using a server-side polling mechanism.

Whenever changes are pushed to the **`deploy` branch**, the server automatically pulls the updates and restarts the application.

---

## 🚀 Overview

The deployment system continuously monitors the **`deploy` branch** of the repository.  

When new commits are detected:
1. Code is pulled automatically
2. Docker containers are rebuilt  
3. Application is restarted using `make restart`

✅ No manual SSH  
✅ No manual restart  
✅ Fully automated via systemd  

---

## 📋 Prerequisites

- Debian-based VPS
- SSH access
- Git installed
- Docker & Docker Compose installed
- `make` available
- Project already cloned on server

---

## 🔧 Server Details

- **Hostname:** `vps-6d962bfd`
- **User:** `debian`
- **Project Path:** `/home/debian/outreach-agent`
- **Deployment Branch:** `deploy`

---

## 📁 Project Commands
```makefile
build:
	docker build --no-cache -t outreach_agent -f docker/Dockerfile .

up:
	docker compose -f docker/docker-compose.yml up

down:
	docker compose -f docker/docker-compose.yml down

restart:
	make down && make build && make up

logs:
	docker compose -f docker/docker-compose.yml logs -f

run:
	python outreach_agent/main.py
```

---

## 📖 Setup Instructions

### Step 1: SSH Into Server
```bash
ssh debian@vps-6d962bfd
```

### Step 2: Create Auto-Deploy Script
```bash
nano /home/debian/auto-deploy-outreach.sh
```

Paste:
```bash
#!/bin/bash

cd /home/debian/outreach-agent || exit 1

echo "Starting Outreach Agent auto-deploy..."

while true; do
    git fetch origin deploy
    
    LOCAL=$(git rev-parse deploy)
    REMOTE=$(git rev-parse origin/deploy)
    
    if [ "$LOCAL" != "$REMOTE" ]; then
        echo "$(date): New update detected on deploy branch"
        git pull origin deploy
        make restart
        echo "$(date): Deployment completed"
    else
        echo "$(date): No changes detected"
    fi
    
    sleep 30
done
```

Make it executable:
```bash
chmod +x /home/debian/auto-deploy-outreach.sh
```

### Step 3: Create systemd Service
```bash
sudo nano /etc/systemd/system/outreach-auto-deploy.service
```

Paste:
```ini
[Unit]
Description=Outreach Agent Auto Deployment
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=debian
WorkingDirectory=/home/debian/outreach-agent
ExecStart=/bin/bash /home/debian/auto-deploy-outreach.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Step 4: Enable and Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable outreach-auto-deploy.service
sudo systemctl start outreach-auto-deploy.service
```

### Step 5: Verify Deployment

Check service status:
```bash
sudo systemctl status outreach-auto-deploy.service
```

Expected:
```
● outreach-auto-deploy.service - Outreach Agent Auto Deployment
   Active: active (running)
```

View live logs:
```bash
sudo journalctl -u outreach-auto-deploy.service -f
```

Example:
```
Mon Dec 30 16:10:12 UTC: No changes detected
Mon Dec 30 16:10:42 UTC: New update detected on deploy branch  
Mon Dec 30 16:10:47 UTC: Deployment completed
```

---

## ✅ Deployment Flow Summary

1. **Push code to `deploy` branch**
2. **Server detects change** (within 30s)
3. **Automatically pulls changes**
4. **Runs:** `make restart`
5. **Docker rebuilds and restarts services**
6. **Application is live** 🚀

---

## 🧠 Notes

- Runs continuously using systemd
- Survives server reboots
- No webhook or CI required
- Fully isolated per project

---

If you want, I can also generate:
- ✅ **README with diagrams**
- ✅ **Production hardening version**  
- ✅ **Webhook-based deployment**
- ✅ **Multi-branch deployment support**

Just say the word 👍