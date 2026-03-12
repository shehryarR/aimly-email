# Email-Outreach-Frontend – Automated Deployment Setup

This README explains how automated deployment is configured for the **Email-Outreach-Frontend** project (React UI) using a server-side polling mechanism.

Whenever changes are pushed to the **`deploy` branch**, the server automatically pulls the updates and restarts the application using Docker and Makefile commands.

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
- **Project Path:** `/home/debian/Email-Outreach-Frontend`
- **Deployment Branch:** `deploy`

---

## 📁 Project Commands (Makefile)
```makefile
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
	npm run dev -- --port 8501
```

---

## 📖 Setup Instructions

### Step 1: SSH Into Server
```bash
ssh debian@vps-6d962bfd
```

### Step 2: Create Auto-Deploy Script
```bash
nano /home/debian/auto-deploy-ui.sh
```

Paste:
```bash
#!/bin/bash

cd /home/debian/Email-Outreach-Frontend || exit 1

echo "Starting Email-Outreach-Frontend auto-deploy..."

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
chmod +x /home/debian/auto-deploy-ui.sh
```

### Step 3: Create systemd Service
```bash
sudo nano /etc/systemd/system/ui-auto-deploy.service
```

Paste:
```ini
[Unit]
Description=Email-Outreach-Frontend Auto Deployment
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=debian
WorkingDirectory=/home/debian/Email-Outreach-Frontend
ExecStart=/bin/bash /home/debian/auto-deploy-ui.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Step 4: Enable and Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable ui-auto-deploy.service
sudo systemctl start ui-auto-deploy.service
```

### Step 5: Verify Deployment

Check service status:
```bash
sudo systemctl status ui-auto-deploy.service
```

Expected:
```
● ui-auto-deploy.service - Email-Outreach-Frontend Auto Deployment
   Active: active (running)
```

View live logs:
```bash
sudo journalctl -u ui-auto-deploy.service -f
```

Example logs:
```
Mon Dec 30 16:10:12 UTC: No changes detected
Mon Dec 30 16:10:42 UTC: New update detected on deploy branch  
Mon Dec 30 16:10:47 UTC: Deployment completed
```

---

## ✅ Deployment Flow Summary

1. Push code to `deploy` branch
2. Server detects change (within 30s)
3. Automatically pulls changes
4. Runs: `make restart` (builds & restarts Docker containers)
5. Application is live on port `8501` 🚀

---

## 🧠 Notes

* Runs continuously using systemd
* Survives server reboots
* No webhook or CI required
* Fully isolated per project
* Logs show deployment events (`No changes detected`, `Deployment completed`)